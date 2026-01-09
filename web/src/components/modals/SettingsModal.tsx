import { useState } from 'react';
import { X, Server, Moon, Download, Upload, Trash2, Plus, Copy, LogOut, Package, Settings2, Bell, RefreshCw, History, RotateCw, Send, MessageCircle, Database, Check, Sun, AlertCircle, Wifi } from 'lucide-react';
import { useShopStore } from '../../store/shopStore';
import { translations, categoryStyles, EMOJI_LIST } from '../../data/constants';
import { pb, isNativePlatform, reinitializePocketBase } from '../../lib/pocketbase';
import PocketBase from 'pocketbase';
import { getLocalizedItemName } from '../../utils/helpers';
import type { LocalizedItem, SettingsTab } from '../../types';
import { useScrollLock } from '../../hooks/useScrollLock';

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
        items, resetDefaults, importData,
        sync, setSyncState, syncFromRemote, addToSyncHistory,
        auth, setUsername
    } = useShopStore();
    const t = translations[lang];

    useScrollLock(true);

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
    const [connectionStatus, setConnectionStatus] = useState<{ msg: string; type: 'success' | 'error' | 'loading' | '' }>({ msg: '', type: '' });

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
            } catch {
                // If we can't read config, assume it's ok (older server version)
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
    const [pendingSyncRecord, setPendingSyncRecord] = useState<{ id: string; code: string; data: { items: any[]; categories: any } } | null>(null);

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
            finishConnection(record.id, code, remoteData.items.length > 0 ? remoteData : { items, categories });
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
            const remoteItems = data.items || [];
            const localItemIds = new Set(items.map((i: any) => i.id));
            const mergedItems = [...items, ...remoteItems.filter((i: any) => !localItemIds.has(i.id))];
            finishConnection(id, code, { items: mergedItems, categories: data.categories || categories });
        }
        setPendingSyncRecord(null);
    };

    const finishConnection = (recordId: string, code: string, data: { items: any[]; categories: any }) => {
        syncFromRemote({ items: data.items || [], categories: data.categories || undefined });
        setSyncState({ connected: true, code, recordId, msg: 'Connected', msgType: 'success' });
        addToSyncHistory(code);
        localStorage.setItem('shopListSyncCode', code);

        // Push merged/synced data to remote
        pb.collection('shopping_lists').update(recordId, { data: { items: data.items, categories: data.categories } }).catch(console.error);

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
            record = await pb.collection('shopping_lists').create({ list_code: newCode, data: { items, categories } });
        } catch (err: any) {
            console.error('Error creating list:', err);
            const msg = err?.response?.message || err?.data?.message || err?.message || 'Unknown error';
            alert(`Error creating list: ${msg}`);
            return;
        }

        // Step 2: Finish connection (this should not throw to user)
        try {
            finishConnection(record.id, newCode, { items, categories });
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
            await pb.collection('shopping_lists').update(sync.recordId, { data: { items, categories } });
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
        const blob = new Blob([JSON.stringify({ items, categories })], { type: "application/json" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `ShopList_Backup_${new Date().toISOString().slice(0, 10)}.json`;
        link.click();
    };
    const handleImportData = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const data = JSON.parse(ev.target?.result as string);
                if (confirm(t.resetBtn + '?')) { importData(data.items || data, data.categories); onClose(); }
            } catch { alert('Error reading file'); }
        };
        reader.readAsText(file);
    };

    // --- Tab Render ---
    const renderAccountTab = () => (
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
                        Introduce la URL de tu servidor ShopList para sincronizar.
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
            <div className="bg-blue-50 dark:bg-blue-900/10 p-4 rounded-xl border border-blue-100 dark:border-blue-800/30">
                <h4 className="text-xs font-bold text-blue-500 uppercase mb-3 tracking-wider flex items-center gap-2"><Server size={12} /> {t.sync}</h4>
                {sync.msg && <div className={`text-xs mb-2 font-mono ${sync.msgType === 'error' ? 'text-red-500' : sync.msgType === 'success' ? 'text-green-500' : 'text-blue-400'}`}>{sync.msg}</div>}

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
                        <button onClick={createSharedList} className="w-full mb-3 bg-white dark:bg-darkSurface border border-blue-200 dark:border-blue-700 text-blue-600 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5"><Plus size={12} /> {t.createList}</button>
                        <div className="flex gap-2 mb-3">
                            <input type="text" value={syncInputCode} onChange={(e) => setSyncInputCode(e.target.value)} placeholder="CODE..." className="flex-grow bg-white dark:bg-darkSurface border border-slate-200 dark:border-slate-700 rounded-xl px-3 text-xs focus:outline-none dark:text-white uppercase tracking-widest font-mono text-center" />
                            <button onClick={() => connectSync(syncInputCode.toUpperCase())} className="bg-slate-800 text-white px-4 py-2.5 rounded-xl font-bold text-xs">{t.join}</button>
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
                                        const text = encodeURIComponent(`¡Únete a mi lista de la compra en ShopList!\nCódigo: ${sync.code}\nEnlace directo: ${window.location.origin}/?c=${sync.code}`);
                                        window.open(`https://wa.me/?text=${text}`, '_blank');
                                    }}
                                    className="text-slate-400 hover:text-green-500 p-1.5 transition-colors"
                                    title="WhatsApp"
                                >
                                    <MessageCircle size={14} />
                                </button>
                                <button
                                    onClick={() => {
                                        const text = encodeURIComponent(`ShopList: Lista compartida`);
                                        const url = encodeURIComponent(`${window.location.origin}/?c=${sync.code}`);
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
                                    className="w-full flex items-center justify-between px-3 py-2 bg-white dark:bg-darkSurface border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono font-bold text-slate-600 dark:text-slate-400 hover:border-blue-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/10 transition group"
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
                                    onClick={() => { setSettingsActiveCat(key); if (navigator.vibrate) navigator.vibrate(10); }}
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
                            onClick={() => { setIsCreatingCat(true); if (navigator.vibrate) navigator.vibrate(10); }}
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
                                                onClick={() => { setNewCatIcon(emoji); if (navigator.vibrate) navigator.vibrate(10); }}
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
        <div className="space-y-6 animate-fade-in">
            {/* Theme Selector (3-way switch) */}
            <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest pl-1">{t.theme}</h4>
                <div className="flex bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl relative">
                    <div
                        className={`absolute top-1.5 bottom-1.5 w-[calc(33.33%-4px)] bg-white dark:bg-slate-600 rounded-xl shadow-lg transition-transform duration-300 ease-out z-0 h-[calc(100%-12px)] ${theme === 'light' ? 'translate-x-0' :
                            theme === 'dark' ? 'translate-x-full ml-1' :
                                'translate-x-[200%] ml-2'
                            }`}
                    ></div>
                    <button
                        onClick={() => { setTheme('light'); if (navigator.vibrate) navigator.vibrate(10); }}
                        className={`flex-1 relative z-10 py-3 rounded-xl flex flex-col items-center gap-1 transition-colors ${theme === 'light' ? 'text-blue-600' : 'text-slate-400'}`}
                    >
                        <Sun size={18} />
                        <span className="text-[10px] font-bold uppercase">{t.themeLight}</span>
                    </button>
                    <button
                        onClick={() => { setTheme('dark'); if (navigator.vibrate) navigator.vibrate(10); }}
                        className={`flex-1 relative z-10 py-3 rounded-xl flex flex-col items-center gap-1 transition-colors ${theme === 'dark' ? 'text-blue-400' : 'text-slate-400'}`}
                    >
                        <Moon size={18} />
                        <span className="text-[10px] font-bold uppercase">{t.themeDark}</span>
                    </button>
                    <button
                        onClick={() => { setTheme('amoled'); if (navigator.vibrate) navigator.vibrate(10); }}
                        className={`flex-1 relative z-10 py-3 rounded-xl flex flex-col items-center gap-1 transition-colors ${theme === 'amoled' ? 'text-purple-400' : 'text-slate-400'}`}
                    >
                        <div className="w-4.5 h-4.5 rounded-full bg-black border border-slate-700"></div>
                        <span className="text-[10px] font-bold uppercase">{t.themeAmoled}</span>
                    </button>
                </div>
            </div>

            {/* Grouped Notifications Section */}
            <div className="bg-slate-50 dark:bg-slate-800/30 rounded-2xl p-4 border border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2 mb-4">
                    <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center"><Bell size={16} /></div>
                    <h4 className="text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-widest">{t.alerts}</h4>
                </div>

                <div className="space-y-4">
                    {/* Notify on Add */}
                    <div className="flex items-center justify-between">
                        <div>
                            <h4 className="text-xs font-bold text-slate-800 dark:text-white">{t.notifyAdd}</h4>
                            <p className="text-[10px] text-slate-500">Al añadir productos nuevos</p>
                        </div>
                        <button onClick={() => { setNotifyOnAdd(!notifyOnAdd); if (navigator.vibrate) navigator.vibrate(10); }} className={`relative w-11 h-6 rounded-full transition-colors duration-300 ${notifyOnAdd ? 'bg-blue-500' : 'bg-slate-300 dark:bg-slate-700'}`}>
                            <div className={`absolute left-1 top-1 w-4 h-4 bg-white rounded-full shadow-md transform transition-transform duration-300 ${notifyOnAdd ? 'translate-x-5' : 'translate-x-0'}`}></div>
                        </button>
                    </div>

                    <div className="h-px bg-slate-100 dark:bg-slate-800"></div>

                    {/* Notify on Check */}
                    <div className="flex items-center justify-between">
                        <div>
                            <h4 className="text-xs font-bold text-slate-800 dark:text-white">{t.notifyCheck}</h4>
                            <p className="text-[10px] text-slate-500">Al marcar productos como comprados</p>
                        </div>
                        <button onClick={() => { setNotifyOnCheck(!notifyOnCheck); if (navigator.vibrate) navigator.vibrate(10); }} className={`relative w-11 h-6 rounded-full transition-colors duration-300 ${notifyOnCheck ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'}`}>
                            <div className={`absolute left-1 top-1 w-4 h-4 bg-white rounded-full shadow-md transform transition-transform duration-300 ${notifyOnCheck ? 'translate-x-5' : 'translate-x-0'}`}></div>
                        </button>
                    </div>
                </div>
            </div>

            {/* Data Backup */}
            <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest pl-1">{t.data}</h4>
                <div className="grid grid-cols-2 gap-3">
                    <button onClick={exportData} className="group flex flex-col items-center justify-center p-4 border-2 border-slate-100 dark:border-slate-800 rounded-2xl hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-all bg-white dark:bg-darkSurface shadow-sm">
                        <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-600 flex items-center justify-center mb-2 group-hover:scale-110 transition"><Download size={20} /></div>
                        <span className="text-xs font-bold text-slate-600 dark:text-slate-300">{t.export}</span>
                    </button>
                    <label className="group flex flex-col items-center justify-center p-4 border-2 border-slate-100 dark:border-slate-800 rounded-2xl hover:border-green-400 hover:bg-green-50 dark:hover:bg-green-900/10 transition-all bg-white dark:bg-darkSurface shadow-sm cursor-pointer">
                        <div className="w-10 h-10 rounded-full bg-green-50 dark:bg-green-900/30 text-green-600 flex items-center justify-center mb-2 group-hover:scale-110 transition"><Upload size={20} /></div>
                        <span className="text-xs font-bold text-slate-600 dark:text-slate-300">{t.import}</span>
                        <input type="file" className="hidden" accept=".json" onChange={handleImportData} />
                    </label>
                </div>
            </div>

            {/* System Actions Area */}
            {/* Compact System & PWA Area */}
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
                <div className="flex gap-2">
                    <div className="flex-1 bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl flex relative">
                        {/* Language Selector */}
                        {['ca', 'es', 'en'].map((l) => (
                            <button
                                key={l}
                                onClick={() => { setLang(l as any); if (navigator.vibrate) navigator.vibrate(10); }}
                                className={`flex-1 py-2 rounded-xl text-[10px] font-bold uppercase transition-all ${lang === l ? 'bg-white dark:bg-slate-600 text-blue-600 dark:text-white shadow-sm' : 'text-slate-400'}`}
                            >
                                {l}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Install App Button - Discrete */}
                {installPrompt && (
                    <button
                        onClick={() => {
                            installPrompt.prompt();
                            installPrompt.userChoice.then((choiceResult: any) => {
                                if (choiceResult.outcome === 'accepted') {
                                    onInstall?.();
                                }
                            });
                            if (navigator.vibrate) navigator.vibrate(10);
                        }}
                        className="w-full py-3 rounded-xl border border-blue-200 dark:border-blue-800/30 text-blue-600 dark:text-blue-400 text-xs font-bold flex items-center justify-center gap-2 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition"
                    >
                        <Download size={14} /> {t.installApp}
                    </button>
                )}

                <div className="grid grid-cols-2 gap-2">
                    <button
                        onClick={() => {
                            if ('serviceWorker' in navigator) {
                                navigator.serviceWorker.getRegistrations().then(registrations => {
                                    for (let registration of registrations) registration.unregister();
                                    window.location.reload();
                                });
                            } else {
                                window.location.reload();
                            }
                        }}
                        className="flex items-center justify-center gap-1.5 p-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-bold text-[10px] transition hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-700 dark:hover:text-slate-200"
                    >
                        <RefreshCw size={12} /> Force Update
                    </button>

                    <button onClick={() => { if (confirm(t.resetBtn + '?')) { resetDefaults(); onClose(); } }} className="text-[10px] font-bold text-red-400 hover:text-red-500 bg-slate-100 dark:bg-slate-800 hover:bg-red-50 dark:hover:bg-red-900/10 p-3 rounded-xl transition flex items-center justify-center gap-1.5">
                        <Trash2 size={12} /> {t.resetBtn}
                    </button>
                </div>
            </div>
        </div>
    );

    const renderAboutTab = () => (
        <div className="space-y-8 py-4 animate-fade-in flex flex-col items-center text-center">
            <div className="w-24 h-24 flex items-center justify-center overflow-hidden rounded-[2rem] animate-pop">
                <img src="/icon.png" alt="Logo" className="w-full h-full object-cover rounded-[2rem]" />
            </div>

            <div className="space-y-1">
                <h2 className="text-2xl font-bold text-slate-800 dark:text-white">ShopList</h2>
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{t.aboutDev}</p>
            </div>

            <div className="flex flex-col gap-3 w-content">
                <a
                    href="https://github.com/borjabalsera/llista_compra"
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
        </div>
    );

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose}></div>
            <div className="relative w-11/12 max-w-md bg-white dark:bg-darkSurface rounded-2xl shadow-2xl p-6 animate-pop overflow-y-auto max-h-[90vh] ring-1 ring-white/10">
                {/* Header */}
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold text-slate-800 dark:text-white">{t.settings}</h3>
                    <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-500"><X size={18} /></button>
                </div>

                {/* Tab Bar */}
                <div className="flex gap-1 mb-6 bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl">
                    <button onClick={() => { setActiveTab('account'); if (navigator.vibrate) navigator.vibrate(10); }} className={`flex-1 py-1.5 px-2 rounded-xl text-[10px] sm:text-xs font-bold transition-all flex items-center justify-center gap-1 ${activeTab === 'account' ? 'bg-white dark:bg-slate-700 text-blue-600 shadow-lg shadow-blue-500/10' : 'text-slate-500'}`}>
                        <Server size={14} /> <span className="hidden xs:inline">{t.tabAccount}</span>
                    </button>
                    <button onClick={() => { setActiveTab('catalog'); if (navigator.vibrate) navigator.vibrate(10); }} className={`flex-1 py-1.5 px-2 rounded-xl text-[10px] sm:text-xs font-bold transition-all flex items-center justify-center gap-1 ${activeTab === 'catalog' ? 'bg-white dark:bg-slate-700 text-amber-600 shadow-lg shadow-amber-500/10' : 'text-slate-500'}`}>
                        <Package size={14} /> <span className="hidden xs:inline">{t.tabCatalog}</span>
                    </button>
                    <button onClick={() => { setActiveTab('other'); if (navigator.vibrate) navigator.vibrate(10); }} className={`flex-1 py-1.5 px-2 rounded-xl text-[10px] sm:text-xs font-bold transition-all flex items-center justify-center gap-1 ${activeTab === 'other' ? 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 shadow-lg shadow-slate-500/10' : 'text-slate-500'}`}>
                        <Settings2 size={14} /> <span className="hidden xs:inline">{t.tabOther}</span>
                    </button>
                    <button onClick={() => { setActiveTab('about'); if (navigator.vibrate) navigator.vibrate(10); }} className={`flex-1 py-1.5 px-2 rounded-xl text-[10px] sm:text-xs font-bold transition-all flex items-center justify-center gap-1 ${activeTab === 'about' ? 'bg-white dark:bg-slate-700 text-purple-600 shadow-lg shadow-purple-500/10' : 'text-slate-500'}`}>
                        <AlertCircle size={14} /> <span className="hidden xs:inline">{t.tabAbout}</span>
                    </button>
                </div>

                {/* Tab Content */}
                {activeTab === 'account' && renderAccountTab()}
                {activeTab === 'catalog' && renderCatalogTab()}
                {activeTab === 'other' && renderOtherTab()}
                {activeTab === 'about' && renderAboutTab()}
            </div>
        </div>
    );
};

export default SettingsModal;
