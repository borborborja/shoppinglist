import { useState } from 'react';
import { X, Server, Moon, Download, Upload, Trash2, Plus, Copy, LogOut, Package, Settings2, Bell, RefreshCw, History, RotateCw, Send, MessageCircle } from 'lucide-react';
import { useShopStore } from '../../store/shopStore';
import { translations, categoryStyles } from '../../data/constants';
import { pb } from '../../lib/pocketbase';
import { getLocalizedItemName } from '../../utils/helpers';
import type { LocalizedItem, SettingsTab } from '../../types';

interface SettingsModalProps {
    onClose: () => void;
}

const SettingsModal = ({ onClose }: SettingsModalProps) => {
    const {
        lang, isDark, isAmoled, toggleTheme, toggleAmoled,
        notifyOnAdd, notifyOnCheck, setNotifyOnAdd, setNotifyOnCheck,
        categories, addCategoryItem, removeCategoryItem, addCategory, removeCategory,
        items, resetDefaults, importData,
        sync, setSyncState, syncFromRemote, addToSyncHistory
    } = useShopStore();
    const t = translations[lang];

    const [activeTab, setActiveTab] = useState<SettingsTab>('account');
    const [settingsActiveCat, setSettingsActiveCat] = useState<string>('fruit');
    const [settingsNewItemVal, setSettingsNewItemVal] = useState('');
    const [syncInputCode, setSyncInputCode] = useState('');



    // Category Creator State
    const [newCatKey, setNewCatKey] = useState('');
    const [newCatIcon, setNewCatIcon] = useState('📦');

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

        // Subscribe to updates (but don't overwrite local immediately on update - use a flag)
        pb.collection('shopping_lists').unsubscribe('*');
        pb.collection('shopping_lists').subscribe(recordId, (e) => {
            if (e.action === 'delete') { disconnectSync(); }
            // Remote updates handled by App.tsx sync logic
        });
    };

    const createSharedList = async () => {
        if (!navigator.onLine) return alert('Offline');
        const newCode = Math.random().toString(36).substring(2, 8).toUpperCase();
        try {
            const record = await pb.collection('shopping_lists').create({ list_code: newCode, data: { items, categories } });
            finishConnection(record.id, newCode, { items, categories });
        } catch { alert('Error creating list'); }
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
            {/* Brand Identity */}
            <div className="flex flex-col items-center justify-center py-2 animate-pop">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-blue-500/20 overflow-hidden p-2.5 mb-2">
                    <img src="/pwa-512x512.png" alt="Logo" className="w-full h-full object-contain rounded-xl" />
                </div>
                <h2 className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400">ShopList</h2>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-[0.2em]">{t.appTitle}</p>
            </div>

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

    const renderProductsTab = () => (
        <div className="space-y-6 animate-fade-in">
            {/* Category Creator */}
            <div className="bg-amber-50 dark:bg-amber-900/10 p-4 rounded-xl border border-amber-100 dark:border-amber-800/30">
                <h4 className="text-xs font-bold text-amber-600 uppercase mb-3 tracking-wider">{t.newCategory}</h4>
                <div className="flex gap-2 items-center">
                    <input type="text" value={newCatIcon} onChange={(e) => setNewCatIcon(e.target.value)} className="w-12 text-center bg-white dark:bg-darkSurface border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 text-lg focus:outline-none" maxLength={2} />
                    <input type="text" value={newCatKey} onChange={(e) => setNewCatKey(e.target.value)} placeholder={t.categoryName} className="flex-grow bg-white dark:bg-darkSurface border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs focus:outline-none dark:text-white" />
                    <button onClick={handleAddCategory} className="bg-amber-500 hover:bg-amber-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold"><Plus size={12} /></button>
                </div>
            </div>

            {/* Existing Catalog Management */}
            <div>
                <h4 className="text-xs font-bold text-slate-400 uppercase mb-3 tracking-wider">{t.manageCatalog}</h4>
                <div className="flex flex-wrap gap-2 mb-4 pb-1">
                    {Object.entries(categories).map(([key, cat]) => {
                        const isActive = settingsActiveCat === key;
                        const style = categoryStyles[key] || categoryStyles['other'];
                        return (
                            <button key={key} onClick={() => setSettingsActiveCat(key)} className={`flex-shrink-0 px-2.5 py-1.5 rounded-lg text-xs font-bold border transition flex items-center gap-1.5 whitespace-nowrap ${isActive ? style.active : 'bg-slate-50 dark:bg-slate-800/50 text-slate-400 border-slate-200 dark:border-slate-700'}`}>
                                <span>{cat.icon}</span> <span>{(t.cats as Record<string, string>)[key] || key}</span>
                            </button>
                        )
                    })}
                </div>

                {settingsActiveCat && categories[settingsActiveCat] && (
                    <div className="bg-slate-50 dark:bg-slate-900/30 rounded-xl p-3 border border-slate-100 dark:border-slate-700/50">
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-xs font-bold text-slate-500">{categories[settingsActiveCat].icon} {(t.cats as Record<string, string>)[settingsActiveCat] || settingsActiveCat}</span>
                            {!['fruit', 'veg', 'meat', 'dairy', 'pantry', 'cleaning', 'home', 'snacks', 'frozen', 'processed', 'drinks', 'other'].includes(settingsActiveCat) && (
                                <button onClick={() => { removeCategory(settingsActiveCat); setSettingsActiveCat('fruit'); }} className="text-[10px] text-red-500 hover:underline">{t.deleteCategory}</button>
                            )}
                        </div>
                        <div className="flex gap-2 mb-3">
                            <input type="text" value={settingsNewItemVal} onChange={(e) => setSettingsNewItemVal(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAddSettingsItem()} placeholder={t.placeholder} className="flex-grow bg-white dark:bg-darkSurface border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none dark:text-white" />
                            <button onClick={handleAddSettingsItem} className="bg-blue-600 hover:bg-blue-700 text-white px-3 rounded-lg text-xs font-bold"><Plus size={12} /></button>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                            {categories[settingsActiveCat].items.map((item, idx) => {
                                const style = categoryStyles[settingsActiveCat] || categoryStyles['other'];
                                return (
                                    <div key={idx} className="group relative">
                                        <span className={`inline-flex items-center px-2 py-1 rounded-md text-[10px] font-bold border dark:bg-opacity-20 ${style.pill}`}>{getLocalizedItemName(item, lang)}</span>
                                        <button onClick={() => removeCategoryItem(settingsActiveCat, idx)} className="absolute -top-1 -right-1 bg-red-500 text-white w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8px] opacity-0 group-hover:opacity-100 transition shadow-sm z-10"><X size={8} /></button>
                                    </div>
                                )
                            })}
                            {categories[settingsActiveCat].items.length === 0 && <div className="text-[10px] text-slate-400 italic w-full text-center py-2">{t.empty}</div>}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );

    const renderOtherTab = () => (
        <div className="space-y-6 animate-fade-in">
            {/* Theme Toggles */}
            <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-400 uppercase mb-2 tracking-wider">{t.settings}</h4>

                {/* Dark Mode */}
                <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-slate-800 text-white flex items-center justify-center text-sm shadow-sm"><Moon size={16} /></div>
                        <div><h4 className="text-sm font-bold text-slate-800 dark:text-white">{t.settings}</h4><p className="text-[10px] text-slate-500">Dark Mode</p></div>
                    </div>
                    <button onClick={toggleTheme} className={`relative w-11 h-6 rounded-full transition-colors duration-300 ${isDark ? 'bg-blue-600' : 'bg-slate-300'}`}>
                        <div className={`absolute left-1 top-1 w-4 h-4 bg-white rounded-full shadow-md transform transition-transform duration-300 ${isDark ? 'translate-x-5' : 'translate-x-0'}`}></div>
                    </button>
                </div>

                {/* AMOLED Toggle */}
                <div className={`flex items-center justify-between p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 transition-opacity ${!isDark ? 'opacity-50 pointer-events-none' : ''}`}>
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-black text-white flex items-center justify-center text-sm shadow-sm"><Moon size={16} /></div>
                        <div><h4 className="text-sm font-bold text-slate-800 dark:text-white">AMOLED</h4><p className="text-[10px] text-slate-500">Pure Black</p></div>
                    </div>
                    <button onClick={toggleAmoled} className={`relative w-11 h-6 rounded-full transition-colors duration-300 ${isAmoled ? 'bg-slate-700' : 'bg-slate-300'}`}>
                        <div className={`absolute left-1 top-1 w-4 h-4 bg-white rounded-full shadow-md transform transition-transform duration-300 ${isAmoled ? 'translate-x-5' : 'translate-x-0'}`}></div>
                    </button>
                </div>

                {/* Notifications Section */}
                <h4 className="text-xs font-bold text-slate-400 uppercase mt-4 mb-2 tracking-wider">Avisos</h4>

                {/* Notify on Add */}
                <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center text-sm shadow-sm"><Bell size={16} /></div>
                        <div><h4 className="text-sm font-bold text-slate-800 dark:text-white">{t.notifyAdd}</h4></div>
                    </div>
                    <button onClick={() => setNotifyOnAdd(!notifyOnAdd)} className={`relative w-11 h-6 rounded-full transition-colors duration-300 ${notifyOnAdd ? 'bg-blue-500' : 'bg-slate-300'}`}>
                        <div className={`absolute left-1 top-1 w-4 h-4 bg-white rounded-full shadow-md transform transition-transform duration-300 ${notifyOnAdd ? 'translate-x-5' : 'translate-x-0'}`}></div>
                    </button>
                </div>

                {/* Notify on Check */}
                <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-sm shadow-sm"><Bell size={16} /></div>
                        <div><h4 className="text-sm font-bold text-slate-800 dark:text-white">{t.notifyCheck}</h4></div>
                    </div>
                    <button onClick={() => setNotifyOnCheck(!notifyOnCheck)} className={`relative w-11 h-6 rounded-full transition-colors duration-300 ${notifyOnCheck ? 'bg-emerald-500' : 'bg-slate-300'}`}>
                        <div className={`absolute left-1 top-1 w-4 h-4 bg-white rounded-full shadow-md transform transition-transform duration-300 ${notifyOnCheck ? 'translate-x-5' : 'translate-x-0'}`}></div>
                    </button>
                </div>
            </div>

            {/* Data Backup */}
            <div>
                <h4 className="text-xs font-bold text-slate-400 uppercase mb-2 tracking-wider">{t.data}</h4>
                <div className="grid grid-cols-2 gap-3">
                    <button onClick={exportData} className="group flex flex-col items-center justify-center p-3 border border-slate-200 dark:border-slate-700 rounded-xl hover:border-blue-400 hover:bg-blue-50 transition bg-slate-50 dark:bg-slate-800/50">
                        <div className="text-blue-600 mb-1 group-hover:scale-110 transition"><Download size={18} /></div>
                        <span className="text-xs font-bold text-slate-600 dark:text-slate-300">{t.export}</span>
                    </button>
                    <label className="group flex flex-col items-center justify-center p-3 border border-slate-200 dark:border-slate-700 rounded-xl hover:border-green-400 hover:bg-green-50 transition cursor-pointer bg-slate-50 dark:bg-slate-800/50">
                        <div className="text-green-600 mb-1 group-hover:scale-110 transition"><Upload size={18} /></div>
                        <span className="text-xs font-bold text-slate-600 dark:text-slate-300">{t.import}</span>
                        <input type="file" className="hidden" accept=".json" onChange={handleImportData} />
                    </label>
                </div>
            </div>

            {/* Force Update Section */}
            <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
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
                    className="w-full flex items-center justify-center gap-2 p-3 rounded-xl bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 font-bold text-xs transition hover:bg-orange-200 dark:hover:bg-orange-800/50"
                >
                    <RefreshCw size={14} /> Forzar Actualización
                </button>
                <p className="text-[10px] text-slate-500 mt-2 px-1 text-center">Usa esto si Android no carga la última versión (borra el código antiguo y recarga).</p>
            </div>

            {/* Reset */}
            <button onClick={() => { if (confirm(t.resetBtn + '?')) { resetDefaults(); onClose(); } }} className="w-full text-xs font-bold text-red-500 hover:text-red-600 bg-red-50 dark:bg-red-900/10 hover:bg-red-100 p-3 rounded-xl transition mt-4 flex items-center justify-center gap-2">
                <Trash2 size={12} /> {t.resetBtn}
            </button>
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
                <div className="flex gap-1 mb-6 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                    <button onClick={() => setActiveTab('account')} className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${activeTab === 'account' ? 'bg-white dark:bg-slate-700 text-blue-600 shadow-sm' : 'text-slate-500'}`}>
                        <Server size={14} /> {t.tabAccount}
                    </button>
                    <button onClick={() => setActiveTab('products')} className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${activeTab === 'products' ? 'bg-white dark:bg-slate-700 text-amber-600 shadow-sm' : 'text-slate-500'}`}>
                        <Package size={14} /> {t.tabProducts}
                    </button>
                    <button onClick={() => setActiveTab('other')} className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${activeTab === 'other' ? 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 shadow-sm' : 'text-slate-500'}`}>
                        <Settings2 size={14} /> {t.tabOther}
                    </button>
                </div>

                {/* Tab Content */}
                {activeTab === 'account' && renderAccountTab()}
                {activeTab === 'products' && renderProductsTab()}
                {activeTab === 'other' && renderOtherTab()}
            </div>
        </div>
    );
};

export default SettingsModal;
