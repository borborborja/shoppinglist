import { useState } from 'react';
import { Plus, Pen, Check, X } from 'lucide-react';
import { useShopStore } from '../../store/shopStore';
import { categoryStyles, translations } from '../../data/constants';
import { getLocalizedItemName } from '../../utils/helpers';
import type { LocalizedItem } from '../../types';
import { useScrollLock } from '../../hooks/useScrollLock';

const CategoryList = () => {
    const { categories, addItem, lang, addCategoryItem, removeCategoryItem, setAddCategoryOpen } = useShopStore();
    const [activeCategory, setActiveCategory] = useState<string | null>(null);
    const [isQuickEditMode, setIsQuickEditMode] = useState(false);
    const [showQuickAddModal, setShowQuickAddModal] = useState(false);
    const [quickAddValue, setQuickAddValue] = useState('');

    const t = translations[lang];

    useScrollLock(showQuickAddModal);

    const toggleCategory = (key: string) => {
        if (activeCategory === key) {
            setActiveCategory(null);
            setIsQuickEditMode(false);
        } else {
            setActiveCategory(key);
            setIsQuickEditMode(false);
        }
    };

    const handleAddItem = (item: LocalizedItem) => {
        const name = getLocalizedItemName(item, lang);
        addItem(name, activeCategory!);
        if (navigator.vibrate) navigator.vibrate(20);
    };

    const handleConfirmQuickAdd = () => {
        const name = quickAddValue.trim();
        if (name && activeCategory) {
            const newItem: LocalizedItem = { es: name, ca: name, en: name, [lang]: name };
            addCategoryItem(activeCategory, newItem);
            setShowQuickAddModal(false);
            setQuickAddValue('');
        }
    };

    return (
        <div className="mb-8 select-none">
            <div className="flex justify-between items-end mb-2 px-1">
                <h3 className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">{t.quickAdd}</h3>
            </div>

            {/* Categorías */}
            <div className="flex flex-wrap gap-2 pb-2">
                {Object.entries(categories).map(([key, cat]) => {
                    const style = categoryStyles[cat.color || key] || categoryStyles['other'];
                    const isActive = activeCategory === key;
                    return (
                        <button
                            key={key}
                            onClick={() => toggleCategory(key)}
                            className={`px-3 py-2 rounded-xl text-[10px] sm:text-xs font-bold transition-all flex items-center gap-2 border shadow-sm outline-none ${isActive
                                ? style.active
                                : 'bg-white dark:bg-darkSurface text-slate-500 dark:text-slate-400 border-slate-100 dark:border-slate-700'
                                }`}
                        >
                            <span className="text-lg leading-none">{cat.icon}</span>
                            <span>{t.cats[key as keyof typeof t.cats] || key}</span>
                        </button>
                    );
                })}

                {/* Add Category Button */}
                <button
                    onClick={() => setAddCategoryOpen(true)}
                    className="px-3 py-2 rounded-xl text-[10px] sm:text-xs font-bold transition-all flex items-center gap-2 border border-dashed border-slate-300 dark:border-slate-600 text-slate-400 hover:text-blue-500 hover:border-blue-500 bg-transparent"
                >
                    <Plus size={16} />
                    <span>{t.add}</span>
                </button>
            </div>

            {/* Expansion Panel */}
            {activeCategory && (
                <div className="mt-1 bg-white dark:bg-darkSurface rounded-2xl shadow-lg border border-slate-100 dark:border-slate-700/50 overflow-hidden animate-pop ring-1 ring-black/5 dark:ring-white/5">
                    <div className="flex justify-between items-center px-4 py-3 bg-slate-50/80 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-700/50 backdrop-blur-sm">
                        <div className="flex items-center gap-2.5">
                            <span className="text-xl filter drop-shadow-sm">{categories[activeCategory].icon}</span>
                            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                                {t.cats[activeCategory as keyof typeof t.cats] || categories[activeCategory].items[0]?.es || activeCategory}
                            </span>
                        </div>
                        <div className="flex gap-1">
                            <button
                                onClick={() => setShowQuickAddModal(true)}
                                className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 px-3 py-1.5 rounded-full text-xs font-bold transition"
                            >
                                <Plus size={12} /> {t.add}
                            </button>
                            <button
                                onClick={() => setIsQuickEditMode(!isQuickEditMode)}
                                className={`w-8 h-8 flex items-center justify-center rounded-full transition ${isQuickEditMode ? 'text-red-500 bg-red-50' : 'text-slate-400 hover:text-slate-600'}`}
                            >
                                {isQuickEditMode ? <Check size={14} /> : <Pen size={12} />}
                            </button>
                        </div>
                    </div>

                    <div className="p-4 flex flex-wrap gap-2">
                        {categories[activeCategory].items.map((item, idx) => {
                            const params = categories[activeCategory];
                            const style = categoryStyles[params.color || activeCategory] || categoryStyles['other'];
                            return (
                                <div key={idx} className="relative group">
                                    <button
                                        onClick={() => isQuickEditMode ? removeCategoryItem(activeCategory, idx) : handleAddItem(item)}
                                        className={`inline-flex items-center sm:px-3 px-2 sm:py-1.5 py-1 sm:rounded-lg rounded-md sm:text-xs text-[10px] font-semibold transition-all border shadow-sm outline-none dark:bg-opacity-20 ${style.pill
                                            } ${isQuickEditMode ? 'animate-pulse border-red-300 text-red-500 ring-1 ring-red-500/20' : ''}`}
                                    >
                                        {getLocalizedItemName(item, lang)}
                                    </button>
                                    {isQuickEditMode && (
                                        <button
                                            onClick={(e) => { e.stopPropagation(); removeCategoryItem(activeCategory, idx); }}
                                            className="absolute -top-1.5 -right-1.5 bg-red-500 text-white w-4 h-4 rounded-full flex items-center justify-center shadow-sm z-10 hover:bg-red-600"
                                        >
                                            <X size={8} />
                                        </button>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Quick Add Modal (Inline here for simplicity or extract) */}
            {showQuickAddModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowQuickAddModal(false)}></div>
                    <div className="relative w-11/12 max-w-sm bg-white dark:bg-darkSurface rounded-2xl shadow-2xl p-6 animate-pop z-50">
                        <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4 text-center">
                            {t.add} &rarr; {t.cats[activeCategory as keyof typeof t.cats]}
                        </h3>
                        <div className="relative mb-5">
                            <input
                                autoFocus
                                type="text"
                                value={quickAddValue}
                                onChange={(e) => setQuickAddValue(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleConfirmQuickAdd()}
                                className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all dark:text-white"
                                placeholder="..."
                            />
                        </div>
                        <div className="flex gap-3">
                            <button onClick={() => setShowQuickAddModal(false)} className="flex-1 py-2.5 rounded-xl text-slate-500 hover:bg-slate-100 font-bold text-sm bg-transparent">{t.cancel}</button>
                            <button onClick={handleConfirmQuickAdd} className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/30 transition font-bold text-sm">{t.add}</button>
                        </div>
                    </div>
                </div>
            )}
            {/* Add Category Modal moved to App.tsx */}
        </div>
    );
};

export default CategoryList;
