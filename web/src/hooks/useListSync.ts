import { useEffect, useRef } from 'react';
import { useShopStore } from '../store/shopStore';
import { pb } from '../lib/pocketbase';
import { triggerHaptic } from '../utils/haptics';

export function useListSync() {
    const {
        sync,
        items,
        categories,
        notifyOnAdd,
        notifyOnCheck,
        lang,
        setSyncState,
        syncFromRemote,
        addToSyncHistory
    } = useShopStore();

    const lastRemoteStateRef = useRef<string>('');

    // 1. Auto-reconnect and URL parameter sync
    useEffect(() => {
        const handleSyncParam = async () => {
            const params = new URLSearchParams(window.location.search);
            const urlCode = (params.get('c') || params.get('code'))?.trim().toUpperCase();

            // Case A: URL has a sync code
            if (urlCode) {
                // If already connected correctly, just clear URL and stop
                if (sync.connected && sync.code === urlCode) {
                    const newUrl = window.location.origin + window.location.pathname;
                    window.history.replaceState({}, document.title, newUrl);
                    return;
                }

                if (!navigator.onLine) return;

                try {
                    // Validate code
                    const record = await pb.collection('shopping_lists').getFirstListItem(`list_code="${urlCode}"`);
                    const remoteData = record.data || { items: [], categories: undefined };

                    // Confirm if needed
                    const { items: currentItems } = useShopStore.getState();
                    const hasSignificantData = currentItems.length > 0 || (sync.connected && sync.code !== urlCode);

                    if (hasSignificantData) {
                        const msg = lang === 'ca'
                            ? `Vols connectar-te a la llista compartida "${urlCode}"? Es descartarà la teva llista actual.`
                            : `¿Quieres conectarte a la lista compartida "${urlCode}"? Se descartará tu lista actual.`;

                        if (!confirm(msg)) {
                            const newUrl = window.location.origin + window.location.pathname;
                            window.history.replaceState({}, document.title, newUrl);
                            return;
                        }
                    }

                    // Connect
                    setSyncState({ msg: 'Connecting...', msgType: 'info' });
                    syncFromRemote({ items: remoteData.items || [], categories: remoteData.categories || undefined });
                    setSyncState({ connected: true, code: urlCode, recordId: record.id, msg: 'Connected!', msgType: 'success' });
                    addToSyncHistory(urlCode);
                    localStorage.setItem('shopListSyncCode', urlCode);
                } catch (e) {
                    console.error('URL Sync failed:', e);
                    setSyncState({ msg: 'Invalid or missing code', msgType: 'error' });
                }

                // Always clear URL
                const newUrl = window.location.origin + window.location.pathname;
                window.history.replaceState({}, document.title, newUrl);
                return;
            }

            // Case B: Auto-reconnect
            if (!sync.connected && sync.code) {
                try {
                    const record = await pb.collection('shopping_lists').getFirstListItem(`list_code="${sync.code}"`);
                    setSyncState({ connected: true, recordId: record.id, msg: 'Reconnected', msgType: 'success' });
                    if (record.data) syncFromRemote(record.data);
                } catch (e) {
                    console.error('Auto-reconnect failed:', e);
                }
            }
        };
        handleSyncParam();
    }, [sync.code, sync.connected]);

    // 2. Sync local changes to remote
    useEffect(() => {
        const syncToRemote = async () => {
            if (sync.connected && sync.recordId) {
                const currentState = JSON.stringify({ items, categories });
                if (currentState === lastRemoteStateRef.current) return;

                try {
                    await pb.collection('shopping_lists').update(sync.recordId, {
                        data: { items, categories }
                    });
                    lastRemoteStateRef.current = currentState;
                } catch (e) {
                    console.error('Failed to sync to remote:', e);
                }
            }
        };

        const timer = setTimeout(syncToRemote, 200);
        return () => clearTimeout(timer);
    }, [items, categories, sync.connected, sync.recordId]);

    // 3. Subscribe to remote updates
    useEffect(() => {
        if (sync.connected && sync.recordId) {
            pb.collection('shopping_lists').subscribe(sync.recordId, (e) => {
                if (e.action === 'update' && e.record.data) {
                    const remoteData = e.record.data;
                    const remoteStateStr = JSON.stringify({ items: remoteData.items, categories: remoteData.categories });


                    if (remoteStateStr === lastRemoteStateRef.current) return;

                    // Optimistic UI Protection:
                    // If the user interacted locally in the last 2000ms (mobile latency), ignore this remote update.
                    // This prevents the "revert" flicker when the server echoes back an old state
                    // right after we made a change but before our change propagatedfully.
                    const { lastLocalInteraction } = useShopStore.getState().sync;
                    if (Date.now() - lastLocalInteraction < 2000) {
                        return; // Ignore this update, our local state is newer
                    }

                    const remoteItems = remoteData.items || [];
                    const localItems = useShopStore.getState().items;

                    // Notifications
                    handleNotifications(localItems, remoteItems, notifyOnAdd, notifyOnCheck, lang);

                    lastRemoteStateRef.current = remoteStateStr;
                    syncFromRemote(remoteData);
                    setSyncState({ lastSync: Date.now() });
                }
            });
        }
        return () => { pb.collection('shopping_lists').unsubscribe('*'); };
    }, [sync.connected, sync.recordId, sync.syncVersion, notifyOnAdd, notifyOnCheck, lang]);

    const refreshList = async () => {
        const { sync, setSyncState, syncFromRemote } = useShopStore.getState();
        if (sync.connected && sync.recordId) {
            setSyncState({ syncVersion: sync.syncVersion + 1 });
            try {
                const record = await pb.collection('shopping_lists').getOne(sync.recordId);
                if (record.data) {
                    syncFromRemote(record.data);
                    setSyncState({ lastSync: Date.now() });
                }
            } catch (e) {
                console.error('Failed proactive re-sync:', e);
            }
        }
    };

    return { lastRemoteStateRef, refreshList };
}

function handleNotifications(localItems: any[], remoteItems: any[], notifyOnAdd: boolean, notifyOnCheck: boolean, lang: string) {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;

    const getDisplayName = (i: any) => {
        if (!i.name) return '???';
        if (typeof i.name === 'string') return i.name;
        return i.name[lang] || i.name.es || i.name.ca || i.name.en || '???';
    };

    let body = '';

    // Added/Unchecked
    if (notifyOnAdd) {
        const newOrUnchecked = remoteItems.filter((ri: any) => {
            const local = localItems.find(li => li.id === ri.id);
            return (!local && !ri.checked) || (local && local.checked && !ri.checked);
        });
        if (newOrUnchecked.length > 0) {
            body += `+ ${newOrUnchecked.map(getDisplayName).join(', ')}\n`;
        }
    }

    // Checked
    if (notifyOnCheck) {
        const checked = remoteItems.filter((ri: any) => {
            const local = localItems.find(li => li.id === ri.id);
            return local && !local.checked && ri.checked;
        });
        if (checked.length > 0) {
            body += `✓ ${checked.map(getDisplayName).join(', ')}\n`;
        }
    }

    if (body) {
        new Notification('ShopList', {
            body: body.trim(),
            icon: '/icon-192-maskable.png',
            badge: '/icon-192-maskable.png',
            tag: 'shoplist-update', // Prevent spamming duplicate notifications
            renotify: true
        } as any);

        if ('vibrate' in navigator) {
            triggerHaptic(100);
        }
    }
}
