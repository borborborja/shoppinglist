import { useState } from 'react';
import { X, Check, Plus } from 'lucide-react';
import { useShopStore } from '../../store/shopStore';
import { translations, categoryStyles } from '../../data/constants';
import AddCategoryModal from './AddCategoryModal';

interface CategoryPickerModalProps {
    productName: string;
    onClose: () => void;
    onConfirm: (category: string, addToCatalog: boolean) => void;
}

const CategoryPickerModal = ({ productName, onClose, onConfirm }: CategoryPickerModalProps) => {
    const { categories, lang } = useShopStore();
    const t = translations[lang];

    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [addToCatalog, setAddToCatalog] = useState(false);
    const [showAddCategoryModal, setShowAddCategoryModal] = useState(false);

    const handleConfirm = () => {
        if (selectedCategory) {
            onConfirm(selectedCategory, addToCatalog);
            onClose();
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center sm:items-center items-end">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity" onClick={onClose}></div>
            <div className="relative w-full sm:w-[28rem] bg-white dark:bg-darkSurface rounded-t-3xl sm:rounded-2xl shadow-2xl p-6 pb-safe flex flex-col max-h-[90vh] sm:max-h-[85vh] animate-slide-up m-0 sm:m-4 ring-1 ring-white/10 z-50 overflow-hidden">
                <div className="w-12 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full mx-auto mb-4 sm:hidden flex-shrink-0"></div>

                {/* Header */}
                <div className="flex justify-between items-start mb-4">
                    <div className="pr-8">
                        <h3 className="text-lg font-bold text-slate-800 dark:text-white break-words leading-tight mb-1">
                            {t.selectCategory}
                        </h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400 truncate max-w-[250px]">
                            {productName}
                        </p>
                    </div>
                    <button onClick={onClose} className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700">
                        <X size={16} />
                    </button>
                </div>

                {/* Category Selection (Chips) */}
                <div className="flex-grow overflow-y-auto mb-4 pr-1">
                    <div className="flex flex-wrap gap-2">
                        {Object.entries(categories).map(([key, cat]) => {
                            const style = categoryStyles[cat.color || key] || categoryStyles['other'];
                            const isSelected = selectedCategory === key;
                            return (
                                <button
                                    key={key}
                                    onClick={() => setSelectedCategory(key)}
                                    className={`px-3 py-2 rounded-xl sm:text-sm text-[11px] font-semibold transition-all flex items-center gap-1.5 border outline-none shadow-sm ${isSelected
                                        ? `${style.active} ring-2 ring-blue-500/50`
                                        : 'bg-white dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                                        }`}
                                >
                                    <span className="sm:text-lg text-base">{cat.icon}</span>
                                    <span>{t.cats[key as keyof typeof t.cats] || key}</span>
                                </button>
                            );
                        })}

                        {/* New Category Button */}
                        <button
                            onClick={() => setShowAddCategoryModal(true)}
                            className="px-3 py-2 rounded-xl sm:text-sm text-[11px] font-semibold transition-all flex items-center gap-1.5 border border-dashed border-slate-300 dark:border-slate-600 text-slate-400 hover:text-blue-500 hover:border-blue-500 bg-transparent mb-2"
                        >
                            <Plus size={16} />
                            <span>{t.add}</span>
                        </button>
                    </div>
                </div>

                {/* Add to catalog checkbox */}
                <label className="flex items-center gap-3 mb-4 cursor-pointer group">
                    <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${addToCatalog
                        ? 'bg-blue-500 border-blue-500'
                        : 'border-slate-300 dark:border-slate-600 group-hover:border-blue-400'
                        }`}>
                        {addToCatalog && <Check size={14} className="text-white" />}
                    </div>
                    <input
                        type="checkbox"
                        checked={addToCatalog}
                        onChange={(e) => setAddToCatalog(e.target.checked)}
                        className="sr-only"
                    />
                    <span className="text-sm text-slate-600 dark:text-slate-300">{t.addToCatalog}</span>
                </label>

                {/* Actions */}
                <div className="flex gap-3 pb-safe-offset-2">
                    <button
                        onClick={onClose}
                        className="flex-1 py-3 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold text-sm transition"
                    >
                        {t.cancel}
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={!selectedCategory}
                        className="flex-1 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:dark:bg-slate-700 text-white shadow-lg shadow-blue-500/30 disabled:shadow-none transition font-bold text-sm"
                    >
                        {t.add}
                    </button>
                </div>
            </div>

            {showAddCategoryModal && (
                <AddCategoryModal onClose={() => setShowAddCategoryModal(false)} />
            )}
        </div>
    );
};

export default CategoryPickerModal;
