import { X } from 'lucide-react';
import type { ShopItem } from '../../types';
import { translations, categoryStyles } from '../../data/constants';
import { useShopStore } from '../../store/shopStore';
import { useState } from 'react';
import { useScrollLock } from '../../hooks/useScrollLock';
import { useBackButton } from '../../hooks/useBackButton';

interface ProductModalProps {
    item: ShopItem;
    onClose: () => void;
}

const ProductModal = ({ item: initialItem, onClose }: ProductModalProps) => {
    const { lang, updateItemNote } = useShopStore();
    const t = translations[lang];
    useScrollLock(true);
    useBackButton(onClose);
    const [note, setNote] = useState(initialItem.note || '');

    // We use the ID to look up the latest state if needed, but for note editing local state is fine until save.
    // However, we might want to show category style.
    const style = categoryStyles[initialItem.category] || categoryStyles['other'];

    const handleSave = () => {
        updateItemNote(initialItem.id, note);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity" onClick={onClose}></div>
            <div className="relative w-11/12 max-w-md bg-white dark:bg-darkSurface rounded-2xl shadow-2xl p-6 flex flex-col max-h-[85vh] animate-pop m-4 ring-1 ring-white/10 z-50">
                <div className="flex justify-between items-start mb-6">
                    <div className="pr-8">
                        <h3 className="text-2xl font-bold text-slate-800 dark:text-white break-words leading-tight mb-2">{initialItem.name}</h3>
                        <span className={`${style.bgSolid} text-[10px] font-bold px-2.5 py-1 rounded-full text-white uppercase tracking-wider shadow-sm opacity-80`}>
                            {t.cats[initialItem.category as keyof typeof t.cats] || initialItem.category}
                        </span>
                    </div>
                    <button onClick={onClose} className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700">
                        <X size={16} />
                    </button>
                </div>
                <div className="mb-4 flex-grow overflow-y-auto">
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-2.5 ml-1">{t.notes}</label>
                    <textarea
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl p-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 resize-none transition-all placeholder-slate-400 dark:text-slate-200 min-h-[120px]"
                        placeholder="..."
                    ></textarea>
                </div>
                <button onClick={handleSave} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl shadow-lg shadow-blue-500/30 transition font-bold text-sm">
                    {t.saveNote}
                </button>
            </div>
        </div>
    );
};

export default ProductModal;
