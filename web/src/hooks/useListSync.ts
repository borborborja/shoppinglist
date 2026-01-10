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
                    const remoteItems = (remoteData.items || []) as any[];
                    const localItems = useShopStore.getState().items;

                    // MERGE STRATEGY: Last Write Wins per Item
                    // 1. Map remote items for easy access
                    const remoteMap = new Map(remoteItems.map(i => [i.id, i]));

                    // 2. Build new list
                    const mergedItems: any[] = [];
                    const processedIds = new Set<number>();

                    // Process all local items
                    for (const localItem of localItems) {
                        const remoteItem = remoteMap.get(localItem.id);
                        if (remoteItem) {
                            // Conflict: Compare timestamps
                            // If remote is newer, use remote. Else keep local.
                            // If timestamps missing (legacy), prefer remote to ensure eventual consistency
                            const localTime = localItem.updatedAt || 0;
                            const remoteTime = remoteItem.updatedAt || 0;

                            if (remoteTime > localTime) {
                                mergedItems.push(remoteItem);
                            } else {
                                mergedItems.push(localItem);
                            }
                            processedIds.add(localItem.id);
                        } else {
                            // Local item NOT in remote.
                            // This usually means it was deleted remotely.
                            // Ideally we should track deletions, but for now we accept the deletion
                            // UNLESS it was created very recently locally (optimistic add in flight) which is handled by ignoring early re-echoes?
                            // No, to fix "ghost unchecking" we trust the MERGE of existing items.
                            // For deletions, we trust the server list.
                            // So if it's not in remote, it's GONE.
                            // EXCEPTION: If we just added it and server hasn't seen it yet.
                            // But since we syncToRemote actively, chances are low.
                            // Simpler approach: If it's not in remote, we keep it ONLY if it's new (created locally > lastSync).
                            // But complex. Let's stick to "Server Authority for List Membership" for now.
                            // If it's not in remote, it's deleted.
                        }
                    }

                    // Process remaining remote items (newly added by others)
                    for (const remoteItem of remoteItems) {
                        if (!processedIds.has(remoteItem.id)) {
                            // Check if we locally deleted it recently?
                            // Without tombstones we can't know. We assume it's a new add from other device.
                            mergedItems.push(remoteItem);
                        }
                    }

                    // Sort by id (creation time inverse) or keep order?
                    // Store expects items sorted by newest first usually.
                    mergedItems.sort((a, b) => b.id - a.id);

                    // Notifications
                    handleNotifications(localItems, mergedItems, notifyOnAdd, notifyOnCheck, lang);

                    // Update Store
                    syncFromRemote({ items: mergedItems, categories: remoteData.categories });
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
