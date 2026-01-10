import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Check } from 'lucide-react';
import { useShopStore } from '../../store/shopStore';
import { translations, EMOJI_LIST } from '../../data/constants';
import { useScrollLock } from '../../hooks/useScrollLock';

interface AddCategoryModalProps {
    onClose: () => void;
}

const AddCategoryModal = ({ onClose }: AddCategoryModalProps) => {
    const { lang, addCategory } = useShopStore();
    const t = translations[lang];

    useScrollLock(true);

    const [name, setName] = useState('');
    const [icon, setIcon] = useState('📦');

    const handleSave = () => {
        if (name.trim()) {
            // Generate a safe key from name if needed, but the store uses key as display label if not in t.cats
            const key = name.trim().toLowerCase().replace(/\s+/g, '_');
            addCategory(key, icon);
            onClose();
        }
    };

    const emojis = EMOJI_LIST;

    return createPortal(
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose}></div>
            <div className="relative w-full max-w-sm bg-white dark:bg-darkSurface rounded-2xl shadow-2xl p-6 animate-pop z-50">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold text-slate-800 dark:text-white">{t.newCategory}</h3>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400">
                        <X size={20} />
                    </button>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">
                            {t.categoryName}
                        </label>
                        <input
                            autoFocus
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all dark:text-white"
                            placeholder="..."
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">
                            {t.categoryIcon}
                        </label>
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 flex items-center justify-center bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl text-2xl">
                                {icon}
                            </div>
                            <div className="flex-grow grid grid-cols-5 gap-1 p-2 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl max-h-32 overflow-y-auto">
                                {emojis.map(e => (
                                    <button
                                        key={e}
                                        onClick={() => setIcon(e)}
                                        className={`w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white dark:hover:bg-slate-800 transition-colors ${icon === e ? 'bg-white dark:bg-slate-800 ring-2 ring-blue-500/50' : ''}`}
                                    >
                                        {e}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex gap-3 mt-8">
                    <button onClick={onClose} className="flex-1 py-3 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold text-sm transition">
                        {t.cancel}
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={!name.trim()}
                        className="flex-1 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:dark:bg-slate-700 text-white shadow-lg shadow-blue-500/30 disabled:shadow-none transition font-bold text-sm flex items-center justify-center gap-2"
                    >
                        <Check size={18} /> {t.add}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default AddCategoryModal;
