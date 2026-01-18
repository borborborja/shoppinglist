import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ShopItem, Categories, Lang, AppMode, ViewMode, LocalizedItem, AuthState, PresenceUser } from '../types';
import { defaultCategories } from '../data/constants';
import { pb } from '../lib/pocketbase';

interface SyncHistoryItem {
    code: string;
    title?: string;
    lastUsed: number;
}

interface SyncState {
    connected: boolean;
    code: string | null;
    recordId: string | null;
    msg: string;
    msgType: 'info' | 'success' | 'error';
    syncHistory: SyncHistoryItem[];
    lastSync: number | null;
    syncVersion: number;
    lastLocalInteraction: number;
}

interface ShopState {
    // Data
    items: ShopItem[];
    categories: Categories;
    listName: string | null;

    // UI State
    lang: Lang;
    appMode: AppMode;
    viewMode: ViewMode;
    theme: 'light' | 'dark' | 'amoled' | 'auto';
    isDark: boolean;
    isAmoled: boolean;
    notifyOnAdd: boolean;
    notifyOnCheck: boolean;
    serverName: string;
    activeUsers: PresenceUser[];
    sortOrder: 'category' | 'alpha';
    showCompletedInline: boolean;

    // Auto-clear state
    autoClearScheduled: number | null;  // timestamp when scheduled
    autoClearMinutes: number;           // minutes to wait (default 60)

    // Sync & Auth
    sync: SyncState;
    auth: AuthState;
    enableUsernames: boolean;
    serverUrl: string; // For native apps to configure remote server

    // Actions
    setLang: (lang: Lang) => void;
    setServerName: (name: string) => void;
    setEnableUsernames: (val: boolean) => void;
    setServerUrl: (url: string) => void;
    setAppMode: (mode: AppMode) => void;
    setViewMode: (mode: ViewMode) => void;
    setTheme: (theme: 'light' | 'dark' | 'amoled' | 'auto') => void;
    updateSystemTheme: (isSystemDark: boolean) => void;
    toggleTheme: () => void;
    toggleAmoled: () => void;
    setNotifyOnAdd: (val: boolean) => void;
    setNotifyOnCheck: (val: boolean) => void;
    setSortOrder: (order: 'category' | 'alpha') => void;
    setShowCompletedInline: (val: boolean) => void;

    addItem: (name: string, cat?: string) => void;
    toggleCheck: (id: string) => void;
    deleteItem: (id: string) => void;
    updateItemNote: (id: string, note: string) => void;
    clearCompleted: () => void;
    removeFromList: (id: string) => void;
    addBackToList: (id: string) => void;
    clearPreviouslyUsed: () => void;
    scheduleAutoClear: () => void;
    cancelAutoClear: () => void;

    addCategoryItem: (catKey: string, name: LocalizedItem) => Promise<void>;
    removeCategoryItem: (catKey: string, idx: number) => Promise<void>;
    setListName: (name: string | null) => void;

    // Category Management
    addCategory: (key: string, icon: string) => Promise<void>;
    removeCategory: (key: string) => Promise<void>;

    // Sync Actions
    setSyncState: (s: Partial<SyncState>) => void;
    syncFromRemote: (data: { items: ShopItem[], categories?: Categories, listName?: string | null }) => void;
    resetDefaults: () => void;
    importData: (items: ShopItem[], categories: Categories, listName?: string | null) => void;
    addToSyncHistory: (code: string) => void;
    removeFromSyncHistory: (code: string) => void;
    loadCatalog: () => Promise<void>;
    loadListCustomData: () => Promise<void>;

    // Auth Actions
    setAuth: (auth: Partial<AuthState>) => void;
    setUsername: (name: string) => void;
    setActiveUsers: (users: PresenceUser[]) => void;
    logout: () => void;
}

export const useShopStore = create<ShopState>()(
    persist(
        (set, get) => ({
            items: [],
            categories: defaultCategories,
            listName: null,
            lang: 'ca',
            appMode: 'planning',
            viewMode: 'list',
            theme: 'auto',
            isDark: window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches,
            isAmoled: false,
            notifyOnAdd: true,
            notifyOnCheck: true,
            serverName: 'ShoppingList',
            activeUsers: [],
            sync: { connected: false, code: null, recordId: null, msg: '', msgType: 'info', syncHistory: [], lastSync: null, syncVersion: 0, lastLocalInteraction: 0 },
            auth: { isLoggedIn: false, email: null, userId: null, username: null },
            enableUsernames: false,
            serverUrl: '',
            sortOrder: 'category',
            showCompletedInline: false,
            autoClearScheduled: null,
            autoClearMinutes: 60,

            setLang: (lang) => set({ lang }),
            setServerName: (serverName) => set({ serverName }),
            setEnableUsernames: (enableUsernames) => set({ enableUsernames }),
            setServerUrl: (serverUrl) => set({ serverUrl }),
            setAppMode: (appMode) => set((state) => {
                if (appMode === 'planning' && state.viewMode === 'grid') {
                    return { appMode, viewMode: 'compact' };
                }
                return { appMode };
            }),
            setViewMode: (viewMode) => set({ viewMode }),
            setTheme: (theme) => set(() => {
                const isSystemDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
                return {
                    theme,
                    isDark: theme === 'auto' ? isSystemDark : theme !== 'light',
                    isAmoled: theme === 'amoled'
                };
            }),
            updateSystemTheme: (isSystemDark) => set((state) => {
                if (state.theme === 'auto') {
                    return { isDark: isSystemDark, isAmoled: false };
                }
                return {};
            }),
            toggleTheme: () => set((state) => {
                // Cycle: light -> dark -> auto -> light
                const order: ('light' | 'dark' | 'auto')[] = ['light', 'dark', 'auto'];
                const currentIdx = order.indexOf(state.theme === 'amoled' ? 'dark' : state.theme as any);
                const nextTheme = order[(currentIdx + 1) % order.length];

                const isSystemDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;

                return {
                    theme: nextTheme,
                    isDark: nextTheme === 'auto' ? isSystemDark : nextTheme !== 'light',
                    isAmoled: false
                };
            }),
            toggleAmoled: () => set((state) => {
                const newTheme = state.theme === 'amoled' ? 'dark' : 'amoled';
                return {
                    theme: newTheme,
                    isDark: true,
                    isAmoled: newTheme === 'amoled'
                };
            }),
            setNotifyOnAdd: (notifyOnAdd) => set({ notifyOnAdd }),
            setNotifyOnCheck: (notifyOnCheck) => set({ notifyOnCheck }),
            setSortOrder: (sortOrder) => set({ sortOrder }),
            setShowCompletedInline: (showCompletedInline) => set({ showCompletedInline }),

            addItem: async (name, cat = 'other') => {
                const { sync, items } = get();
                const tempId = `local_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

                // 1. Optimistic Update
                set({
                    items: [{
                        id: tempId,
                        name,
                        checked: false,
                        note: '',
                        category: cat,
                        inList: true,
                        // updatedAt is now server managed, but we keep it for local sorting/logic if needed
                        updatedAt: Date.now()
                    }, ...items]
                });

                // 2. Network Call (if connected)
                if (sync.connected && sync.recordId) {
                    try {
                        const record = await pb.collection('shopping_items').create({
                            list: sync.recordId,
                            name,
                            category: cat,
                            checked: false,
                            note: ''
                        });

                        // 3. Confirm ID
                        set((state) => {
                            // Check if subscription already added the real item to avoid duplicates
                            const exists = state.items.find(i => i.id === record.id);
                            if (exists) {
                                // Subscription beat us. Remove temp item.
                                return { items: state.items.filter(i => i.id !== tempId) };
                            }
                            // Swap temp ID for real ID
                            return { items: state.items.map(i => i.id === tempId ? { ...i, id: record.id, updatedAt: Date.now() } : i) };
                        });
                    } catch (e) {
                        console.error("Failed to add atomic item", e);
                        // Revert? Or keep as local-only? For now keep local, maybe sync later.
                        // Setting error msg
                        set((state) => ({ sync: { ...state.sync, msg: 'Error syncing item', msgType: 'error' } }));
                    }
                }
            },
            toggleCheck: async (id) => {
                const { sync, items } = get();
                const item = items.find(i => i.id === id);
                if (!item) return;

                // 1. Optimistic
                set({
                    items: items.map(i => i.id === id ? { ...i, checked: !i.checked, updatedAt: Date.now() } : i),
                    sync: { ...sync, lastLocalInteraction: Date.now() }
                });

                // 2. Network
                if (sync.connected && !id.startsWith('local_')) {
                    try {
                        await pb.collection('shopping_items').update(id, { checked: !item.checked });
                    } catch (e) {
                        console.error("Failed to toggle item", e);
                        // Revert
                        set((state) => ({
                            items: state.items.map(i => i.id === id ? { ...i, checked: item.checked } : i)
                        }));
                    }
                }
            },
            deleteItem: async (id) => {
                const { sync, items } = get();
                const item = items.find(i => i.id === id);

                // 1. Optimistic
                set({
                    items: items.filter(i => i.id !== id),
                    sync: { ...sync, lastLocalInteraction: Date.now() }
                });

                // 2. Network
                if (sync.connected && !id.startsWith('local_')) {
                    try {
                        await pb.collection('shopping_items').delete(id);
                    } catch (e) {
                        console.error("Failed to delete item", e);
                        // Revert (put it back)
                        set((state) => ({ items: [item!, ...state.items] }));
                    }
                }
            },
            updateItemNote: async (id, note) => {
                const { sync, items } = get();

                // 1. Optimistic
                set({
                    items: items.map(i => i.id === id ? { ...i, note, updatedAt: Date.now() } : i),
                    sync: { ...sync, lastLocalInteraction: Date.now() }
                });

                // 2. Network
                if (sync.connected && !id.startsWith('local_')) {
                    try {
                        await pb.collection('shopping_items').update(id, { note });
                    } catch (e) {
                        console.error("Failed to update note", e);
                    }
                }
            },
            clearCompleted: async () => {
                const { sync, items } = get();
                const completed = items.filter(i => i.checked);

                // 1. Optimistic
                set({
                    items: items.filter(i => !i.checked),
                    sync: { ...sync, lastLocalInteraction: Date.now() }
                });

                // 2. Network
                if (sync.connected) {
                    // Batch delete? PocketBase doesn't support batch delete easily yet (unless exposed)
                    // We iterate.
                    for (const item of completed) {
                        if (!item.id.startsWith('local_')) {
                            try {
                                await pb.collection('shopping_items').delete(item.id);
                            } catch (e) { console.error("Failed to delete completed", item.id); }
                        }
                    }
                }
            },

            // Planner mode: remove from active list (move to "previously used")
            removeFromList: async (id) => {
                const { sync, items } = get();

                // 1. Optimistic: mark as not in list
                set({
                    items: items.map(i => i.id === id ? { ...i, inList: false, checked: false, updatedAt: Date.now() } : i),
                    sync: { ...sync, lastLocalInteraction: Date.now() }
                });

                // 2. Network: update inList field
                if (sync.connected && !id.startsWith('local_')) {
                    try {
                        await pb.collection('shopping_items').update(id, { in_list: false, checked: false });
                    } catch (e) {
                        console.error("Failed to remove from list", e);
                    }
                }
            },

            // Planner mode: add back to active list from "previously used"
            addBackToList: async (id) => {
                const { sync, items } = get();

                // 1. Optimistic
                set({
                    items: items.map(i => i.id === id ? { ...i, inList: true, checked: false, updatedAt: Date.now() } : i),
                    sync: { ...sync, lastLocalInteraction: Date.now() }
                });

                // 2. Network
                if (sync.connected && !id.startsWith('local_')) {
                    try {
                        await pb.collection('shopping_items').update(id, { in_list: true, checked: false });
                    } catch (e) {
                        console.error("Failed to add back to list", e);
                    }
                }
            },

            // Clear previously used items (permanent delete)
            clearPreviouslyUsed: async () => {
                const { sync, items } = get();
                const previouslyUsed = items.filter(i => i.inList === false);

                // 1. Optimistic
                set({
                    items: items.filter(i => i.inList !== false),
                    sync: { ...sync, lastLocalInteraction: Date.now() }
                });

                // 2. Network
                if (sync.connected) {
                    for (const item of previouslyUsed) {
                        if (!item.id.startsWith('local_')) {
                            try {
                                await pb.collection('shopping_items').delete(item.id);
                            } catch (e) { console.error("Failed to delete previously used", item.id); }
                        }
                    }
                }
            },

            // Schedule auto-clear of completed items (shopping mode)
            scheduleAutoClear: () => set({ autoClearScheduled: Date.now() }),

            // Cancel auto-clear
            cancelAutoClear: () => set({ autoClearScheduled: null }),


            setListName: (listName) => set((state) => ({
                listName,
                sync: { ...state.sync, lastLocalInteraction: Date.now() }
            })),

            addCategoryItem: async (catKey, item) => {
                const { sync, categories } = get();
                const itemName = typeof item === 'string' ? item : (item.es || item.ca || item.en || '');

                // 1. Optimistic update
                const cats = { ...categories };
                if (cats[catKey]) {
                    cats[catKey].items = [...cats[catKey].items, item];
                }
                set({ categories: cats });

                // 2. Sync to server if connected
                if (sync.connected && sync.recordId) {
                    try {
                        await pb.collection('list_items').create({
                            list: sync.recordId,
                            category_key: catKey,
                            name: itemName
                        });
                    } catch (e) {
                        console.error("Failed to sync category item", e);
                    }
                }
            },
            removeCategoryItem: async (catKey, idx) => {
                const { sync, categories } = get();
                const itemToRemove = categories[catKey]?.items[idx];
                const itemName = typeof itemToRemove === 'string' ? itemToRemove : (itemToRemove?.es || itemToRemove?.ca || itemToRemove?.en || '');

                // 1. Optimistic update
                const cats = { ...categories };
                if (cats[catKey]) {
                    const newItems = [...cats[catKey].items];
                    newItems.splice(idx, 1);
                    cats[catKey].items = newItems;
                }
                set({ categories: cats });

                // 2. Sync to server - find and delete by name
                if (sync.connected && sync.recordId && itemName) {
                    try {
                        const records = await pb.collection('list_items').getFullList({
                            filter: `list = "${sync.recordId}" && category_key = "${catKey}" && name = "${itemName}"`
                        });
                        if (records.length > 0) {
                            await pb.collection('list_items').delete(records[0].id);
                        }
                    } catch (e) {
                        console.error("Failed to delete category item from server", e);
                    }
                }
            },

            // Category Management
            addCategory: async (key, icon) => {
                const { sync, categories } = get();

                // 1. Optimistic update
                const cats = { ...categories };
                if (!cats[key]) {
                    cats[key] = { icon, items: [] };
                }
                set({ categories: cats });

                // 2. Sync to server if connected
                if (sync.connected && sync.recordId) {
                    try {
                        await pb.collection('list_categories').create({
                            list: sync.recordId,
                            key: key,
                            icon: icon,
                            name: key
                        });
                    } catch (e) {
                        console.error("Failed to sync category", e);
                    }
                }
            },
            removeCategory: async (key) => {
                const { sync, categories } = get();

                // 1. Optimistic update
                const cats = { ...categories };
                delete cats[key];
                set({ categories: cats });

                // 2. Sync to server - find and delete
                if (sync.connected && sync.recordId) {
                    try {
                        const records = await pb.collection('list_categories').getFullList({
                            filter: `list = "${sync.recordId}" && key = "${key}"`
                        });
                        if (records.length > 0) {
                            await pb.collection('list_categories').delete(records[0].id);
                        }
                    } catch (e) {
                        console.error("Failed to delete category from server", e);
                    }
                }
            },

            setSyncState: (s) => set((state) => ({ sync: { ...state.sync, ...s } })),
            syncFromRemote: (data) => set({ items: data.items, categories: data.categories || defaultCategories, listName: data.listName || null }),

            resetDefaults: () => set({ items: [], categories: defaultCategories, listName: null }),
            importData: (items, categories, listName) => set({ items, categories, listName: listName || null }),

            // Auth Actions
            setAuth: (auth) => set((state) => ({ auth: { ...state.auth, ...auth } })),
            setUsername: (username) => set((state) => ({ auth: { ...state.auth, username } })),
            setActiveUsers: (activeUsers) => set({ activeUsers }),
            logout: () => set({ auth: { isLoggedIn: false, email: null, userId: null, username: null } }),
            addToSyncHistory: (code: string) => set((state) => {
                const title = state.listName || undefined;
                // Remove existing entry for this code if present
                const filtered = state.sync.syncHistory.filter(h => typeof h === 'string' ? h !== code : h.code !== code);

                // Add new entry at top
                const newEntry = { code, title, lastUsed: Date.now() };
                const history = [newEntry, ...filtered].slice(0, 5);

                return { sync: { ...state.sync, syncHistory: history } };
            }),
            removeFromSyncHistory: (code: string) => set((state) => {
                const history = state.sync.syncHistory.filter(h => typeof h === 'string' ? h !== code : h.code !== code);
                return { sync: { ...state.sync, syncHistory: history } };
            }),

            loadCatalog: async () => {
                try {
                    const cats = await pb.collection('catalog_categories').getFullList({ sort: 'order', filter: 'hidden = false' });
                    const items = await pb.collection('catalog_items').getFullList({ expand: 'category', filter: 'hidden = false' });

                    if (cats.length === 0) return; // Keep defaults if DB empty or all hidden

                    const newCats: Categories = {};
                    cats.forEach((c: any) => {
                        newCats[c.key] = {
                            icon: c.icon,
                            items: [],
                            color: c.color
                        };
                    });

                    items.forEach((i: any) => {
                        const catKey = i.expand?.category?.key;
                        const catHidden = i.expand?.category?.hidden;

                        // Only add if category is also not hidden (extra safety)
                        if (catKey && newCats[catKey] && !catHidden) {
                            newCats[catKey].items.push({
                                es: i.name_es || '',
                                ca: i.name_ca || i.name_es || '',
                                en: i.name_en || i.name_es || ''
                            });
                        }
                    });

                    set({ categories: newCats });

                    // Load server config
                    try {
                        const config = await pb.collection('admin_config').getFullList();

                        const srvNameRecord = config.find(c => c.key === 'server_name');
                        if (srvNameRecord) set({ serverName: srvNameRecord.value });

                        const enableUsernamesRecord = config.find(c => c.key === 'enable_usernames');
                        if (enableUsernamesRecord) set({ enableUsernames: enableUsernamesRecord.value === 'true' });

                    } catch (e) {
                        console.error("Failed to load server config", e);
                    }
                } catch (e) {
                    console.error("Failed to load catalog", e);
                }
            },

            loadListCustomData: async () => {
                const { sync, categories } = get();
                if (!sync.connected || !sync.recordId) return;

                try {
                    // Load custom categories for this list
                    const customCats = await pb.collection('list_categories').getFullList({
                        filter: `list = "${sync.recordId}"`
                    });

                    // Load custom items for this list
                    const customItems = await pb.collection('list_items').getFullList({
                        filter: `list = "${sync.recordId}"`
                    });

                    // Merge with existing categories
                    const mergedCats = { ...categories };

                    customCats.forEach((c: any) => {
                        if (!mergedCats[c.key]) {
                            mergedCats[c.key] = {
                                icon: c.icon,
                                items: [],
                                color: undefined
                            };
                        }
                    });

                    // Add custom items to their categories
                    customItems.forEach((i: any) => {
                        if (mergedCats[i.category_key]) {
                            // Check if item already exists to avoid duplicates
                            const exists = mergedCats[i.category_key].items.some(item => {
                                if (typeof item === 'string') return item === i.name;
                                return item.es === i.name || item.ca === i.name || item.en === i.name;
                            });
                            if (!exists) {
                                mergedCats[i.category_key].items.push(i.name);
                            }
                        }
                    });

                    set({ categories: mergedCats });
                    console.log("Loaded list custom data:", customCats.length, "categories,", customItems.length, "items");
                } catch (e) {
                    console.error("Failed to load list custom data", e);
                }
            }
        }),
        {
            name: 'shoplist-storage',
            partialize: (state) => ({
                items: state.items,
                categories: state.categories,
                listName: state.listName,
                lang: state.lang,
                appMode: state.appMode,
                viewMode: state.viewMode,
                theme: state.theme,
                isDark: state.isDark,
                isAmoled: state.isAmoled,
                notifyOnAdd: state.notifyOnAdd,
                notifyOnCheck: state.notifyOnCheck,
                serverName: state.serverName,
                // Persist serverUrl for native apps custom server config
                serverUrl: state.serverUrl,
                enableUsernames: false,
                sortOrder: state.sortOrder,
                showCompletedInline: state.showCompletedInline,
                // Keep code/recordId for reconnection, but reset connection status
                sync: {
                    connected: false,
                    code: state.sync.code,
                    recordId: state.sync.recordId,
                    msg: '',
                    msgType: 'info' as const,
                    syncHistory: state.sync.syncHistory.map(h => typeof h === 'string' ? { code: h, lastUsed: Date.now() } : h),
                    lastSync: state.sync.lastSync,
                    syncVersion: 0,
                    lastLocalInteraction: 0
                },
                auth: state.auth
            })
        }
    )
);
