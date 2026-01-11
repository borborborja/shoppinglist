import { useState, useRef, useEffect } from 'react';
import { X, Server, Moon, Download, Upload, Trash2, Plus, Copy, LogOut, Package, Settings2, Bell, RefreshCw, History, RotateCw, Send, MessageCircle, Database, Check, Sun, AlertCircle, Wifi } from 'lucide-react';
import { useShopStore } from '../../store/shopStore';
import { translations, categoryStyles, EMOJI_LIST } from '../../data/constants';
import { pb, isNativePlatform, reinitializePocketBase } from '../../lib/pocketbase';
import PocketBase from 'pocketbase';
import { getLocalizedItemName } from '../../utils/helpers';
import { triggerHaptic } from '../../utils/haptics';
import type { LocalizedItem, SettingsTab } from '../../types';
import { useScrollLock } from '../../hooks/useScrollLock';
import { useBackButton } from '../../hooks/useBackButton';

interface SettingsModalProps {
    onClose: () => void;
    installPrompt?: any;
    onInstall?: () => void;
}

const SettingsModal = ({ onClose, installPrompt, onInstall }: SettingsModalProps) => {
    const {
        lang, setLang, theme, setTheme,
        notifyOnAdd, notifyOnCheck, setNotifyOnAdd, setNotifyOnCheck,
        categories, addCategoryItem, removeCategoryItem, addCategory, removeCategory,
        items, resetDefaults, importData, listName,
        sync, setSyncState, syncFromRemote, addToSyncHistory,
        auth, setUsername
    } = useShopStore();
    const t = translations[lang];


    useScrollLock(true);
    useBackButton(onClose);

    const [activeTab, setActiveTab] = useState<SettingsTab>('account');
    const [settingsActiveCat, setSettingsActiveCat] = useState<string>('fruit');
    const [settingsNewItemVal, setSettingsNewItemVal] = useState('');
    const [syncInputCode, setSyncInputCode] = useState('');

    // User Name State
    const [nameAvailable, setNameAvailable] = useState<boolean | null>(null);
    const [isCheckingName, setIsCheckingName] = useState(false);

    // Category Creator State
    const [isCreatingCat, setIsCreatingCat] = useState(false);
    const [newCatKey, setNewCatKey] = useState('');
    const [newCatIcon, setNewCatIcon] = useState('📦');

    // Server URL State (for native apps)
    const { serverUrl, setServerUrl } = useShopStore();
    const [tempServerUrl, setTempServerUrl] = useState(serverUrl || '');
    // Initialize status as success if we already have a saved URL, so UI shows connected state
    const [connectionStatus, setConnectionStatus] = useState<{ msg: string; type: 'success' | 'error' | 'loading' | '' }>({
        msg: serverUrl ? 'Conectado' : '',
        type: serverUrl ? 'success' : ''
    });

    // Easter Egg State
    const [showDedication, setShowDedication] = useState(false);
    const clickCountRef = useRef(0);
    const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const handleAboutClick = () => {
        clickCountRef.current += 1;

        if (clickTimerRef.current) clearTimeout(clickTimerRef.current);

        if (clickCountRef.current >= 5) {
            setShowDedication(true);
            clickCountRef.current = 0;
            triggerHaptic(50);
        } else {
            clickTimerRef.current = setTimeout(() => {
                clickCountRef.current = 0;
            }, 1000);
        }
    };

    // Test connection to remote server
    const testConnection = async () => {
        if (!tempServerUrl) {
            setConnectionStatus({ msg: 'Introduce una URL', type: 'error' });
            return;
        }
        setConnectionStatus({ msg: 'Probando conexión...', type: 'loading' });
        try {
            const testPb = new PocketBase(tempServerUrl);
            await testPb.health.check();

            // Check if remote access is enabled on the server
            try {
                const config = await testPb.collection('admin_config').getFullList();
                const remoteConfig = config.find(c => c.key === 'enable_remote_access');
                if (remoteConfig && remoteConfig.value !== 'true') {
                    setConnectionStatus({ msg: 'Acceso remoto deshabilitado en el servidor', type: 'error' });
                    return;
                }
            } catch (e: any) {
                // If the error is 403 or 401, it's a real access issue we should report
                if (e.status === 403 || e.status === 401 || (e.status === 0 && e.message.includes('fetch'))) {
                    throw e;
                }
                // For other errors (like 404 cat not found), we assume it's an old server
                console.warn('Could not verify remote access config:', e);
            }

            // Success - save URL
            setServerUrl(tempServerUrl);
            reinitializePocketBase(tempServerUrl);
            setConnectionStatus({ msg: '¡Conectado correctamente!', type: 'success' });
        } catch (e: any) {
            setConnectionStatus({ msg: `Error: ${e.message || 'No se puede conectar'}`, type: 'error' });
        }
    };

    // Debounce username check
    const checkUsername = async (name: string) => {
        if (!name || name.length < 3) { setNameAvailable(null); return; }
        setIsCheckingName(true);
        try {
            // Check if name exists (excluding current user if possible, though strict uniqueness isn't enforced by schema yet, 
            // but we want to simulate it for UX or if we add unique constraint later)
            // Just checking if ANY user has this display_name
            const result = await pb.collection('users').getList(1, 1, {
                filter: pb.filter('display_name = {:name} && id != {:id}', { name: name, id: pb.authStore.model?.id || '' })
            });
            setNameAvailable(result.totalItems === 0);
        } catch {
            setNameAvailable(null);
        } finally {
            setIsCheckingName(false);
        }
    };



    // Pending sync record for merge/replace dialog
    const [pendingSyncRecord, setPendingSyncRecord] = useState<{ id: string; code: string; data: { items: any[]; categories: any; listName?: string } } | null>(null);

    // --- Sync Logic ---
    const connectSync = async (code: string) => {
        if (!navigator.onLine) return;
        setSyncState({ msg: 'Connecting...', msgType: 'info' });
        try {
            const record = await pb.collection('shopping_lists').getFirstListItem(`list_code="${code}"`);
            const remoteData = record.data || { items: [], categories: undefined };

            // If user has local items, ask whether to merge or replace
            if (items.length > 0 && remoteData.items && remoteData.items.length > 0) {
                setPendingSyncRecord({ id: record.id, code, data: remoteData });
                return;
            }

            // If no conflict, just sync (if remote has data, use it; otherwise keep local)
            finishConnection(record.id, code, remoteData.items.length > 0 ? remoteData : { items, categories, listName: listName || undefined });
        } catch { disconnectSync(); setSyncState({ msg: 'Code not found', msgType: 'error' }); }
    };

    const handleSyncChoice = (choice: 'merge' | 'replace') => {
        if (!pendingSyncRecord) return;
        const { id, code, data } = pendingSyncRecord;

        if (choice === 'replace') {
            // Replace local with remote
            finishConnection(id, code, data);
        } else {
            // Merge: combine items (avoid duplicates by id)
            // Merge: combine items (avoid duplicates by id)
            const remoteItems = data.items || [];
            const localItemIds = new Set(items.map((i: any) => i.id));
            const mergedItems = [...items, ...remoteItems.filter((i: any) => !localItemIds.has(i.id))];
            finishConnection(id, code, { items: mergedItems, categories: data.categories || categories, listName: data.listName || listName });
        }
        setPendingSyncRecord(null);
    };

    const finishConnection = (recordId: string, code: string, data: { items: any[]; categories: any; listName?: string | null }) => {
        syncFromRemote({ items: data.items || [], categories: data.categories || undefined, listName: data.listName });
        setSyncState({ connected: true, code, recordId, msg: 'Connected', msgType: 'success' });
        addToSyncHistory(code);
        localStorage.setItem('shopListSyncCode', code);

        // Push merged/synced data to remote
        pb.collection('shopping_lists').update(recordId, { data: { items: data.items, categories: data.categories, listName: data.listName } }).catch(console.error);

        // Subscribe to updates - wrap in try/catch to avoid errors during subscription
        try {
            pb.collection('shopping_lists').unsubscribe('*').catch(() => { });
            pb.collection('shopping_lists').subscribe(recordId, (e) => {
                if (e.action === 'delete') { disconnectSync(); }
                // Remote updates handled by App.tsx sync logic
            }).catch(console.error);
        } catch (e) {
            console.error('Subscription error:', e);
        }
    };

    const createSharedList = async () => {
        if (!navigator.onLine) return alert('Offline');
        const newCode = Math.random().toString(36).substring(2, 8).toUpperCase();

        // Step 1: Create the list
        let record;
        try {
            record = await pb.collection('shopping_lists').create({ list_code: newCode, data: { items, categories, listName } });
        } catch (err: any) {
            console.error('Error creating list:', err);
            const msg = err?.response?.message || err?.data?.message || err?.message || 'Unknown error';
            alert(`Error creating list: ${msg}`);
            return;
        }

        // Step 2: Finish connection (this should not throw to user)
        // Step 2: Finish connection (this should not throw to user)
        try {
            finishConnection(record.id, newCode, { items, categories, listName });
        } catch (err) {
            console.error('Error in finishConnection:', err);
            // Still show success since list was created
        }
    };

    const disconnectSync = () => {
        pb.collection('shopping_lists').unsubscribe('*');
        setSyncState({ connected: false, code: null, recordId: null, msg: '' });
        localStorage.removeItem('shopListSyncCode');
    };

    const manualSync = async () => {
        if (!sync.connected || !sync.recordId) return;
        setSyncState({ msg: 'Syncing...', msgType: 'info' });
        try {
            // Push local
            await pb.collection('shopping_lists').update(sync.recordId, { data: { items, categories, listName } });
            // Pull remote
            const record = await pb.collection('shopping_lists').getOne(sync.recordId);
            if (record.data) syncFromRemote(record.data);
            setSyncState({ msg: 'Synced just now', msgType: 'success' });
        } catch {
            setSyncState({ msg: 'Sync failed', msgType: 'error' });
        }
    };

    // --- Catalog Logic ---
    const handleAddSettingsItem = () => {
        const name = settingsNewItemVal.trim();
        if (name && settingsActiveCat) {
            const newItem: LocalizedItem = { es: name, ca: name, en: name, [lang]: name };
            addCategoryItem(settingsActiveCat, newItem);
            setSettingsNewItemVal('');
        }
    };

    const handleAddCategory = () => {
        const key = newCatKey.trim().toLowerCase().replace(/\s+/g, '_');
        if (key && !categories[key]) {
            addCategory(key, newCatIcon);
            setNewCatKey('');
            setNewCatIcon('📦');
            setSettingsActiveCat(key);
            setIsCreatingCat(false);
        }
    };

    // --- Data Logic ---
    const exportData = () => {
        const blob = new Blob([JSON.stringify({ items, categories, listName })], { type: "application/json" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `ShoppingList_Backup_${new Date().toISOString().slice(0, 10)}.json`;
        link.click();
    };
    const handleImportData = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const data = JSON.parse(ev.target?.result as string);
                if (confirm(t.resetBtn + '?')) { importData(data.items || data, data.categories, data.listName); onClose(); }
            } catch { alert('Error reading file'); }
        };
        reader.readAsText(file);
    };

    // --- Tab Render ---
    const renderAccountTab = () => {
        const canSync = !isNativePlatform() || (connectionStatus.type === 'success');

        return (
            <div className="space-y-6 animate-fade-in">
                {/* Server URL Configuration (Native Apps Only) */}
                {isNativePlatform() && (
                    <div className="bg-cyan-50 dark:bg-cyan-900/10 p-4 rounded-xl border border-cyan-100 dark:border-cyan-800/30">
                        <h4 className="text-xs font-bold text-cyan-500 uppercase mb-3 tracking-wider flex items-center gap-2">
                            <Wifi size={12} /> Servidor Remoto
                        </h4>
                        <div className="flex gap-2 mb-2">
                            <input
                                type="url"
                                value={tempServerUrl}
                                onChange={(e) => setTempServerUrl(e.target.value)}
                                placeholder="https://tu-servidor.com"
                                className="flex-grow bg-white dark:bg-darkSurface border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm focus:outline-none dark:text-white font-mono"
                            />
                            <button
                                onClick={testConnection}
                                disabled={connectionStatus.type === 'loading'}
                                className="bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 disabled:opacity-50"
                            >
                                {connectionStatus.type === 'loading' ? <RefreshCw size={12} className="animate-spin" /> : <Wifi size={12} />}
                                Test
                            </button>
                        </div>
                        {connectionStatus.msg && (
                            <p className={`text-[10px] font-bold px-1 flex items-center gap-1 ${connectionStatus.type === 'success' ? 'text-green-500' :
                                connectionStatus.type === 'error' ? 'text-red-500' : 'text-cyan-500'
                                }`}>
                                {connectionStatus.type === 'success' ? <Check size={10} /> :
                                    connectionStatus.type === 'error' ? <AlertCircle size={10} /> : null}
                                {connectionStatus.msg}
                            </p>
                        )}
                        <p className="text-[10px] text-slate-500 mt-2 px-1">
                            Introduce la URL de tu servidor ShoppingList para sincronizar.
                        </p>
                    </div>
                )}

                {sync.connected && useShopStore.getState().enableUsernames && (
                    <div className={`bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700 animate-slide-up`}>
                        <h4 className="text-xs font-bold text-slate-400 uppercase mb-3 tracking-wider flex items-center gap-2">
                            <Settings2 size={12} /> {t.username}
                        </h4>
                        <div className="flex gap-2 relative">
                            <input
                                type="text"
                                value={auth.username || ''}
                                onChange={(e) => {
                                    setUsername(e.target.value);
                                    checkUsername(e.target.value);
                                }}
                                disabled={!sync.connected}
                                placeholder="Nombre..."
                                className={`flex-grow bg-white dark:bg-darkSurface border rounded-xl px-3 py-2 text-sm focus:outline-none dark:text-white font-bold transition-colors ${nameAvailable === false ? 'border-red-500 ring-1 ring-red-500' :
                                    nameAvailable === true ? 'border-green-500 ring-1 ring-green-500' :
                                        'border-slate-200 dark:border-slate-700'
                                    }`}
                            />
                            <div className="absolute right-3 top-2.5 flex items-center">
                                {isCheckingName ? <RefreshCw size={14} className="animate-spin text-slate-400" /> :
                                    nameAvailable === true ? <Check size={14} className="text-green-500" /> :
                                        nameAvailable === false ? <X size={14} className="text-red-500" /> : null}
                            </div>
                        </div>

                        {nameAvailable === false && (
                            <p className="text-[10px] text-red-500 font-bold mt-1 px-1 flex items-center gap-1">
                                <AlertCircle size={10} /> Este nombre ya está en uso.
                            </p>
                        )}

                        <p className="text-[10px] text-slate-500 mt-2 px-1 leading-relaxed">
                            Este nombre será visible para otros usuarios en la misma lista.
                            <span className="block mt-1 font-bold text-amber-600 dark:text-amber-500 flex items-center gap-1">
                                <AlertCircle size={10} /> Si no sincronizas la lista, tu nombre no se envía a ningún servidor.
                            </span>
                        </p>

                        {sync.connected && auth.userId && (
                            <div className="mt-3 flex items-center gap-1.5 px-2 py-1 bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-900/30 rounded-lg w-fit">
                                <Database size={10} className="text-green-600 dark:text-green-400" />
                                <span className="text-[10px] font-bold text-green-700 dark:text-green-300 uppercase tracking-wide">Usuario registrado en DB</span>
                            </div>
                        )}
                    </div>
                )}

                {/* Sync Section */}
                <div className={`p-4 rounded-xl border transition-all duration-300 ${canSync
                    ? 'bg-blue-50 dark:bg-blue-900/10 border-blue-100 dark:border-blue-800/30'
                    : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 opacity-60 grayscale-[0.5]'
                    }`}>
                    <h4 className={`text-xs font-bold uppercase mb-3 tracking-wider flex items-center gap-2 ${canSync ? 'text-blue-500' : 'text-slate-400'}`}>
                        <Server size={12} /> {t.sync}
                    </h4>
                    {sync.msg && <div className={`text-xs mb-2 font-mono ${sync.msgType === 'error' ? 'text-red-500' : sync.msgType === 'success' ? 'text-green-500' : 'text-blue-400'}`}>{sync.msg}</div>}
                    {!canSync && (
                        <div className="mb-3 px-2 py-1.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-900/30 rounded-lg flex items-center gap-2 text-[10px] font-bold text-amber-600 dark:text-amber-400">
                            <AlertCircle size={12} />
                            Primero debes conectar a un servidor arriba
                        </div>
                    )}

                    {/* Merge/Replace Dialog */}
                    {pendingSyncRecord && (
                        <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/50 rounded-xl">
                            <p className="text-xs font-bold text-amber-700 dark:text-amber-400 mb-3">{t.syncMergeTitle}: {pendingSyncRecord.data.items.length} items</p>
                            <div className="flex gap-2">
                                <button onClick={() => handleSyncChoice('merge')} className="flex-1 bg-green-500 hover:bg-green-600 text-white py-2 rounded-lg font-bold text-xs">{t.syncMerge}</button>
                                <button onClick={() => handleSyncChoice('replace')} className="flex-1 bg-red-500 hover:bg-red-600 text-white py-2 rounded-lg font-bold text-xs">{t.syncReplace}</button>
                                <button onClick={() => setPendingSyncRecord(null)} className="px-3 py-2 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg font-bold text-xs">{t.cancel}</button>
                            </div>
                        </div>
                    )}

                    {!sync.connected && !pendingSyncRecord ? (
                        <div>
                            <button onClick={createSharedList} disabled={!canSync} className="w-full mb-3 bg-white dark:bg-darkSurface border border-blue-200 dark:border-blue-700 text-blue-600 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 disabled:opacity-50"><Plus size={12} /> {t.createList}</button>
                            <div className="flex gap-2 mb-3">
                                <input type="text" value={syncInputCode} onChange={(e) => setSyncInputCode(e.target.value)} disabled={!canSync} placeholder="CODE..." className="flex-grow bg-white dark:bg-darkSurface border border-slate-200 dark:border-slate-700 rounded-xl px-3 text-xs focus:outline-none dark:text-white uppercase tracking-widest font-mono text-center disabled:opacity-50" />
                                <button onClick={() => connectSync(syncInputCode.toUpperCase())} disabled={!canSync} className="bg-slate-800 text-white px-4 py-2.5 rounded-xl font-bold text-xs disabled:opacity-50">{t.join}</button>
                            </div>
                        </div>
                    ) : sync.connected ? (
                        <div>
                            <div className="flex items-center justify-between mb-3 bg-white dark:bg-darkSurface p-2.5 rounded-xl border border-blue-200 dark:border-blue-800/30">
                                <span className="text-xs text-slate-400 uppercase font-bold pl-1">Code:</span>
                                <span className="font-mono font-bold text-blue-600 text-sm tracking-widest select-all">{sync.code}</span>
                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={() => {
                                            const baseUrl = isNativePlatform() ? (useShopStore.getState().serverUrl || 'https://shoppinglist.app') : window.location.origin;
                                            const text = encodeURIComponent(`${t.shareTitle}\n${t.shareBody} ${baseUrl}/?c=${sync.code}`);
                                            window.open(`https://wa.me/?text=${text}`, '_blank');
                                        }}
                                        className="text-slate-400 hover:text-green-500 p-1.5 transition-colors"
                                        title="WhatsApp"
                                    >
                                        <MessageCircle size={14} />
                                    </button>
                                    <button
                                        onClick={() => {
                                            const baseUrl = isNativePlatform() ? (useShopStore.getState().serverUrl || 'https://shoppinglist.app') : window.location.origin;
                                            const text = encodeURIComponent(t.shareTitle);
                                            const url = encodeURIComponent(`${baseUrl}/?c=${sync.code}`);
                                            window.open(`https://t.me/share/url?url=${url}&text=${text}`, '_blank');
                                        }}
                                        className="text-slate-400 hover:text-sky-500 p-1.5 transition-colors"
                                        title="Telegram"
                                    >
                                        <Send size={14} />
                                    </button>
                                    <button onClick={() => navigator.clipboard.writeText(sync.code!)} className="text-slate-400 hover:text-blue-500 p-1.5 transition-colors ml-1 border-l border-slate-100 dark:border-slate-800"><Copy size={12} /></button>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <button onClick={manualSync} disabled={sync.msg === 'Syncing...'} className="flex-1 text-xs font-bold text-blue-500 bg-white dark:bg-darkSurface border border-blue-100 dark:border-blue-800/30 py-2 rounded-lg flex items-center justify-center gap-1.5 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition disabled:opacity-50">
                                    <RotateCw size={12} className={sync.msg === 'Syncing...' ? 'animate-spin' : ''} />
                                    {lang === 'ca' ? 'Sincronitzar' : 'Sincronizar'}
                                </button>
                                <button onClick={disconnectSync} className="flex-1 text-xs font-bold text-red-500 bg-white dark:bg-darkSurface border border-red-100 dark:border-red-800/20 py-2 rounded-lg flex items-center justify-center gap-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 transition"><LogOut size={12} /> {t.disconnect}</button>
                            </div>
                            {sync.lastSync && (
                                <p className="text-[10px] text-slate-400 text-center mt-3 lowercase italic">
                                    {lang === 'ca' ? 'Darrera sincronització' : 'Última sincronización'}: {new Date(sync.lastSync).toLocaleTimeString()}
                                </p>
                            )}
                        </div>
                    ) : null}

                    {/* History - Always visible if there are codes beyond the current one */}
                    {sync.syncHistory && sync.syncHistory.filter(c => c !== sync.code).length > 0 && (
                        <div className="mt-4 pt-4 border-t border-blue-100 dark:border-blue-800/20">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1 mb-2 flex items-center gap-1">
                                <History size={10} /> {t.syncHistory}
                            </p>
                            <div className="flex flex-col gap-2">
                                {sync.syncHistory.filter(c => c !== sync.code).map(code => (
                                    <button
                                        key={code}
                                        onClick={() => {
                                            setSyncInputCode(code);
                                            connectSync(code);
                                        }}
                                        disabled={!canSync}
                                        className="w-full flex items-center justify-between px-3 py-2 bg-white dark:bg-darkSurface border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono font-bold text-slate-600 dark:text-slate-400 hover:border-blue-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/10 transition group disabled:opacity-50"
                                    >
                                        <span className="tracking-widest uppercase">{code}</span>
                                        <span className="text-[9px] font-sans text-blue-500 opacity-0 group-hover:opacity-100 transition uppercase tracking-tighter">
                                            {t.join}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    const renderCatalogTab = () => (
        <div className="space-y-6 animate-fade-in">
            {/* Category Selector (Pills) */}
            {!isCreatingCat && (
                <div className="space-y-3">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest pl-1">{t.tabCategories}</h4>
                    <div className="flex flex-wrap gap-2">
                        {Object.entries(categories).map(([key, cat]) => {
                            const isActive = settingsActiveCat === key;
                            return (
                                <button
                                    key={key}
                                    onClick={() => { setSettingsActiveCat(key); triggerHaptic(10); }}
                                    className={`group relative px-3 py-1.5 rounded-full border-[1.5px] transition-all flex items-center gap-1.5 active:scale-95 shadow-sm ${isActive
                                        ? 'bg-white dark:bg-slate-800 border-blue-500 text-slate-800 dark:text-white shadow-blue-500/10'
                                        : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-blue-200'}`}
                                >
                                    <span className="text-base">{cat.icon}</span>
                                    <span className="text-[11px] font-bold whitespace-nowrap">{(t.cats as Record<string, string>)[key] || key}</span>
                                </button>
                            )
                        })}
                        {/* Add Category Pill */}
                        <button
                            onClick={() => { setIsCreatingCat(true); triggerHaptic(10); }}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border-[1.5px] border-dashed border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500 transition-all hover:border-blue-400 hover:text-blue-500 active:scale-95 bg-white/50 dark:bg-slate-800/10"
                        >
                            <Plus size={14} />
                            <span className="text-[11px] font-bold uppercase tracking-wide">{t.add}</span>
                        </button>
                    </div>
                </div>
            )}

            {/* Content Area: Either Creator or Item Manager */}
            {isCreatingCat ? (
                <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-xl animate-scale-in">
                    <div className="flex justify-between items-center mb-6">
                        <h4 className="text-xl font-bold text-slate-800 dark:text-white">{t.newCategory}</h4>
                        <button onClick={() => setIsCreatingCat(false)} className="bg-slate-50 dark:bg-slate-700 p-2 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"><X size={20} /></button>
                    </div>

                    <div className="space-y-6">
                        {/* Name Input */}
                        <div className="space-y-2">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">{t.categoryName}</label>
                            <input
                                type="text"
                                value={newCatKey}
                                onChange={(e) => setNewCatKey(e.target.value)}
                                placeholder="..."
                                className="w-full bg-white dark:bg-darkSurface border-2 border-slate-100 dark:border-slate-800 rounded-2xl px-5 py-4 text-base focus:outline-none focus:border-blue-400 dark:text-white font-bold shadow-sm transition-all"
                            />
                        </div>

                        {/* Emoji Selection */}
                        <div className="space-y-2">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">{t.categoryIcon}</label>
                            <div className="flex gap-4 items-start">
                                {/* Preview Card */}
                                <div className="w-16 h-16 shrink-0 bg-white dark:bg-darkSurface border-2 border-slate-100 dark:border-slate-800 rounded-2xl flex items-center justify-center text-3xl shadow-sm">
                                    {newCatIcon}
                                </div>
                                {/* Emoji Grid */}
                                <div className="flex-grow p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                                    <div className="grid grid-cols-5 gap-2 max-h-40 overflow-y-auto no-scrollbar">
                                        {EMOJI_LIST.map((emoji) => (
                                            <button
                                                key={emoji}
                                                onClick={() => { setNewCatIcon(emoji); triggerHaptic(10); }}
                                                className={`aspect-square flex items-center justify-center text-2xl rounded-xl transition-all active:scale-90 ${newCatIcon === emoji ? 'bg-white dark:bg-slate-700 ring-2 ring-blue-500 shadow-sm' : 'hover:bg-white dark:hover:bg-slate-700'}`}
                                            >
                                                {emoji}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <button
                            onClick={handleAddCategory}
                            disabled={!newCatKey.trim()}
                            className="w-full bg-blue-500 hover:bg-blue-600 disabled:opacity-50 disabled:grayscale text-white py-4 rounded-2xl text-sm font-bold shadow-lg shadow-blue-500/20 transition-all flex items-center justify-center gap-2 mt-2"
                        >
                            <Check size={18} /> {t.saveNote}
                        </button>
                    </div>
                </div>
            ) : settingsActiveCat && categories[settingsActiveCat] && (
                <div className="bg-white dark:bg-slate-800/50 rounded-2xl p-4 border border-slate-100 dark:border-slate-700/50 shadow-sm animate-scale-in">
                    <div className="flex justify-between items-center mb-4 border-b border-slate-50 dark:border-slate-800 pb-3">
                        <div className="flex items-center gap-2">
                            <span className="text-2xl">{categories[settingsActiveCat].icon}</span>
                            <span className="text-sm font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wide">{(t.cats as Record<string, string>)[settingsActiveCat] || settingsActiveCat}</span>
                        </div>
                        {!['fruit', 'veg', 'meat', 'dairy', 'pantry', 'cleaning', 'home', 'snacks', 'frozen', 'processed', 'drinks', 'other'].includes(settingsActiveCat) && (
                            <button onClick={() => { if (confirm(t.deleteCategory + '?')) { removeCategory(settingsActiveCat); setSettingsActiveCat('fruit'); } }} className="flex items-center gap-1 text-[10px] font-bold text-red-400 hover:text-red-500 transition-colors uppercase tracking-tighter">
                                <Trash2 size={12} /> {t.deleteCategory}
                            </button>
                        )}
                    </div>

                    <div className="relative mb-4">
                        <input
                            type="text"
                            value={settingsNewItemVal}
                            onChange={(e) => setSettingsNewItemVal(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleAddSettingsItem()}
                            placeholder={t.placeholder}
                            className="w-full bg-slate-50 dark:bg-darkSurface border border-slate-100 dark:border-slate-800 rounded-xl pl-4 pr-12 py-3 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:text-white font-bold transition-all"
                        />
                        <button
                            onClick={handleAddSettingsItem}
                            disabled={!settingsNewItemVal.trim()}
                            className="absolute right-2 top-2 w-8 h-8 rounded-lg bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white flex items-center justify-center shadow-lg shadow-blue-500/20 transition-all"
                        >
                            <Plus size={16} />
                        </button>
                    </div>

                    <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto no-scrollbar pt-1">
                        {categories[settingsActiveCat].items.map((item, idx) => {
                            const style = categoryStyles[settingsActiveCat] || categoryStyles['other'];
                            return (
                                <div key={idx} className="group relative">
                                    <span className={`inline-flex items-center px-2.5 py-1.5 rounded-lg text-[10px] font-bold border transition-all ${style.pill} pr-7`}>
                                        {getLocalizedItemName(item, lang)}
                                    </span>
                                    <button
                                        onClick={() => removeCategoryItem(settingsActiveCat, idx)}
                                        className="absolute right-1.5 top-1.5 text-slate-400 hover:text-red-500 transition-colors"
                                    >
                                        <X size={12} />
                                    </button>
                                </div>
                            )
                        })}
                        {categories[settingsActiveCat].items.length === 0 && (
                            <div className="w-full flex flex-col items-center justify-center py-6 text-slate-300 dark:text-slate-600">
                                <Package size={24} className="mb-2 opacity-50" />
                                <span className="text-[10px] font-bold uppercase tracking-widest">{t.empty}</span>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );

    const renderOtherTab = () => (
        <div className="space-y-4 animate-fade-in">
            {/* Theme Selector (4-way switch) */}
            <div className="space-y-2">
                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">{t.theme}</h4>
                <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl relative">
                    <div
                        className={`absolute top-1 bottom-1 w-[calc(25%-4px)] bg-white dark:bg-slate-600 rounded-lg shadow-sm transition-transform duration-300 ease-out z-0 ${theme === 'light' ? 'translate-x-0' :
                            theme === 'dark' ? 'translate-x-[100%] ml-1' :
                                theme === 'amoled' ? 'translate-x-[200%] ml-2' :
                                    'translate-x-[300%] ml-3'
                            }`}
                    ></div>
                    <button
                        onClick={() => { setTheme('light'); triggerHaptic(10); }}
                        className={`flex-1 relative z-10 py-2 rounded-lg flex flex-col items-center gap-0.5 transition-colors ${theme === 'light' ? 'text-blue-600' : 'text-slate-400'}`}
                    >
                        <Sun size={16} />
                        <span className="text-[9px] font-bold uppercase">{t.themeLight}</span>
                    </button>
                    <button
                        onClick={() => { setTheme('dark'); triggerHaptic(10); }}
                        className={`flex-1 relative z-10 py-2 rounded-lg flex flex-col items-center gap-0.5 transition-colors ${theme === 'dark' ? 'text-blue-400' : 'text-slate-400'}`}
                    >
                        <Moon size={16} />
                        <span className="text-[9px] font-bold uppercase">{t.themeDark}</span>
                    </button>
                    <button
                        onClick={() => { setTheme('amoled'); triggerHaptic(10); }}
                        className={`flex-1 relative z-10 py-2 rounded-lg flex flex-col items-center gap-0.5 transition-colors ${theme === 'amoled' ? 'text-purple-400' : 'text-slate-400'}`}
                    >
                        <div className="w-4 h-4 rounded-full bg-black border border-slate-700"></div>
                        <span className="text-[9px] font-bold uppercase">{t.themeAmoled}</span>
                    </button>
                    <button
                        onClick={() => { setTheme('auto'); triggerHaptic(10); }}
                        className={`flex-1 relative z-10 py-2 rounded-lg flex flex-col items-center gap-0.5 transition-colors ${theme === 'auto' ? 'text-slate-800 dark:text-white' : 'text-slate-400'}`}
                    >
                        <Settings2 size={16} />
                        <span className="text-[9px] font-bold uppercase">Auto</span>
                    </button>
                </div>
            </div>

            {/* Language Selector (Moved here) */}
            <div className="space-y-2">
                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Language</h4>
                <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl relative">
                    {['ca', 'es', 'en'].map((l) => (
                        <button
                            key={l}
                            onClick={() => { setLang(l as any); triggerHaptic(10); }}
                            className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all ${lang === l ? 'bg-white dark:bg-slate-600 text-blue-600 dark:text-white shadow-sm' : 'text-slate-400'}`}
                        >
                            {l}
                        </button>
                    ))}
                </div>
            </div>

            {/* Grouped Notifications Section */}
            <div className="bg-slate-50 dark:bg-slate-800/30 rounded-xl p-3 border border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2 mb-3">
                    <div className="w-6 h-6 rounded-md bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center"><Bell size={14} /></div>
                    <h4 className="text-[10px] font-bold text-slate-700 dark:text-slate-200 uppercase tracking-widest">{t.alerts}</h4>
                </div>

                <div className="space-y-3">
                    {/* Notify on Add */}
                    <div className="flex items-center justify-between">
                        <div>
                            <h4 className="text-[11px] font-bold text-slate-800 dark:text-white">{t.notifyAdd}</h4>
                        </div>
                        <button onClick={() => { setNotifyOnAdd(!notifyOnAdd); triggerHaptic(10); }} className={`relative w-9 h-5 rounded-full transition-colors duration-300 ${notifyOnAdd ? 'bg-blue-500' : 'bg-slate-300 dark:bg-slate-700'}`}>
                            <div className={`absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow-md transform transition-transform duration-300 ${notifyOnAdd ? 'translate-x-4' : 'translate-x-0'}`}></div>
                        </button>
                    </div>

                    <div className="h-px bg-slate-100 dark:bg-slate-800"></div>

                    {/* Notify on Check */}
                    <div className="flex items-center justify-between">
                        <div>
                            <h4 className="text-[11px] font-bold text-slate-800 dark:text-white">{t.notifyCheck}</h4>
                        </div>
                        <button onClick={() => { setNotifyOnCheck(!notifyOnCheck); triggerHaptic(10); }} className={`relative w-9 h-5 rounded-full transition-colors duration-300 ${notifyOnCheck ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'}`}>
                            <div className={`absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow-md transform transition-transform duration-300 ${notifyOnCheck ? 'translate-x-4' : 'translate-x-0'}`}></div>
                        </button>
                    </div>
                </div>
            </div>

            {/* Compact System Actions Grid */}
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                {/* Export */}
                <button onClick={exportData} className="flex items-center justify-center gap-2 p-3 bg-white dark:bg-darkSurface border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition">
                    <Download size={14} className="text-blue-500" />
                    <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300">{t.export}</span>
                </button>

                {/* Import */}
                <label className="flex items-center justify-center gap-2 p-3 bg-white dark:bg-darkSurface border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer">
                    <Upload size={14} className="text-green-500" />
                    <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300">{t.import}</span>
                    <input type="file" className="hidden" accept=".json" onChange={handleImportData} />
                </label>

                {/* Force Update */}
                <button
                    onClick={() => {
                        triggerHaptic(10);
                        window.location.reload();
                    }}
                    className="flex items-center justify-center gap-2 p-3 bg-slate-100 dark:bg-slate-800 rounded-xl hover:bg-slate-200 transition"
                >
                    <RefreshCw size={14} className="text-slate-500" />
                    <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400">Reload</span>
                </button>

                {/* Reset */}
                <button onClick={() => { if (confirm(t.resetBtn + '?')) { resetDefaults(); onClose(); } }} className="flex items-center justify-center gap-2 p-3 bg-red-50 dark:bg-red-900/10 rounded-xl hover:bg-red-100 transition">
                    <Trash2 size={14} className="text-red-500" />
                    <span className="text-[10px] font-bold text-red-600 dark:text-red-400">{t.resetBtn}</span>
                </button>
            </div>

            {/* Install App Button - Full Width */}
            {installPrompt && (
                <button
                    onClick={() => {
                        installPrompt.prompt();
                        installPrompt.userChoice.then((choiceResult: any) => {
                            if (choiceResult.outcome === 'accepted') {
                                onInstall?.();
                            }
                        });
                        triggerHaptic(10);
                    }}
                    className="w-full py-3 rounded-xl bg-blue-600 text-white text-xs font-bold flex items-center justify-center gap-2 hover:bg-blue-700 transition shadow-lg shadow-blue-500/20"
                >
                    <Download size={14} /> {t.installApp}
                </button>
            )}
        </div>
    );

    const [updateAvailable, setUpdateAvailable] = useState<string | null>(null);
    const [updateUrl, setUpdateUrl] = useState<string | null>(null);

    useEffect(() => {
        if (activeTab === 'about') {
            fetch('https://api.github.com/repos/borborborja/shoplist/releases/latest')
                .then(res => res.json())
                .then(data => {
                    const currentVersion = import.meta.env.VITE_APP_VERSION || '0.0.0';
                    const latestVersion = data.tag_name?.replace('v', '') || '0.0.0';

                    // Simple version comparison (semver-like)
                    const isNewer = latestVersion.localeCompare(currentVersion, undefined, { numeric: true, sensitivity: 'base' }) > 0;

                    if (isNewer) {
                        setUpdateAvailable(latestVersion);
                        // Find the .apk asset
                        const apkAsset = data.assets?.find((a: any) => a.name.endsWith('.apk'));
                        if (apkAsset) {
                            setUpdateUrl(apkAsset.browser_download_url);
                        } else {
                            setUpdateUrl(data.html_url); // Fallback to release page
                        }
                    }
                })
                .catch(err => console.error('Failed to check for updates', err));
        }
    }, [activeTab]);

    const renderAboutTab = () => (
        <div className="space-y-8 py-4 animate-fade-in flex flex-col items-center text-center">
            <div
                onClick={handleAboutClick}
                className="w-24 h-24 flex items-center justify-center overflow-hidden rounded-[2rem] animate-pop cursor-pointer active:scale-90 transition-transform shadow-lg hover:shadow-xl"
            >
                <img src="/icon.png" alt="Logo" className="w-full h-full object-cover rounded-[2rem]" />
            </div>

            <div className="space-y-1">
                <h2 className="text-2xl font-bold text-slate-800 dark:text-white">ShoppingList</h2>
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{t.aboutDev}</p>
            </div>

            {updateAvailable && updateUrl && (
                <a
                    href={updateUrl}
                    className="flex items-center gap-2 px-4 py-2 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-xl border border-green-200 dark:border-green-800 animate-bounce"
                    target="_blank"
                    rel="noopener noreferrer"
                >
                    <Download size={16} />
                    <span className="text-xs font-bold">New Version {updateAvailable} Available!</span>
                </a>
            )}

            <div className="flex flex-col gap-3 w-content">
                <a
                    href="https://github.com/borborborja/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-6 py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-2xl text-slate-700 dark:text-slate-300 transition-all active:scale-95 group"
                >
                    <div className="w-8 h-8 rounded-full bg-white dark:bg-slate-900 flex items-center justify-center shadow-sm group-hover:rotate-12 transition-transform">
                        <Database size={16} className="text-slate-700 dark:text-slate-300" />
                    </div>
                    <span className="font-bold text-sm tracking-wide">{t.aboutProject}</span>
                </a>

                <a
                    href="https://buymeacoffee.com/borborbor"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-6 py-3 bg-amber-100 dark:bg-amber-900/30 hover:bg-amber-200 dark:hover:bg-amber-900/50 rounded-2xl text-amber-700 dark:text-amber-300 transition-all active:scale-95 group border border-amber-200 dark:border-amber-800/50"
                >
                    <div className="w-8 h-8 rounded-full bg-white dark:bg-amber-900 flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform text-lg">
                        ☕
                    </div>
                    <span className="font-bold text-sm tracking-wide">{t.support}</span>
                </a>
            </div>

            <div className="pt-4 opacity-50 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                v{import.meta.env.VITE_APP_VERSION || '1.0.0'}
            </div>

            {showDedication && (
                <div className="mt-4 p-4 bg-gradient-to-r from-pink-50 to-rose-50 dark:from-pink-900/20 dark:to-rose-900/20 rounded-2xl border border-pink-100 dark:border-pink-800/30 animate-pop">
                    <p className="text-xs font-bold text-pink-500 dark:text-pink-400 text-center flex flex-col gap-1">
                        <span>❤️ Dedicat a l'Alba, en Blai i en Lluc 🫶</span>
                    </p>
                </div>
            )}
        </div>
    );

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose}></div>
            <div className="relative w-full max-w-md mx-4 bg-white dark:bg-darkSurface rounded-2xl shadow-2xl flex flex-col h-[85vh] sm:h-[600px] animate-pop ring-1 ring-white/10 overflow-hidden">
                {/* Header - Fixed */}
                <div className="flex justify-between items-center p-6 pb-4 shrink-0 z-10 bg-white dark:bg-darkSurface">
                    <h3 className="text-xl font-bold text-slate-800 dark:text-white">{t.settings}</h3>
                    <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-500"><X size={18} /></button>
                </div>

                {/* Tab Bar - Fixed */}
                <div className="px-6 pb-2 shrink-0 z-10 bg-white dark:bg-darkSurface">
                    <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl">
                        <button onClick={() => { setActiveTab('account'); triggerHaptic(10); }} className={`flex-1 py-2 px-2 rounded-xl text-[10px] sm:text-xs font-bold transition-all flex items-center justify-center gap-1 ${activeTab === 'account' ? 'bg-white dark:bg-slate-700 text-blue-600 shadow-[0_2px_8px_-2px_rgba(37,99,235,0.2)]' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>
                            <Server size={14} /> <span className="hidden xs:inline">{t.tabAccount}</span>
                        </button>
                        <button onClick={() => { setActiveTab('catalog'); triggerHaptic(10); }} className={`flex-1 py-2 px-2 rounded-xl text-[10px] sm:text-xs font-bold transition-all flex items-center justify-center gap-1 ${activeTab === 'catalog' ? 'bg-white dark:bg-slate-700 text-amber-600 shadow-[0_2px_8px_-2px_rgba(217,119,6,0.2)]' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>
                            <Package size={14} /> <span className="hidden xs:inline">{t.tabCatalog}</span>
                        </button>
                        <button onClick={() => { setActiveTab('other'); triggerHaptic(10); }} className={`flex-1 py-2 px-2 rounded-xl text-[10px] sm:text-xs font-bold transition-all flex items-center justify-center gap-1 ${activeTab === 'other' ? 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 shadow-[0_2px_8px_-2px_rgba(100,116,139,0.2)]' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>
                            <Settings2 size={14} /> <span className="hidden xs:inline">{t.tabOther}</span>
                        </button>
                        <button
                            onClick={() => {
                                setActiveTab('about');
                                triggerHaptic(10);
                            }}
                            className={`flex-1 py-2 px-2 rounded-xl text-[10px] sm:text-xs font-bold transition-all flex items-center justify-center gap-1 ${activeTab === 'about' ? 'bg-white dark:bg-slate-700 text-purple-600 shadow-[0_2px_8px_-2px_rgba(147,51,234,0.2)]' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                        >
                            <AlertCircle size={14} /> <span className="hidden xs:inline">{t.tabAbout}</span>
                        </button>
                    </div>
                </div>

                {/* Tab Content - Scrollable */}
                <div className="flex-1 overflow-y-auto px-6 pb-6 pt-2">
                    {activeTab === 'account' && renderAccountTab()}
                    {activeTab === 'catalog' && renderCatalogTab()}
                    {activeTab === 'other' && renderOtherTab()}
                    {activeTab === 'about' && renderAboutTab()}
                </div>
            </div>
        </div>
    );
};

export default SettingsModal;
