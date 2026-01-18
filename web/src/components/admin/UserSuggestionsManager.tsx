import { useState, useEffect } from 'react';
import { pb } from '../../lib/pocketbase';
import { Check, X, Loader, Tag, Package, ChevronDown, ChevronUp, Plus, Search, AlertCircle } from 'lucide-react';
import { useShopStore } from '../../store/shopStore';
import { EMOJI_LIST } from '../../data/constants';

interface ListCategory {
    id: string;
    list: string;
    key: string;
    icon: string;
    name: string;
    expand?: { list: { list_code: string } };
}

interface ListItem {
    id: string;
    list: string;
    category_key: string;
    name: string;
    expand?: { list: { list_code: string } };
}

interface CatalogCategory {
    id: string;
    key: string;
    icon: string;
    name_es: string;
    name_ca: string;
    name_en: string;
}

interface CatalogItem {
    id: string;
    category: string;
    name_es: string;
    name_ca: string;
    name_en: string;
}

const UserSuggestionsManager = () => {
    const { lang } = useShopStore();
    const [loading, setLoading] = useState(true);
    const [userCategories, setUserCategories] = useState<ListCategory[]>([]);
    const [userItems, setUserItems] = useState<ListItem[]>([]);
    const [catalogCategories, setCatalogCategories] = useState<CatalogCategory[]>([]);
    const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([]);

    const [expandedCat, setExpandedCat] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    // Modal state for promoting
    const [promotingCategory, setPromotingCategory] = useState<ListCategory | null>(null);
    const [promotingItem, setPromotingItem] = useState<ListItem | null>(null);

    // Form data for promotion
    const [catFormData, setCatFormData] = useState({
        key: '', icon: '', name_es: '', name_ca: '', name_en: '', customEmoji: ''
    });
    const [itemFormData, setItemFormData] = useState({
        category: '', name_es: '', name_ca: '', name_en: ''
    });

    const [saving, setSaving] = useState(false);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [cats, items, catalogCats, catalogItms] = await Promise.all([
                pb.collection('list_categories').getFullList<ListCategory>({ expand: 'list' }),
                pb.collection('list_items').getFullList<ListItem>({ expand: 'list' }),
                pb.collection('catalog_categories').getFullList<CatalogCategory>({ sort: 'key' }),
                pb.collection('catalog_items').getFullList<CatalogItem>()
            ]);
            setUserCategories(cats);
            setUserItems(items);
            setCatalogCategories(catalogCats);
            setCatalogItems(catalogItms);
        } catch (e) {
            console.error('Failed to load data', e);
        } finally {
            setLoading(false);
        }
    };

    // Check if category already exists in catalog
    const isCategoryInCatalog = (key: string) => {
        return catalogCategories.some(c => c.key.toLowerCase() === key.toLowerCase());
    };

    // Check if item exists in catalog (case-insensitive)
    const isItemInCatalog = (name: string, categoryKey: string) => {
        const catId = catalogCategories.find(c => c.key === categoryKey)?.id;
        if (!catId) return false;
        return catalogItems.some(i =>
            i.category === catId &&
            (i.name_es.toLowerCase() === name.toLowerCase() ||
                i.name_ca.toLowerCase() === name.toLowerCase() ||
                i.name_en.toLowerCase() === name.toLowerCase())
        );
    };

    // Group items by category key
    const groupedItems = userItems.reduce((acc, item) => {
        if (!acc[item.category_key]) acc[item.category_key] = [];
        acc[item.category_key].push(item);
        return acc;
    }, {} as Record<string, ListItem[]>);

    // Filter based on search
    const filteredCategories = userCategories.filter(c =>
        c.key.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const filteredItems = userItems.filter(i =>
        i.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        i.category_key.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Start promoting a category
    const startPromoteCategory = (cat: ListCategory) => {
        setPromotingCategory(cat);
        setCatFormData({
            key: cat.key,
            icon: cat.icon,
            name_es: cat.name,
            name_ca: cat.name,
            name_en: cat.name,
            customEmoji: ''
        });
    };

    // Start promoting an item
    const startPromoteItem = (item: ListItem) => {
        setPromotingItem(item);
        // Find matching catalog category
        const matchingCat = catalogCategories.find(c => c.key === item.category_key);
        setItemFormData({
            category: matchingCat?.id || '',
            name_es: item.name,
            name_ca: item.name,
            name_en: item.name
        });
    };

    // Save category to catalog
    const saveCategory = async () => {
        if (!catFormData.key || (!catFormData.icon && !catFormData.customEmoji)) return;
        setSaving(true);
        try {
            await pb.collection('catalog_categories').create({
                key: catFormData.key.toLowerCase().replace(/\s+/g, '_'),
                icon: catFormData.customEmoji || catFormData.icon,
                name_es: catFormData.name_es,
                name_ca: catFormData.name_ca,
                name_en: catFormData.name_en,
                order: 999,
                hidden: false
            });

            // Remove from user list
            if (promotingCategory) {
                await pb.collection('list_categories').delete(promotingCategory.id);
            }

            setPromotingCategory(null);
            loadData();
        } catch (e: any) {
            alert('Error: ' + (e.message || 'Failed to save'));
        } finally {
            setSaving(false);
        }
    };

    // Save item to catalog
    const saveItem = async () => {
        if (!itemFormData.category || !itemFormData.name_es) return;
        setSaving(true);
        try {
            await pb.collection('catalog_items').create({
                category: itemFormData.category,
                name_es: itemFormData.name_es,
                name_ca: itemFormData.name_ca || itemFormData.name_es,
                name_en: itemFormData.name_en || itemFormData.name_es,
                hidden: false
            });

            // Remove from user list
            if (promotingItem) {
                await pb.collection('list_items').delete(promotingItem.id);
            }

            setPromotingItem(null);
            loadData();
        } catch (e: any) {
            alert('Error: ' + (e.message || 'Failed to save'));
        } finally {
            setSaving(false);
        }
    };

    // Dismiss (delete from user list without adding to catalog)
    const dismissCategory = async (cat: ListCategory) => {
        if (!confirm('¿Descartar esta categoría sugerida?')) return;
        try {
            await pb.collection('list_categories').delete(cat.id);
            loadData();
        } catch (e) {
            console.error('Failed to dismiss', e);
        }
    };

    const dismissItem = async (item: ListItem) => {
        if (!confirm('¿Descartar este producto sugerido?')) return;
        try {
            await pb.collection('list_items').delete(item.id);
            loadData();
        } catch (e) {
            console.error('Failed to dismiss', e);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader className="animate-spin text-blue-500" size={32} />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                        <Plus size={20} className="text-green-500" />
                        {lang === 'ca' ? 'Suggeriments d\'usuaris' : lang === 'en' ? 'User Suggestions' : 'Sugerencias de usuarios'}
                    </h2>
                    <p className="text-xs text-slate-500 mt-1">
                        {lang === 'ca' ? 'Categories i productes creats pels usuaris en les seves llistes' :
                            lang === 'en' ? 'Categories and products created by users in their lists' :
                                'Categorías y productos creados por los usuarios en sus listas'}
                    </p>
                </div>

                <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder={lang === 'ca' ? 'Cercar...' : lang === 'en' ? 'Search...' : 'Buscar...'}
                        className="pl-9 pr-4 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-4">
                <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-xl border border-purple-100 dark:border-purple-800/30">
                    <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400 mb-1">
                        <Tag size={16} />
                        <span className="text-xs font-bold uppercase tracking-wider">
                            {lang === 'ca' ? 'Categories' : 'Categorías'}
                        </span>
                    </div>
                    <p className="text-2xl font-bold text-purple-800 dark:text-purple-200">{userCategories.length}</p>
                </div>
                <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-xl border border-green-100 dark:border-green-800/30">
                    <div className="flex items-center gap-2 text-green-600 dark:text-green-400 mb-1">
                        <Package size={16} />
                        <span className="text-xs font-bold uppercase tracking-wider">
                            {lang === 'ca' ? 'Productes' : 'Productos'}
                        </span>
                    </div>
                    <p className="text-2xl font-bold text-green-800 dark:text-green-200">{userItems.length}</p>
                </div>
            </div>

            {/* Empty State */}
            {userCategories.length === 0 && userItems.length === 0 && (
                <div className="text-center py-12 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
                    <Package size={48} className="mx-auto text-slate-300 dark:text-slate-600 mb-3" />
                    <p className="text-slate-500 dark:text-slate-400 font-bold">
                        {lang === 'ca' ? 'No hi ha suggeriments pendents' :
                            lang === 'en' ? 'No pending suggestions' :
                                'No hay sugerencias pendientes'}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                        {lang === 'ca' ? 'Els usuaris encara no han creat categories o productes personalitzats' :
                            lang === 'en' ? 'Users haven\'t created custom categories or products yet' :
                                'Los usuarios aún no han creado categorías o productos personalizados'}
                    </p>
                </div>
            )}

            {/* Categories Section */}
            {filteredCategories.length > 0 && (
                <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                    <div className="px-4 py-3 bg-purple-50 dark:bg-purple-900/20 border-b border-slate-200 dark:border-slate-700">
                        <h3 className="text-sm font-bold text-purple-700 dark:text-purple-300 flex items-center gap-2">
                            <Tag size={14} />
                            {lang === 'ca' ? 'Categories suggerides' : lang === 'en' ? 'Suggested Categories' : 'Categorías sugeridas'}
                        </h3>
                    </div>
                    <div className="divide-y divide-slate-100 dark:divide-slate-700">
                        {filteredCategories.map(cat => {
                            const inCatalog = isCategoryInCatalog(cat.key);
                            return (
                                <div key={cat.id} className="p-4 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <span className="text-2xl">{cat.icon}</span>
                                            <div>
                                                <p className="font-bold text-slate-800 dark:text-white">{cat.name || cat.key}</p>
                                                <p className="text-[10px] text-slate-400 font-mono">key: {cat.key}</p>
                                                {cat.expand?.list?.list_code && (
                                                    <p className="text-[10px] text-slate-400">Lista: {cat.expand.list.list_code}</p>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {inCatalog ? (
                                                <span className="px-2 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 text-[10px] font-bold rounded-full flex items-center gap-1">
                                                    <AlertCircle size={10} />
                                                    {lang === 'ca' ? 'Ja existeix' : lang === 'en' ? 'Already exists' : 'Ya existe'}
                                                </span>
                                            ) : (
                                                <button
                                                    onClick={() => startPromoteCategory(cat)}
                                                    className="px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white text-xs font-bold rounded-lg flex items-center gap-1 transition-colors"
                                                >
                                                    <Plus size={12} />
                                                    {lang === 'ca' ? 'Afegir al catàleg' : lang === 'en' ? 'Add to catalog' : 'Añadir al catálogo'}
                                                </button>
                                            )}
                                            <button
                                                onClick={() => dismissCategory(cat)}
                                                className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                            >
                                                <X size={16} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Items Section */}
            {filteredItems.length > 0 && (
                <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                    <div className="px-4 py-3 bg-green-50 dark:bg-green-900/20 border-b border-slate-200 dark:border-slate-700">
                        <h3 className="text-sm font-bold text-green-700 dark:text-green-300 flex items-center gap-2">
                            <Package size={14} />
                            {lang === 'ca' ? 'Productes suggerits' : lang === 'en' ? 'Suggested Products' : 'Productos sugeridos'}
                        </h3>
                    </div>
                    <div className="divide-y divide-slate-100 dark:divide-slate-700">
                        {Object.entries(groupedItems).map(([catKey, items]) => {
                            const isExpanded = expandedCat === catKey;
                            const catIcon = userCategories.find(c => c.key === catKey)?.icon || catalogCategories.find(c => c.key === catKey)?.icon || '📦';

                            return (
                                <div key={catKey}>
                                    <button
                                        onClick={() => setExpandedCat(isExpanded ? null : catKey)}
                                        className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                                    >
                                        <div className="flex items-center gap-2">
                                            <span className="text-lg">{catIcon}</span>
                                            <span className="font-bold text-slate-700 dark:text-slate-200">{catKey}</span>
                                            <span className="text-[10px] bg-slate-100 dark:bg-slate-700 text-slate-500 px-1.5 py-0.5 rounded-full font-bold">
                                                {items.length}
                                            </span>
                                        </div>
                                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                    </button>

                                    {isExpanded && (
                                        <div className="px-4 pb-3 space-y-2">
                                            {items.filter(i => i.name.toLowerCase().includes(searchTerm.toLowerCase())).map(item => {
                                                const inCatalog = isItemInCatalog(item.name, item.category_key);
                                                return (
                                                    <div key={item.id} className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                                                        <div>
                                                            <p className="font-medium text-slate-700 dark:text-slate-200 text-sm">{item.name}</p>
                                                            {item.expand?.list?.list_code && (
                                                                <p className="text-[10px] text-slate-400">Lista: {item.expand.list.list_code}</p>
                                                            )}
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            {inCatalog ? (
                                                                <span className="px-2 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 text-[10px] font-bold rounded-full">
                                                                    {lang === 'ca' ? 'Ja existeix' : lang === 'en' ? 'Exists' : 'Ya existe'}
                                                                </span>
                                                            ) : (
                                                                <button
                                                                    onClick={() => startPromoteItem(item)}
                                                                    className="px-2 py-1 bg-green-500 hover:bg-green-600 text-white text-[10px] font-bold rounded-lg flex items-center gap-1"
                                                                >
                                                                    <Plus size={10} />
                                                                    {lang === 'ca' ? 'Afegir' : lang === 'en' ? 'Add' : 'Añadir'}
                                                                </button>
                                                            )}
                                                            <button
                                                                onClick={() => dismissItem(item)}
                                                                className="p-1 text-slate-400 hover:text-red-500 rounded transition-colors"
                                                            >
                                                                <X size={14} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Category Promotion Modal */}
            {promotingCategory && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl max-w-md w-full max-h-[90vh] overflow-auto">
                        <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                            <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                <Tag size={16} className="text-purple-500" />
                                {lang === 'ca' ? 'Afegir categoria al catàleg' : lang === 'en' ? 'Add category to catalog' : 'Añadir categoría al catálogo'}
                            </h3>
                            <button onClick={() => setPromotingCategory(null)} className="text-slate-400 hover:text-slate-600">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-4 space-y-4">
                            {/* Key */}
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Key (ID único)</label>
                                <input
                                    type="text"
                                    value={catFormData.key}
                                    onChange={(e) => setCatFormData({ ...catFormData, key: e.target.value })}
                                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm font-mono"
                                />
                            </div>

                            {/* Emoji Selector */}
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Icono</label>
                                <div className="flex gap-2 items-start">
                                    <div className="w-14 h-14 bg-slate-100 dark:bg-slate-700 rounded-xl flex items-center justify-center text-3xl border-2 border-slate-200 dark:border-slate-600">
                                        {catFormData.customEmoji || catFormData.icon || '❓'}
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex gap-2 mb-2">
                                            <input
                                                type="text"
                                                value={catFormData.customEmoji}
                                                onChange={(e) => setCatFormData({ ...catFormData, customEmoji: e.target.value, icon: '' })}
                                                placeholder="Emoji personalizado..."
                                                className="flex-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-sm"
                                            />
                                            <button
                                                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                                                className="px-3 py-1.5 bg-slate-100 dark:bg-slate-700 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600"
                                            >
                                                {showEmojiPicker ? 'Cerrar' : 'Elegir'}
                                            </button>
                                        </div>
                                        {showEmojiPicker && (
                                            <div className="grid grid-cols-6 gap-1 p-2 bg-slate-50 dark:bg-slate-900 rounded-xl max-h-32 overflow-auto">
                                                {EMOJI_LIST.map(emoji => (
                                                    <button
                                                        key={emoji}
                                                        onClick={() => {
                                                            setCatFormData({ ...catFormData, icon: emoji, customEmoji: '' });
                                                            setShowEmojiPicker(false);
                                                        }}
                                                        className={`text-xl p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 ${catFormData.icon === emoji ? 'bg-blue-100 dark:bg-blue-900' : ''}`}
                                                    >
                                                        {emoji}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Names in 3 languages */}
                            <div className="grid grid-cols-1 gap-3">
                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1 mb-1">
                                        🇪🇸 Español
                                    </label>
                                    <input
                                        type="text"
                                        value={catFormData.name_es}
                                        onChange={(e) => setCatFormData({ ...catFormData, name_es: e.target.value })}
                                        className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1 mb-1">
                                        🏴󠁥󠁳󠁣󠁴󠁿 Català
                                    </label>
                                    <input
                                        type="text"
                                        value={catFormData.name_ca}
                                        onChange={(e) => setCatFormData({ ...catFormData, name_ca: e.target.value })}
                                        className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1 mb-1">
                                        🇬🇧 English
                                    </label>
                                    <input
                                        type="text"
                                        value={catFormData.name_en}
                                        onChange={(e) => setCatFormData({ ...catFormData, name_en: e.target.value })}
                                        className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm"
                                    />
                                </div>
                            </div>

                            <button
                                onClick={saveCategory}
                                disabled={saving || !catFormData.key || (!catFormData.icon && !catFormData.customEmoji)}
                                className="w-full bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2"
                            >
                                {saving ? <Loader size={16} className="animate-spin" /> : <Check size={16} />}
                                {lang === 'ca' ? 'Afegir al catàleg' : lang === 'en' ? 'Add to catalog' : 'Añadir al catálogo'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Item Promotion Modal */}
            {promotingItem && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl max-w-md w-full">
                        <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                            <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                <Package size={16} className="text-green-500" />
                                {lang === 'ca' ? 'Afegir producte al catàleg' : lang === 'en' ? 'Add product to catalog' : 'Añadir producto al catálogo'}
                            </h3>
                            <button onClick={() => setPromotingItem(null)} className="text-slate-400 hover:text-slate-600">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-4 space-y-4">
                            {/* Category selector */}
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Categoría</label>
                                <select
                                    value={itemFormData.category}
                                    onChange={(e) => setItemFormData({ ...itemFormData, category: e.target.value })}
                                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm"
                                >
                                    <option value="">-- Seleccionar --</option>
                                    {catalogCategories.map(cat => (
                                        <option key={cat.id} value={cat.id}>
                                            {cat.icon} {cat[`name_${lang}` as keyof CatalogCategory] || cat.name_es}
                                        </option>
                                    ))}
                                </select>
                                {!itemFormData.category && (
                                    <p className="text-[10px] text-amber-500 mt-1 flex items-center gap-1">
                                        <AlertCircle size={10} />
                                        {lang === 'ca' ? 'Primer crea la categoria si no existeix' :
                                            lang === 'en' ? 'Create the category first if it doesn\'t exist' :
                                                'Primero crea la categoría si no existe'}
                                    </p>
                                )}
                            </div>

                            {/* Names in 3 languages */}
                            <div className="grid grid-cols-1 gap-3">
                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1 mb-1">
                                        🇪🇸 Español
                                    </label>
                                    <input
                                        type="text"
                                        value={itemFormData.name_es}
                                        onChange={(e) => setItemFormData({ ...itemFormData, name_es: e.target.value })}
                                        className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1 mb-1">
                                        🏴󠁥󠁳󠁣󠁴󠁿 Català
                                    </label>
                                    <input
                                        type="text"
                                        value={itemFormData.name_ca}
                                        onChange={(e) => setItemFormData({ ...itemFormData, name_ca: e.target.value })}
                                        className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1 mb-1">
                                        🇬🇧 English
                                    </label>
                                    <input
                                        type="text"
                                        value={itemFormData.name_en}
                                        onChange={(e) => setItemFormData({ ...itemFormData, name_en: e.target.value })}
                                        className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm"
                                    />
                                </div>
                            </div>

                            <button
                                onClick={saveItem}
                                disabled={saving || !itemFormData.category || !itemFormData.name_es}
                                className="w-full bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2"
                            >
                                {saving ? <Loader size={16} className="animate-spin" /> : <Check size={16} />}
                                {lang === 'ca' ? 'Afegir al catàleg' : lang === 'en' ? 'Add to catalog' : 'Añadir al catálogo'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default UserSuggestionsManager;
