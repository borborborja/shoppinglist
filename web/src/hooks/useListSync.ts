import { useEffect, useRef } from 'react';
import { useShopStore } from '../store/shopStore';
import { pb } from '../lib/pocketbase';
import { triggerHaptic } from '../utils/haptics';

export function useListSync() {
    const {
        sync,
        categories,
        notifyOnAdd,
        notifyOnCheck,
        listName,
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
                    // Initial sync might be empty for items if using atomic, but we need metadata
                    // We will let the atomic sync hook handle the items fetch.
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
                    // We don't need to syncFromRemote here because the Atomic Effect will do it.
                } catch (e) {
                    console.error('Auto-reconnect failed:', e);
                }
            }
        };
        handleSyncParam();
    }, [sync.code, sync.connected]);

    // 2. Initial Fetch & Subscribe to ITEMS (Atomic)
    useEffect(() => {
        if (!sync.connected || !sync.recordId) return;
        const currentRecordId = sync.recordId;

        const init = async () => {
            try {
                // A. Fetch separate items
                const records = await pb.collection('shopping_items').getFullList({
                    filter: `list = "${currentRecordId}"`,
                    sort: '-created'
                });

                // Map to ShopItem format
                const newItems = records.map((r: any) => ({
                    id: r.id,
                    name: r.name,
                    checked: r.checked,
                    note: r.note,
                    category: r.category,
                    updatedAt: Date.now()
                }));

                // B. Fetch List Metadata (Categories, Name)
                const listRecord = await pb.collection('shopping_lists').getOne(currentRecordId);

                // C. Update Store (Resetting items to server state)
                syncFromRemote({
                    items: newItems,
                    categories: listRecord.categories || undefined,
                    listName: listRecord.listName
                });

                // D. Subscribe to ITEMS
                await pb.collection('shopping_items').subscribe('*', (e) => {
                    if (e.record.list !== currentRecordId) return;

                    const { items } = useShopStore.getState();

                    if (e.action === 'create') {
                        const exists = items.find(i => i.id === e.record.id);
                        if (!exists) {
                            const newItem = {
                                id: e.record.id,
                                name: e.record.name,
                                checked: e.record.checked,
                                note: e.record.note,
                                category: e.record.category,
                                updatedAt: Date.now()
                            };
                            useShopStore.setState({ items: [newItem, ...items] });
                            handleNotifications(items, [newItem], notifyOnAdd, notifyOnCheck, lang);
                        }
                    } else if (e.action === 'update') {
                        useShopStore.setState({
                            items: items.map(i => i.id === e.record.id ? {
                                ...i,
                                name: e.record.name,
                                checked: e.record.checked,
                                note: e.record.note,
                                category: e.record.category
                            } : i)
                        });
                    } else if (e.action === 'delete') {
                        useShopStore.setState({
                            items: items.filter(i => i.id !== e.record.id)
                        });
                    }
                }, { filter: `list = "${currentRecordId}"` });

                // E. Subscribe to LIST (Metadata only)
                await pb.collection('shopping_lists').subscribe(currentRecordId, (e) => {
                    if (e.action === 'update') {
                        const { categories, listName } = e.record;
                        useShopStore.setState((state) => ({
                            categories: categories || state.categories,
                            listName: listName || state.listName
                        }));
                    }
                });

            } catch (e) {
                console.error("Sync init failed", e);
                setSyncState({ msg: 'Sync Error', msgType: 'error' });
            }
        };

        init();

        return () => {
            pb.collection('shopping_items').unsubscribe();
            pb.collection('shopping_lists').unsubscribe(currentRecordId);
        };
    }, [sync.connected, sync.recordId]);

    // 3. Sync LIST METADATA local changes (Name/Categories) to remote
    useEffect(() => {
        if (!sync.connected || !sync.recordId) return;
        const currentRecordId = sync.recordId;

        const syncMetadata = async () => {
            const state = useShopStore.getState();
            const payload = { categories: state.categories, listName: state.listName };
            const str = JSON.stringify(payload);

            if (str === lastRemoteStateRef.current) return;

            try {
                await pb.collection('shopping_lists').update(currentRecordId, payload);
                lastRemoteStateRef.current = str;
            } catch (e) { console.error("Meta sync fail", e); }
        };

        const t = setTimeout(syncMetadata, 1000); // Slower debounce
        return () => clearTimeout(t);
    }, [categories, listName, sync.connected, sync.recordId]);

    return { refreshList: () => { } };
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
        new Notification('ShoppingList', {
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
