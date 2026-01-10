import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ShopItem, Categories, Lang, AppMode, ViewMode, LocalizedItem, AuthState, PresenceUser } from '../types';
import { defaultCategories } from '../data/constants';
import { pb } from '../lib/pocketbase';

interface SyncState {
    connected: boolean;
    code: string | null;
    recordId: string | null;
    msg: string;
    msgType: 'info' | 'success' | 'error';
    syncHistory: string[];
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
    toggleCheck: (id: number) => void;
    deleteItem: (id: number) => void;
    updateItemNote: (id: number, note: string) => void;
    clearCompleted: () => void;

    addCategoryItem: (catKey: string, name: LocalizedItem) => void;
    removeCategoryItem: (catKey: string, idx: number) => void;
    setListName: (name: string | null) => void;

    // Category Management
    addCategory: (key: string, icon: string) => void;
    removeCategory: (key: string) => void;

    // Sync Actions
    setSyncState: (s: Partial<SyncState>) => void;
    syncFromRemote: (data: { items: ShopItem[], categories?: Categories, listName?: string | null }) => void;
    resetDefaults: () => void;
    importData: (items: ShopItem[], categories: Categories, listName?: string | null) => void;
    addToSyncHistory: (code: string) => void;
    loadCatalog: () => Promise<void>;

    // Auth Actions
    setAuth: (auth: Partial<AuthState>) => void;
    setUsername: (name: string) => void;
    setActiveUsers: (users: PresenceUser[]) => void;
    logout: () => void;
}

export const useShopStore = create<ShopState>()(
    persist(
        (set) => ({
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
            serverName: 'ShopList',
            activeUsers: [],
            sync: { connected: false, code: null, recordId: null, msg: '', msgType: 'info', syncHistory: [], lastSync: null, syncVersion: 0, lastLocalInteraction: 0 },
            auth: { isLoggedIn: false, email: null, userId: null, username: null },
            enableUsernames: false,
            serverUrl: '',
            sortOrder: 'category',
            showCompletedInline: false,

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

            addItem: (name, cat = 'other') => set((state) => ({
                items: [{ id: Date.now(), name, checked: false, note: '', category: cat, updatedAt: Date.now() }, ...state.items],
                sync: { ...state.sync, lastLocalInteraction: Date.now() }
            })),
            toggleCheck: (id) => set((state) => ({
                items: state.items.map(i => i.id === id ? { ...i, checked: !i.checked, updatedAt: Date.now() } : i),
                sync: { ...state.sync, lastLocalInteraction: Date.now() }
            })),
            deleteItem: (id) => set((state) => ({
                // Mark as deleted? No, for now we just delete locally. The Sync hook will handle merging deleted items if needed.
                // Or better: keep as is, but if we wanted "tombstones" we would mark deletedAt.
                // Current simpler approach: just delete.
                items: state.items.filter(i => i.id !== id),
                sync: { ...state.sync, lastLocalInteraction: Date.now() }
            })),
            updateItemNote: (id, note) => set((state) => ({
                items: state.items.map(i => i.id === id ? { ...i, note, updatedAt: Date.now() } : i),
                sync: { ...state.sync, lastLocalInteraction: Date.now() }
            })),
            clearCompleted: () => set((state) => ({
                items: state.items.filter(i => !i.checked),
                sync: { ...state.sync, lastLocalInteraction: Date.now() }
            })),

            setListName: (listName) => set((state) => ({
                listName,
                sync: { ...state.sync, lastLocalInteraction: Date.now() }
            })),

            addCategoryItem: (catKey, item) => set((state) => {
                const cats = { ...state.categories };
                if (cats[catKey]) {
                    cats[catKey].items = [...cats[catKey].items, item];
                }
                return { categories: cats };
            }),
            removeCategoryItem: (catKey, idx) => set((state) => {
                const cats = { ...state.categories };
                if (cats[catKey]) {
                    const newItems = [...cats[catKey].items];
                    newItems.splice(idx, 1);
                    cats[catKey].items = newItems;
                }
                return { categories: cats };
            }),

            // Category Management
            addCategory: (key, icon) => set((state) => {
                const cats = { ...state.categories };
                if (!cats[key]) {
                    cats[key] = { icon, items: [] };
                }
                return { categories: cats };
            }),
            removeCategory: (key) => set((state) => {
                const cats = { ...state.categories };
                delete cats[key];
                return { categories: cats };
            }),

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
                const history = [code, ...state.sync.syncHistory.filter(c => c !== code)].slice(0, 3);
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
                    syncHistory: state.sync.syncHistory,
                    lastSync: state.sync.lastSync,
                    syncVersion: 0,
                    lastLocalInteraction: 0
                },
                auth: state.auth
            })
        }
    )
);
