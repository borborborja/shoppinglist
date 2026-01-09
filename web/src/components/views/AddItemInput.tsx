import { useState, useMemo, useRef, useEffect } from 'react';
import { Plus, Search } from 'lucide-react';
import { useShopStore } from '../../store/shopStore';
import { translations, categoryStyles } from '../../data/constants';
import { getLocalizedItemName } from '../../utils/helpers';
import type { LocalizedItem } from '../../types';
import CategoryPickerModal from '../modals/CategoryPickerModal';

interface SuggestionItem {
    name: string;
    category: string;
    categoryIcon: string;
    item: LocalizedItem;
}

const AddItemInput = () => {
    const [val, setVal] = useState('');
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(-1);
    const [showCategoryPicker, setShowCategoryPicker] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const { addItem, addCategoryItem, categories, lang } = useShopStore();
    const t = translations[lang];

    // Build flat list of all catalog items with their categories
    const allItems = useMemo((): SuggestionItem[] => {
        const items: SuggestionItem[] = [];
        Object.entries(categories).forEach(([catKey, cat]) => {
            cat.items.forEach((item) => {
                items.push({
                    name: getLocalizedItemName(item, lang),
                    category: catKey,
                    categoryIcon: cat.icon,
                    item
                });
            });
        });
        return items;
    }, [categories, lang]);

    // Filter suggestions based on input (minimum 2 chars)
    const suggestions = useMemo((): SuggestionItem[] => {
        if (val.length < 2) return [];
        const query = val.toLowerCase().trim();
        return allItems
            .filter(item => item.name.toLowerCase().includes(query))
            .slice(0, 8); // Limit to 8 suggestions
    }, [val, allItems]);

    // Check if current input exactly matches a suggestion
    const exactMatch = useMemo(() => {
        const query = val.toLowerCase().trim();
        return suggestions.find(s => s.name.toLowerCase() === query);
    }, [val, suggestions]);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (
                dropdownRef.current &&
                !dropdownRef.current.contains(e.target as Node) &&
                inputRef.current &&
                !inputRef.current.contains(e.target as Node)
            ) {
                setShowSuggestions(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setVal(e.target.value);
        setSelectedIndex(-1);
        setShowSuggestions(e.target.value.length >= 2);
    };

    const handleSelectSuggestion = (suggestion: SuggestionItem) => {
        addItem(suggestion.name, suggestion.category);
        setVal('');
        setShowSuggestions(false);
        setSelectedIndex(-1);
        if (navigator.vibrate) navigator.vibrate(10);
    };

    const handleSubmit = () => {
        if (!val.trim()) return;

        // If there's a selected suggestion, use it
        if (selectedIndex >= 0 && suggestions[selectedIndex]) {
            handleSelectSuggestion(suggestions[selectedIndex]);
            return;
        }

        // If input exactly matches a catalog item, use that category
        if (exactMatch) {
            addItem(exactMatch.name, exactMatch.category);
            setVal('');
            setShowSuggestions(false);
            if (navigator.vibrate) navigator.vibrate(10);
            return;
        }

        // Otherwise, show category picker for custom product
        setShowSuggestions(false);
        setShowCategoryPicker(true);
    };

    const handleCategoryConfirm = (category: string, addToCatalog: boolean) => {
        const name = val.trim();
        addItem(name, category);

        if (addToCatalog) {
            const newItem: LocalizedItem = { es: name, ca: name, en: name, [lang]: name };
            addCategoryItem(category, newItem);
        }

        setVal('');
        setShowCategoryPicker(false);
        if (navigator.vibrate) navigator.vibrate(10);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (!showSuggestions || suggestions.length === 0) {
            if (e.key === 'Enter') {
                handleSubmit();
            }
            return;
        }

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                setSelectedIndex(prev =>
                    prev < suggestions.length - 1 ? prev + 1 : prev
                );
                break;
            case 'ArrowUp':
                e.preventDefault();
                setSelectedIndex(prev => prev > 0 ? prev - 1 : -1);
                break;
            case 'Enter':
                e.preventDefault();
                handleSubmit();
                break;
            case 'Escape':
                setShowSuggestions(false);
                setSelectedIndex(-1);
                break;
        }
    };

    return (
        <>
            <div className="mb-6 relative group z-20">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-2xl opacity-20 group-hover:opacity-40 transition duration-500 blur"></div>
                <div className="relative flex shadow-xl shadow-indigo-500/5 rounded-2xl overflow-hidden bg-white dark:bg-darkSurface transition-colors ring-1 ring-slate-900/5 dark:ring-white/10">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                        <Search size={18} />
                    </div>
                    <input
                        ref={inputRef}
                        type="text"
                        value={val}
                        onChange={handleInputChange}
                        onKeyDown={handleKeyDown}
                        onFocus={() => val.length >= 2 && setShowSuggestions(true)}
                        className="flex-grow p-3 sm:p-4 pl-10 sm:pl-11 bg-transparent focus:outline-none dark:text-white placeholder-slate-400 text-base sm:text-lg font-medium"
                        placeholder={t.placeholder}
                        autoComplete="off"
                    />
                    <button
                        onClick={handleSubmit}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 sm:px-5 font-bold transition flex items-center justify-center border-l border-slate-100 dark:border-slate-700 w-14 sm:w-auto"
                    >
                        <Plus size={20} className="sm:hidden" />
                        <Plus size={24} className="hidden sm:block" />
                    </button>
                </div>

                {/* Suggestions Dropdown */}
                {showSuggestions && suggestions.length > 0 && (
                    <div
                        ref={dropdownRef}
                        className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-darkSurface rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden z-[25] animate-pop"
                    >
                        {suggestions.map((suggestion, idx) => {
                            const style = categoryStyles[suggestion.category] || categoryStyles['other'];
                            return (
                                <button
                                    key={`${suggestion.category}-${suggestion.name}-${idx}`}
                                    onClick={() => handleSelectSuggestion(suggestion)}
                                    className={`w-full px-4 py-3 flex items-center gap-3 text-left transition-colors ${idx === selectedIndex
                                        ? 'bg-blue-50 dark:bg-blue-900/20'
                                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                                        } ${idx !== 0 ? 'border-t border-slate-100 dark:border-slate-700/50' : ''}`}
                                >
                                    <span className="text-xl">{suggestion.categoryIcon}</span>
                                    <span className="flex-grow font-medium text-slate-700 dark:text-slate-200">
                                        {suggestion.name}
                                    </span>
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${style.pill}`}>
                                        {t.cats[suggestion.category as keyof typeof t.cats] || suggestion.category}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                )}

                {/* No matches hint */}
                {showSuggestions && val.length >= 2 && suggestions.length === 0 && (
                    <div
                        ref={dropdownRef}
                        className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-darkSurface rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden z-50 animate-pop"
                    >
                        <div className="px-4 py-3 text-center text-slate-500 dark:text-slate-400 text-sm">
                            {t.noMatches} — <span className="text-blue-500">Enter</span> {t.add.toLowerCase()}
                        </div>
                    </div>
                )}
            </div>

            {/* Category Picker Modal */}
            {showCategoryPicker && (
                <CategoryPickerModal
                    productName={val.trim()}
                    onClose={() => setShowCategoryPicker(false)}
                    onConfirm={handleCategoryConfirm}
                />
            )}
        </>
    );
};

export default AddItemInput;
