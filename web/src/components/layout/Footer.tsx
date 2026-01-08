import { Moon, Sun, Download } from 'lucide-react';
import { useShopStore } from '../../store/shopStore';
import { translations } from '../../data/constants';
import type { Lang } from '../../types';

interface FooterProps {
    installPrompt?: any;
    onInstall?: () => void;
}

const Footer = ({ installPrompt, onInstall }: FooterProps) => {
    const { lang, setLang, isDark, toggleTheme } = useShopStore();
    const t = translations[lang];

    const handleInstallClick = async () => {
        if (!installPrompt) return;
        installPrompt.prompt();
        const { outcome } = await installPrompt.userChoice;
        if (outcome === 'accepted') {
            onInstall?.();
        }
    };

    return (
        <footer className="fixed bottom-0 w-full glass-footer z-30 pb-safe">
            <div className="max-w-3xl mx-auto px-4 py-3">
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <select
                            value={lang}
                            onChange={(e) => setLang(e.target.value as Lang)}
                            className="bg-transparent text-xs font-bold text-slate-500 dark:text-slate-400 focus:outline-none cursor-pointer uppercase tracking-wider hover:text-blue-500 transition"
                        >
                            <option value="ca">CA</option>
                            <option value="es">ES</option>
                            <option value="en">EN</option>
                        </select>

                        {installPrompt && (
                            <button onClick={handleInstallClick} className="flex items-center gap-1.5 px-2 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-[10px] font-bold transition shadow-sm animate-pop">
                                <Download size={12} /> {t.installApp}
                            </button>
                        )}
                    </div>
                    <div className="text-[10px] font-bold text-slate-400 dark:text-slate-600 uppercase tracking-widest text-center">
                        &copy; ShopList v2.4 (2026-01-08-1805)
                    </div>
                    <div className="flex justify-end">
                        <button onClick={toggleTheme} className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition flex items-center justify-center text-slate-500 dark:text-slate-400 shadow-sm border border-slate-200 dark:border-slate-700">
                            {isDark ? <Moon className="text-indigo-400" size={14} /> : <Sun className="text-orange-400" size={14} />}
                        </button>
                    </div>
                </div>
            </div>
        </footer>
    );
};

export default Footer;
