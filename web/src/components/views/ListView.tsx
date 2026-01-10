import { useState, useRef, useEffect } from 'react';
import { Check, Trash2, List, LayoutGrid, AlignJustify, StickyNote, ShoppingBasket, Pen, MoreHorizontal, Filter } from 'lucide-react';
import { useShopStore } from '../../store/shopStore';
import { translations, categoryStyles, defaultCategories } from '../../data/constants';
import type { ShopItem } from '../../types';
import ProductModal from '../modals/ProductModal';
import { triggerHaptic } from '../../utils/haptics';

const ListView = () => {
    const { items, categories, lang, viewMode, appMode, setViewMode, toggleCheck, deleteItem, clearCompleted, sync, activeUsers, sortOrder, setSortOrder, showCompletedInline, setShowCompletedInline, listName, setListName } = useShopStore();
    const t = translations[lang];
    const [editingItem, setEditingItem] = useState<ShopItem | null>(null);
    const [showOptions, setShowOptions] = useState(false);
    const optionsRef = useRef<HTMLDivElement>(null);
    const [isRenaming, setIsRenaming] = useState(false);
    const renameInputRef = useRef<HTMLInputElement>(null);

    // Close options menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (optionsRef.current && !optionsRef.current.contains(event.target as Node)) {
                setShowOptions(false);
            }
            // Auto-save on blur logic is handled by onBlur event of input, but click outside handling helps if needed
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Focus input when renaming starts
    useEffect(() => {
        if (isRenaming && renameInputRef.current) {
            renameInputRef.current.focus();
            renameInputRef.current.select();
        }
    }, [isRenaming]);

    // Computed
    const completedItems = items.filter(i => i.checked).sort((a, b) => a.name.localeCompare(b.name));

    // itemsToShow: if inline, all items. if not inline, only active items.
    const itemsToShow = showCompletedInline ? items : items.filter(i => !i.checked);

    const itemsSorted = sortOrder === 'alpha'
        ? [...itemsToShow].sort((a, b) => a.name.localeCompare(b.name))
        : itemsToShow;

    const itemsGrouped: Record<string, ShopItem[]> = {};
    if (sortOrder === 'category') {
        itemsSorted.forEach(item => {
            const cat = item.category || 'other';
            if (!itemsGrouped[cat]) itemsGrouped[cat] = [];
            itemsGrouped[cat].push(item);
        });
    }

    const getModeIcon = () => {
        if (viewMode === 'list') return <List size={18} />;
        if (viewMode === 'compact') return <AlignJustify size={18} />;
        return <LayoutGrid size={18} />;
    };

    const cycleViewMode = () => {
        const modes = ['list', 'compact', 'grid'] as const;
        let nextIdx = (modes.indexOf(viewMode) + 1) % modes.length;

        // Skip grid in planning mode
        if (appMode === 'planning' && modes[nextIdx] === 'grid') {
            nextIdx = (nextIdx + 1) % modes.length;
        }

        setViewMode(modes[nextIdx]);
        triggerHaptic(10);
    };

    const getItemClass = () => {
        if (viewMode === 'list') return 'p-3.5 mb-2';
        if (viewMode === 'compact') return 'p-2 mb-1.5';
        if (viewMode === 'grid') return 'p-3 h-full mb-0';
        return '';
    };

    const handleDelete = (id: number, e: React.MouseEvent) => {
        e.stopPropagation();
        deleteItem(id);
        triggerHaptic(20);
    };

    const handleRenameSubmit = () => {
        if (!renameInputRef.current) return;
        const newName = renameInputRef.current.value.trim();
        setListName(newName === '' ? null : newName);
        setIsRenaming(false);
        triggerHaptic(50);
    };

    const handleRenameKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleRenameSubmit();
        } else if (e.key === 'Escape') {
            setIsRenaming(false);
        }
    };

    // Sub-component moved outside to use hooks correctly
    const ItemCard = ({
        item,
        style,
        viewMode,
        appMode,
        toggleCheck,
        setEditingItem,
        handleDelete,
        getItemClass
    }: {
        item: ShopItem,
        style: any,
        viewMode: string,
        appMode: string,
        toggleCheck: (id: number) => void,
        setEditingItem: (item: ShopItem) => void,
        handleDelete: (id: number, e: React.MouseEvent) => void,
        getItemClass: () => string
    }) => {
        const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
        const isLongPressActive = useRef(false);

        const startPress = () => {
            isLongPressActive.current = false;
            timerRef.current = setTimeout(() => {
                isLongPressActive.current = true;
                setEditingItem(item);
                triggerHaptic(50);
            }, 700); // 700ms feels snappier than 1s for mobile
        };

        const endPress = () => {
            if (timerRef.current) {
                clearTimeout(timerRef.current);
                timerRef.current = null;
            }
        };

        const handleOnClick = () => {
            if (isLongPressActive.current) {
                isLongPressActive.current = false;
                return;
            }
            toggleCheck(item.id);
            triggerHaptic(20);
        };

        return (
            <div
                onMouseDown={startPress}
                onMouseUp={endPress}
                onMouseLeave={endPress}
                onTouchStart={() => {
                    // Prevent context menu on long press devices usually
                    startPress();
                }}
                onTouchMove={endPress} // Cancel press if scrolling
                onTouchCancel={endPress}
                onTouchEnd={endPress}
                onClick={handleOnClick}
                className={`group relative flex items-center rounded-xl transition-all border shadow-sm overflow-hidden cursor-pointer active:scale-[0.99] select-none ${getItemClass()} ${item.checked
                    ? 'bg-slate-50 dark:bg-slate-800/40 border-transparent grayscale'
                    : 'bg-white dark:bg-darkSurface border-slate-100 dark:border-slate-700/50 hover:shadow-md'}`}
            >
                <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${item.checked ? 'bg-slate-300 dark:bg-slate-600' : style.bgSolid}`}></div>
                <div className="flex-shrink-0 ml-2 mr-3" onClick={(e) => e.stopPropagation()}>
                    <button
                        onClick={() => { toggleCheck(item.id); triggerHaptic(20); }}
                        className={`rounded-full border-2 flex items-center justify-center transition-all ${item.checked
                            ? 'border-slate-400 bg-slate-400 dark:border-slate-600 dark:bg-slate-600 text-white'
                            : 'border-slate-300 dark:border-slate-600 hover:border-blue-500 bg-transparent text-transparent'
                            } ${viewMode === 'compact' ? 'w-5 h-5' : 'w-6 h-6'}`}
                    >
                        <Check size={viewMode === 'compact' ? 10 : 14} className={item.checked ? 'opacity-100' : 'opacity-0'} />
                    </button>
                </div>
                <div className="flex-grow overflow-hidden py-1">
                    <p className={`font-bold truncate transition-all ${item.checked
                        ? 'line-through text-slate-400'
                        : 'text-slate-700 dark:text-slate-200'} ${viewMode === 'compact' ? 'text-xs' : (viewMode === 'grid' ? 'text-[11px]' : 'text-sm')}`}>
                        {item.name}
                    </p>
                    {item.note && viewMode !== 'compact' && (
                        <p className="text-[10px] text-slate-400 truncate mt-0.5 flex items-center gap-1">
                            <StickyNote size={10} /> {item.note}
                        </p>
                    )}
                </div>
                {appMode === 'planning' && (
                    <div className="flex items-center pr-1 h-full">
                        {!item.checked && (
                            <button
                                onClick={(e) => { e.stopPropagation(); setEditingItem(item); }}
                                className="w-8 h-8 flex items-center justify-center text-slate-300 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition mr-1"
                            >
                                <Pen size={14} />
                            </button>
                        )}
                        <button
                            onClick={(e) => handleDelete(item.id, e)}
                            className={`w-8 h-8 flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition ${item.checked ? '' : 'mr-1'}`}
                        >
                            <Trash2 size={16} />
                        </button>
                    </div>
                )}
            </div>
        );
    };

    const CompletedSection = () => {
        if (showCompletedInline || completedItems.length === 0) return null;
        return (
            <div className={`mt-8 mb-8 pt-6 border-t border-dashed border-slate-200 dark:border-slate-700/50 opacity-60 hover:opacity-100 transition-opacity`}>
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center justify-center gap-2">
                    <span>{t.completed}</span>
                    <span className="bg-slate-100 dark:bg-slate-700 text-slate-500 px-2 py-0.5 rounded-full text-[10px]">{completedItems.length}</span>
                    {completedItems.length > 0 && (
                        <button
                            onClick={() => { if (confirm(t.clearComp + '?')) { clearCompleted(); triggerHaptic(20); } }}
                            className="ml-2 text-[10px] font-bold text-red-400 hover:text-red-500 bg-red-50 dark:bg-red-900/10 px-2 py-1 rounded-md transition uppercase tracking-wider hover:bg-red-100"
                        >
                            {t.clearComp}
                        </button>
                    )}
                </h3>
                <div className={viewMode === 'grid' ? 'grid grid-cols-2 gap-2' : 'space-y-2'}>
                    {completedItems.map(item => {
                        const style = categoryStyles[item.category || 'other'] || categoryStyles['other'];
                        return <ItemCard
                            key={item.id}
                            item={item}
                            style={style}
                            viewMode={viewMode}
                            appMode={appMode}
                            toggleCheck={toggleCheck}
                            setEditingItem={setEditingItem}
                            handleDelete={handleDelete}
                            getItemClass={getItemClass}
                        />;
                    })}
                </div>
            </div>
        );
    };

    return (
        <div className="relative">
            {/* List Header */}
            <div className="flex justify-between items-center mb-4 px-3 py-2 bg-gradient-to-r from-blue-600 to-blue-800 rounded-xl shadow-md relative overflow-hidden">
                {/* Decorative background circle */}
                <div className="absolute top-0 right-0 -mr-6 -mt-6 w-24 h-24 bg-white/10 rounded-full blur-xl"></div>

                <div className="flex items-center gap-2 relative z-10 w-full overflow-hidden">
                    {isRenaming ? (
                        <input
                            ref={renameInputRef}
                            type="text"
                            defaultValue={listName || ''}
                            placeholder={t.myList}
                            onBlur={handleRenameSubmit}
                            onKeyDown={handleRenameKeyDown}
                            className="text-xl font-bold tracking-tight bg-transparent border-b-2 border-white/50 focus:border-white focus:outline-none text-white w-full max-w-[200px] placeholder-white/50"
                        />
                    ) : (
                        <h2
                            onMouseDown={() => {
                                if (appMode === 'planning') {
                                    setIsRenaming(true);
                                    triggerHaptic(50);
                                }
                            }}
                            className={`text-xl font-bold tracking-tight transition-colors truncate max-w-[240px] text-white ${appMode === 'planning' ? 'cursor-text select-none active:opacity-80' : ''}`}
                        >
                            {listName || t.myList}
                        </h2>
                    )}
                    {sync.connected && (
                        <div className="flex items-center justify-center w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.6)] border border-white/20"></div>
                    )}
                </div>
                <div className="flex gap-1.5 relative z-10">
                    {/* View Switcher (Back outside) */}
                    <button
                        onClick={cycleViewMode}
                        className="flex items-center justify-center w-8 h-8 text-white bg-white/20 backdrop-blur-sm border border-white/10 rounded-lg transition shadow-sm hover:bg-white/30 active:scale-95"
                    >
                        {getModeIcon()}
                    </button>

                    {/* View Options Menu Trigger */}
                    <div ref={optionsRef}>
                        <button
                            onClick={() => { setShowOptions(!showOptions); triggerHaptic(10); }}
                            className={`flex items-center justify-center w-8 h-8 bg-white/20 backdrop-blur-sm border border-white/10 rounded-lg transition shadow-sm hover:bg-white/30 active:scale-95 ${showOptions ? 'ring-2 ring-white/30 bg-white/30' : 'text-white'}`}
                            title={t.viewOptions}
                        >
                            <MoreHorizontal size={18} className="text-white" />
                        </button>

                        {/* Discreet Options Menu */}
                        {showOptions && (
                            <div className="absolute top-full right-0 mt-2 w-56 bg-white dark:bg-darkSurface border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl p-2 z-50 animate-pop overflow-hidden">
                                <div className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-50 dark:border-slate-800/50 mb-1">
                                    {t.viewOptions}
                                </div>

                                {/* Rename List Option */}
                                {appMode === 'planning' && (
                                    <button
                                        onClick={() => { setIsRenaming(true); setShowOptions(false); triggerHaptic(10); }}
                                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition group"
                                    >
                                        <div className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors bg-slate-100 dark:bg-slate-800 text-slate-400 group-hover:bg-blue-100 dark:group-hover:bg-blue-900/30 group-hover:text-blue-600">
                                            <Pen size={16} />
                                        </div>
                                        <div className="text-left leading-tight">
                                            <div className="text-xs font-bold uppercase tracking-wide">
                                                Renombrar Lista
                                            </div>
                                        </div>
                                    </button>
                                )}

                                {/* Sort Mode */}
                                <button
                                    onClick={() => { setSortOrder(sortOrder === 'category' ? 'alpha' : 'category'); setShowOptions(false); triggerHaptic(10); }}
                                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition group"
                                >
                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${sortOrder === 'alpha' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>
                                        <Filter size={16} />
                                    </div>
                                    <div className="text-left leading-tight">
                                        <div className="text-xs font-bold uppercase tracking-wide">
                                            {sortOrder === 'alpha' ? 'Agrupar: Categoría' : 'Agrupar: Alfabético'}
                                        </div>
                                    </div>
                                </button>

                                {/* Inline Completed */}
                                <button
                                    onClick={() => { setShowCompletedInline(!showCompletedInline); setShowOptions(false); triggerHaptic(10); }}
                                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition group"
                                >
                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${showCompletedInline ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>
                                        <Check size={16} />
                                    </div>
                                    <div className="text-left leading-tight">
                                        <div className="text-xs font-bold uppercase tracking-wide">
                                            {t.inlineComp}
                                        </div>
                                    </div>
                                </button>
                            </div>
                        )}
                    </div>

                    {completedItems.length > 0 && showCompletedInline && (
                        <button
                            onClick={() => { if (confirm(t.clearComp + '?')) { clearCompleted(); triggerHaptic(20); } }}
                            className="text-[10px] font-bold text-red-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 px-3 py-1.5 rounded-lg transition uppercase tracking-wider bg-white dark:bg-slate-800 border border-transparent hover:border-red-100"
                        >
                            {t.clearComp}
                        </button>
                    )}
                </div>
            </div>

            {/* Empty State */}
            {items.length === 0 && (
                <div className="text-center py-16 flex flex-col items-center justify-center opacity-50">
                    <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
                        <ShoppingBasket size={32} className="text-slate-300 dark:text-slate-600" />
                    </div>
                    <p className="text-sm text-slate-400 font-bold tracking-wide">{t.empty}</p>
                </div>
            )}

            {/* Combined List Rendering based on showCompletedInline */}
            <div className="flex flex-col">
                {/* Items Section */}
                {sortOrder === 'category' ? (
                    Object.entries(itemsGrouped).map(([key, groupItems]) => {
                        const catDef = categories[key] || defaultCategories['other'];
                        const style = categoryStyles[key] || categoryStyles['other'];

                        return (
                            <div key={key} className="mb-2 animate-slide-up">
                                <div className="flex items-center gap-2 mb-2 pl-1">
                                    <span className="text-lg">{catDef.icon}</span>
                                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                                        {t.cats[key as keyof typeof t.cats] || key}
                                    </h3>
                                    <span className="text-[10px] font-bold text-slate-300 bg-slate-100 dark:bg-slate-800 dark:text-slate-600 px-1.5 rounded-md ml-auto">{groupItems.length}</span>
                                </div>
                                <div className={viewMode === 'grid' ? 'grid grid-cols-2 gap-2' : 'space-y-2'}>
                                    {groupItems.map(item => (
                                        <ItemCard
                                            key={item.id}
                                            item={item}
                                            style={style}
                                            viewMode={viewMode}
                                            appMode={appMode}
                                            toggleCheck={toggleCheck}
                                            setEditingItem={setEditingItem}
                                            handleDelete={handleDelete}
                                            getItemClass={getItemClass}
                                        />
                                    ))}
                                </div>
                            </div>
                        );
                    })
                ) : (
                    itemsSorted.length > 0 && (
                        <div className="mb-2 animate-slide-up">
                            <div className={viewMode === 'grid' ? 'grid grid-cols-2 gap-2' : 'space-y-2'}>
                                {itemsSorted.map(item => {
                                    const style = categoryStyles[item.category || 'other'] || categoryStyles['other'];
                                    return <ItemCard
                                        key={item.id}
                                        item={item}
                                        style={style}
                                        viewMode={viewMode}
                                        appMode={appMode}
                                        toggleCheck={toggleCheck}
                                        setEditingItem={setEditingItem}
                                        handleDelete={handleDelete}
                                        getItemClass={getItemClass}
                                    />;
                                })}
                            </div>
                        </div>
                    )
                )}

                <CompletedSection />
            </div>

            {/* Active Users */}
            {sync.connected && activeUsers.length > 0 && (
                <div className="mt-8 pt-4 border-t border-slate-100 dark:border-slate-800/50">
                    <div className="flex flex-wrap items-center justify-center gap-2">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mr-1">Viendo ahora:</span>
                        {activeUsers.map(user => (
                            <div key={user.id} className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-full border border-slate-200 dark:border-slate-700 animate-pulse-slow">
                                <div className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_5px_rgba(34,197,94,0.5)]"></div>
                                <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300">{user.username}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Editing Product Modal */}
            {editingItem && (
                <ProductModal item={editingItem} onClose={() => setEditingItem(null)} />
            )}
        </div>
    );
};

export default ListView;
