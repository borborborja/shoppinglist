import { Settings } from 'lucide-react';
import { useShopStore } from '../../store/shopStore';
import { translations } from '../../data/constants';

interface HeaderProps {
    openSettings: () => void;
}

const Header = ({ openSettings }: HeaderProps) => {
    const { appMode, setAppMode, lang } = useShopStore();
    const t = translations[lang];

    return (
        <header className="fixed top-0 w-full z-40 glass transition-all duration-300 h-16">
            <div className="max-w-2xl mx-auto px-4 h-full flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 flex items-center justify-center overflow-hidden p-1.5">
                        <img src="/icon.png" alt="Logo" className="w-full h-full object-contain" />
                    </div>
                    <h1 className="font-bold text-xl tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-slate-800 to-slate-600 dark:from-white dark:to-slate-300 hidden sm:block">
                        {useShopStore.getState().serverName}
                    </h1>
                </div>

                <div className="flex items-center gap-3">
                    <div className="bg-slate-100 dark:bg-slate-800 p-1 rounded-xl flex items-center shadow-inner border border-slate-200/50 dark:border-slate-700/50 mr-2 relative">
                        <button
                            onClick={() => setAppMode('planning')}
                            className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1.5 ${appMode === 'planning'
                                ? 'bg-white dark:bg-darkSurface text-blue-600 dark:text-blue-400 shadow-sm'
                                : 'text-slate-500 dark:text-slate-400'
                                }`}
                        >
                            {t.modePlan}
                        </button>
                        <button
                            onClick={() => setAppMode('shopping')}
                            className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1.5 ${appMode === 'shopping'
                                ? 'bg-white dark:bg-darkSurface text-emerald-600 dark:text-emerald-400 shadow-sm'
                                : 'text-slate-500 dark:text-slate-400'
                                }`}
                        >
                            {t.modeShop}
                        </button>
                    </div>
                    <button onClick={openSettings} className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 transition duration-300">
                        <Settings size={18} />
                    </button>
                </div>
            </div>
        </header>
    );
};

export default Header;
