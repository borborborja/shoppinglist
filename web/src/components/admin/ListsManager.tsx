import { useState, useEffect } from 'react';
import { pb } from '../../lib/pocketbase';
import { Trash2, Loader, RefreshCw, CheckSquare, Square, Ghost, Clock, AlertTriangle, Send, MessageCircle } from 'lucide-react';

interface ShoppingListRecord {
    id: string;
    list_code: string;
    updated: string;
    created: string;
    data: {
        items?: any[];
        categories?: any[];
    };
}

const ListsManager = () => {
    const [lists, setLists] = useState<ShoppingListRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    useEffect(() => {
        loadLists();
    }, []);

    const loadLists = async () => {
        setLoading(true);
        try {
            const result = await pb.collection('shopping_lists').getFullList<ShoppingListRecord>({ sort: '-updated' });
            setLists(result);
            setSelectedIds(new Set());
        } catch (e) {
            console.error(e);
            alert('Error cargando listas');
        } finally {
            setLoading(false);
        }
    };

    const toggleSelect = (id: string) => {
        const newSelected = new Set(selectedIds);
        if (newSelected.has(id)) {
            newSelected.delete(id);
        } else {
            newSelected.add(id);
        }
        setSelectedIds(newSelected);
    };

    const toggleSelectAll = () => {
        if (selectedIds.size === lists.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(lists.map(l => l.id)));
        }
    };

    const handleDelete = async () => {
        if (selectedIds.size === 0) return;
        const count = selectedIds.size;
        if (!confirm(`¿Estás seguro de que quieres borrar ${count} lista${count > 1 ? 's' : ''}? Esta acción es irreversible.`)) return;

        setLoading(true);
        try {
            const promises = Array.from(selectedIds).map(id => pb.collection('shopping_lists').delete(id));
            await Promise.all(promises);
            await loadLists();
        } catch (e) {
            console.error(e);
            alert('Error borrando listas');
            setLoading(false);
        }
    };

    const formatTime = (dateStr: string) => {
        return new Date(dateStr).toLocaleString();
    };

    const isPhantom = (list: ShoppingListRecord) => {
        const itemsCount = list.data?.items?.length || 0;
        const lastUpdate = new Date(list.updated).getTime();
        const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);

        return itemsCount === 0 || lastUpdate < sevenDaysAgo;
    };

    const getPhantomReason = (list: ShoppingListRecord) => {
        const itemsCount = list.data?.items?.length || 0;
        const lastUpdate = new Date(list.updated).getTime();
        const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);

        if (itemsCount === 0) return 'Vacía';
        if (lastUpdate < sevenDaysAgo) return 'Inactiva > 7d';
        return null;
    };

    if (loading && lists.length === 0) return (
        <div className="flex flex-col items-center justify-center p-12 space-y-4">
            <Loader className="animate-spin text-blue-500" size={32} />
            <p className="text-slate-500 font-medium">Cargando listas...</p>
        </div>
    );

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-end">
                <div>
                    <h2 className="text-2xl font-black dark:text-white flex items-center gap-3">
                        Gestor de Listas
                        <button
                            onClick={loadLists}
                            className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors"
                            title="Recargar"
                        >
                            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                        </button>
                    </h2>
                    <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                        Total: <span className="font-bold">{lists.length}</span> |
                        Fantasmas: <span className="font-bold text-orange-500">{lists.filter(isPhantom).length}</span>
                    </p>
                </div>
                <div className="flex gap-3">
                    {selectedIds.size > 0 && (
                        <button
                            onClick={handleDelete}
                            className="flex items-center gap-2 bg-red-600 text-white px-5 py-2.5 rounded-xl hover:bg-red-700 transition-all animate-fade-in shadow-lg shadow-red-500/20 font-bold active:scale-95"
                        >
                            <Trash2 size={18} /> Borrar seleccionadas ({selectedIds.size})
                        </button>
                    )}
                </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-200 dark:border-slate-800 overflow-hidden transition-all">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50/50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
                                <th className="p-4 w-12">
                                    <button
                                        onClick={toggleSelectAll}
                                        className="flex items-center justify-center text-slate-400 hover:text-blue-500 transition-colors"
                                    >
                                        {lists.length > 0 && selectedIds.size === lists.length ?
                                            <CheckSquare size={22} className="text-blue-500" /> :
                                            <Square size={22} />
                                        }
                                    </button>
                                </th>
                                <th className="p-4 text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">Estado / Código</th>
                                <th className="p-4 text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">Items</th>
                                <th className="p-4 text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">Última Actividad</th>
                                <th className="p-4 text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">Creada</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {lists.map(list => {
                                const isSelected = selectedIds.has(list.id);
                                const phantom = isPhantom(list);
                                const reason = getPhantomReason(list);

                                return (
                                    <tr
                                        key={list.id}
                                        className={`group hover:bg-blue-50/30 dark:hover:bg-blue-900/5 transition-colors cursor-pointer ${isSelected ? 'bg-blue-50/80 dark:bg-blue-900/10' : ''}`}
                                        onClick={() => toggleSelect(list.id)}
                                    >
                                        <td className="p-4 text-center">
                                            <div className="flex justify-center transition-transform group-active:scale-90">
                                                {isSelected ?
                                                    <CheckSquare size={22} className="text-blue-500" /> :
                                                    <Square size={22} className="text-slate-300 dark:text-slate-700" />
                                                }
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex items-center gap-3">
                                                {phantom ? (
                                                    <div className="flex items-center gap-1.5 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 px-2 py-1 rounded-md text-[10px] font-bold uppercase" title={`Lista Fantasma: ${reason}`}>
                                                        <Ghost size={12} />
                                                        {reason}
                                                    </div>
                                                ) : (
                                                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                                                )}
                                                <div className="flex flex-col">
                                                    <span className="font-mono font-bold text-slate-900 dark:text-slate-100 uppercase leading-none">
                                                        {list.list_code}
                                                    </span>
                                                    <div className="flex items-center gap-2 mt-1 px-0.5">
                                                        <span className="text-[10px] text-slate-400 font-medium">#{list.id}</span>
                                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-2">
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    const text = encodeURIComponent(`ShopList Code: ${list.list_code}\nLink: ${window.location.origin}/?c=${list.list_code}`);
                                                                    window.open(`https://wa.me/?text=${text}`, '_blank');
                                                                }}
                                                                className="text-slate-400 hover:text-green-500 transition-colors"
                                                                title="Compartir WhatsApp"
                                                            >
                                                                <MessageCircle size={10} />
                                                            </button>
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    const text = encodeURIComponent(`ShopList Code: ${list.list_code}`);
                                                                    const url = encodeURIComponent(`${window.location.origin}/?c=${list.list_code}`);
                                                                    window.open(`https://t.me/share/url?url=${url}&text=${text}`, '_blank');
                                                                }}
                                                                className="text-slate-400 hover:text-sky-500 transition-colors"
                                                                title="Compartir Telegram"
                                                            >
                                                                <Send size={10} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex items-center gap-2">
                                                <div className={`px-2 py-1 rounded-lg text-xs font-bold ${phantom && list.data.items?.length === 0 ? 'bg-slate-100 text-slate-500' : 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'}`}>
                                                    {list.data.items?.length || 0}
                                                </div>
                                                <span className="text-slate-400 text-xs">productos</span>
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                                                <Clock size={14} className="opacity-50" />
                                                <span className="text-sm font-medium">{formatTime(list.updated)}</span>
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <span className="text-slate-400 text-xs font-medium">
                                                {formatTime(list.created)}
                                            </span>
                                        </td>
                                    </tr>
                                );
                            })}
                            {lists.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="p-20 text-center">
                                        <div className="flex flex-col items-center gap-2 text-slate-400">
                                            <Ghost size={48} className="opacity-20" />
                                            <p className="font-bold">No se encontraron listas inactivas.</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 px-6 py-4 rounded-2xl flex items-start gap-3">
                <AlertTriangle className="text-blue-500 mt-1" size={18} />
                <div className="text-sm text-blue-700 dark:text-blue-300 leading-relaxed">
                    <p className="font-black mb-1 leading-none uppercase tracking-tighter">¿Qué es una lista fantasma?</p>
                    Se consideran listas fantasma aquellas que están <strong>vacías</strong> o que no han tenido <strong>actividad en los últimos 7 días</strong>. Es seguro borrarlas para mantener la base de datos limpia.
                </div>
            </div>
        </div>
    );
};

export default ListsManager;
