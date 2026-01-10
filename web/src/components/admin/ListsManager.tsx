import { useState, useEffect } from 'react';
import { pb } from '../../lib/pocketbase';
import { Trash2, Loader, RefreshCw, CheckSquare, Square, Ghost, Clock, AlertTriangle, ChevronDown, ChevronUp, Tag, Package, StickyNote, RotateCcw, X } from 'lucide-react';
import { defaultCategories } from '../../data/constants';

interface ShopItem {
    id: number;
    name: string;
    checked: boolean;
    note: string;
    category: string;
}

interface CategoryItem {
    icon: string;
    items: any[];
    color?: string;
}

interface ShoppingListData {
    items?: ShopItem[];
    categories?: { [key: string]: CategoryItem };
    listName?: string;
}

interface ShoppingListRecord {
    id: string;
    list_code: string;
    updated: string;
    created: string;
    data: ShoppingListData;
}

// Default category keys from the system
const DEFAULT_CATEGORY_KEYS = ['fruit', 'veg', 'meat', 'dairy', 'pantry', 'cleaning', 'home', 'snacks', 'frozen', 'processed', 'drinks', 'other'];

const ListsManager = () => {
    const [lists, setLists] = useState<ShoppingListRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [actionLoading, setActionLoading] = useState<string | null>(null);

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

    const toggleExpand = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setExpandedId(expandedId === id ? null : id);
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

    const handleResetItems = async (list: ShoppingListRecord) => {
        if (!confirm('¿Borrar todos los items de esta lista? Los productos se eliminarán.')) return;

        setActionLoading(list.id);
        try {
            await pb.collection('shopping_lists').update(list.id, {
                data: { ...list.data, items: [] }
            });
            await loadLists();
        } catch (e) {
            console.error(e);
            alert('Error reseteando items');
        } finally {
            setActionLoading(null);
        }
    };

    const handleResetCustomCategories = async (list: ShoppingListRecord) => {
        if (!confirm('¿Eliminar las categorías/productos personalizados? Se restaurarán solo las categorías por defecto.')) return;

        setActionLoading(list.id);
        try {
            const currentCategories = list.data.categories || {};
            const defaultCategories: { [key: string]: CategoryItem } = {};

            // Keep only default categories, remove custom items within them
            for (const key of DEFAULT_CATEGORY_KEYS) {
                if (currentCategories[key]) {
                    defaultCategories[key] = {
                        ...currentCategories[key],
                        items: [] // Clear custom items
                    };
                }
            }

            await pb.collection('shopping_lists').update(list.id, {
                data: { ...list.data, categories: defaultCategories }
            });
            await loadLists();
        } catch (e) {
            console.error(e);
            alert('Error reseteando categorías');
        } finally {
            setActionLoading(null);
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

    const getCustomCategories = (list: ShoppingListRecord) => {
        const categories = list.data?.categories || {};
        return Object.entries(categories).filter(([key]) => !DEFAULT_CATEGORY_KEYS.includes(key));
    };

    const getCustomProducts = (list: ShoppingListRecord) => {
        const categories = list.data?.categories || {};
        const customProducts: { category: string; items: any[] }[] = [];

        for (const [key, cat] of Object.entries(categories)) {
            if (cat.items && cat.items.length > 0) {
                // Get default items for this category (if it's a default category)
                const defaultItems = defaultCategories[key as keyof typeof defaultCategories]?.items || [];

                // Filter out items that exist in the default catalog
                const customOnly = cat.items.filter(item => {
                    const itemName = typeof item === 'string'
                        ? item.toLowerCase()
                        : (item.es || item.ca || item.en || '').toLowerCase();

                    // Check if this item exists in defaults
                    return !defaultItems.some(defItem =>
                        defItem.es.toLowerCase() === itemName ||
                        defItem.ca.toLowerCase() === itemName ||
                        defItem.en.toLowerCase() === itemName
                    );
                });

                if (customOnly.length > 0) {
                    customProducts.push({ category: key, items: customOnly });
                }
            }
        }
        return customProducts;
    };

    const getItemsWithNotes = (list: ShoppingListRecord) => {
        return (list.data?.items || []).filter(item => item.note && item.note.trim() !== '');
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
                                <th className="p-4 text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">Personalizados</th>
                                <th className="p-4 text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">Última Actividad</th>
                                <th className="p-4 w-12"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {lists.map(list => {
                                const isSelected = selectedIds.has(list.id);
                                const phantom = isPhantom(list);
                                const reason = getPhantomReason(list);
                                const isExpanded = expandedId === list.id;
                                const customCats = getCustomCategories(list);
                                const customProducts = getCustomProducts(list);
                                const itemsWithNotes = getItemsWithNotes(list);
                                const hasCustomData = customCats.length > 0 || customProducts.length > 0;

                                return (
                                    <>
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
                                                        <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
                                                            {list.data.listName || 'Mi Lista'}
                                                        </span>
                                                        <span className="text-[10px] text-slate-400 font-medium mt-1">#{list.id}</span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                <div className="flex items-center gap-2">
                                                    <div className={`px-2 py-1 rounded-lg text-xs font-bold ${phantom && list.data.items?.length === 0 ? 'bg-slate-100 text-slate-500' : 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'}`}>
                                                        {list.data.items?.length || 0}
                                                    </div>
                                                    {itemsWithNotes.length > 0 && (
                                                        <div className="flex items-center gap-1 text-amber-500 text-[10px] font-bold" title="Items con notas">
                                                            <StickyNote size={12} /> {itemsWithNotes.length}
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                <div className="flex items-center gap-2">
                                                    {customCats.length > 0 && (
                                                        <div className="flex items-center gap-1 text-purple-600 dark:text-purple-400 text-[10px] font-bold bg-purple-100 dark:bg-purple-900/30 px-2 py-1 rounded">
                                                            <Tag size={10} /> {customCats.length} cats
                                                        </div>
                                                    )}
                                                    {customProducts.length > 0 && (
                                                        <div className="flex items-center gap-1 text-indigo-600 dark:text-indigo-400 text-[10px] font-bold bg-indigo-100 dark:bg-indigo-900/30 px-2 py-1 rounded">
                                                            <Package size={10} /> {customProducts.reduce((sum, cp) => sum + cp.items.length, 0)} prods
                                                        </div>
                                                    )}
                                                    {!hasCustomData && <span className="text-slate-400 text-xs">—</span>}
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                                                    <Clock size={14} className="opacity-50" />
                                                    <span className="text-sm font-medium">{formatTime(list.updated)}</span>
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                <button
                                                    onClick={(e) => toggleExpand(list.id, e)}
                                                    className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                                                >
                                                    {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                                                </button>
                                            </td>
                                        </tr>

                                        {isExpanded && (
                                            <tr key={`${list.id}-detail`}>
                                                <td colSpan={6} className="p-0">
                                                    <div className="bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-700 p-6 space-y-6">
                                                        {/* Actions */}
                                                        <div className="flex gap-3 flex-wrap">
                                                            <button
                                                                onClick={() => handleResetItems(list)}
                                                                disabled={actionLoading === list.id}
                                                                className="flex items-center gap-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 px-4 py-2 rounded-lg text-sm font-bold border border-red-200 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors disabled:opacity-50"
                                                            >
                                                                {actionLoading === list.id ? <Loader className="animate-spin" size={14} /> : <X size={14} />}
                                                                Reset Items ({list.data.items?.length || 0})
                                                            </button>
                                                            <button
                                                                onClick={() => handleResetCustomCategories(list)}
                                                                disabled={actionLoading === list.id}
                                                                className="flex items-center gap-2 bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 px-4 py-2 rounded-lg text-sm font-bold border border-purple-200 dark:border-purple-800 hover:bg-purple-100 dark:hover:bg-purple-900/40 transition-colors disabled:opacity-50"
                                                            >
                                                                {actionLoading === list.id ? <Loader className="animate-spin" size={14} /> : <RotateCcw size={14} />}
                                                                Reset Productos Personalizados
                                                            </button>
                                                        </div>

                                                        <div className="grid md:grid-cols-2 gap-6">
                                                            {/* Custom Categories */}
                                                            <div>
                                                                <h4 className="text-xs font-black uppercase text-slate-500 mb-3 flex items-center gap-2">
                                                                    <Tag size={14} /> Categorías Personalizadas
                                                                </h4>
                                                                {customCats.length > 0 ? (
                                                                    <div className="space-y-2">
                                                                        {customCats.map(([key, cat]) => (
                                                                            <div key={key} className="flex items-center justify-between bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                                                                                <div className="flex items-center gap-2">
                                                                                    <span className="text-xl">{cat.icon}</span>
                                                                                    <span className="font-bold text-sm text-slate-700 dark:text-slate-300">{key}</span>
                                                                                </div>
                                                                                <span className="text-xs text-slate-400">{cat.items?.length || 0} productos</span>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                ) : (
                                                                    <p className="text-slate-400 text-sm italic">Sin categorías personalizadas</p>
                                                                )}
                                                            </div>

                                                            {/* Custom Products */}
                                                            <div>
                                                                <h4 className="text-xs font-black uppercase text-slate-500 mb-3 flex items-center gap-2">
                                                                    <Package size={14} /> Productos Personalizados en Catálogo
                                                                </h4>
                                                                {customProducts.length > 0 ? (
                                                                    <div className="space-y-2 max-h-48 overflow-y-auto">
                                                                        {customProducts.map(({ category, items }) => (
                                                                            <div key={category} className="bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                                                                                <div className="text-xs font-bold text-slate-500 uppercase mb-2">{category}</div>
                                                                                <div className="flex flex-wrap gap-1">
                                                                                    {items.map((item, idx) => (
                                                                                        <span key={idx} className="text-xs bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 px-2 py-1 rounded">
                                                                                            {typeof item === 'string' ? item : (item.es || item.ca || item.en || JSON.stringify(item))}
                                                                                        </span>
                                                                                    ))}
                                                                                </div>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                ) : (
                                                                    <p className="text-slate-400 text-sm italic">Sin productos personalizados</p>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* Items with Notes */}
                                                        {itemsWithNotes.length > 0 && (
                                                            <div>
                                                                <h4 className="text-xs font-black uppercase text-slate-500 mb-3 flex items-center gap-2">
                                                                    <StickyNote size={14} /> Items con Notas
                                                                </h4>
                                                                <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-2">
                                                                    {itemsWithNotes.map(item => (
                                                                        <div key={item.id} className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-3 rounded-lg">
                                                                            <div className="font-bold text-sm text-slate-800 dark:text-slate-200 flex items-center gap-2">
                                                                                {item.checked && <span className="line-through opacity-50">{item.name}</span>}
                                                                                {!item.checked && item.name}
                                                                            </div>
                                                                            <p className="text-xs text-amber-700 dark:text-amber-300 mt-1 italic">"{item.note}"</p>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}

                                                        {/* Raw Items Preview */}
                                                        <div>
                                                            <h4 className="text-xs font-black uppercase text-slate-500 mb-3">
                                                                Lista de Items ({list.data.items?.length || 0})
                                                            </h4>
                                                            <div className="max-h-32 overflow-y-auto bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                                                                {(list.data.items || []).length > 0 ? (
                                                                    <div className="flex flex-wrap gap-1">
                                                                        {list.data.items?.map(item => (
                                                                            <span
                                                                                key={item.id}
                                                                                className={`text-xs px-2 py-1 rounded ${item.checked ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 line-through' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'}`}
                                                                            >
                                                                                {item.name}
                                                                            </span>
                                                                        ))}
                                                                    </div>
                                                                ) : (
                                                                    <p className="text-slate-400 text-sm italic">Lista vacía</p>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </>
                                );
                            })}
                            {lists.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="p-20 text-center">
                                        <div className="flex flex-col items-center gap-2 text-slate-400">
                                            <Ghost size={48} className="opacity-20" />
                                            <p className="font-bold">No se encontraron listas.</p>
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
