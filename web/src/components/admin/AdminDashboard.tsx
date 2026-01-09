import { useState, useEffect } from 'react';
import { Package, Tag, Settings as SettingsIcon, LogOut, List, Sun, Moon, Users, AlertTriangle } from 'lucide-react';
import { useShopStore } from '../../store/shopStore';
import { translations } from '../../data/constants';
import { pb } from '../../lib/pocketbase';
import CategoryManager from './CategoryManager';
import ProductManager from './ProductManager';
import AdminSettings from './AdminSettings';
import ListsManager from './ListsManager';
import UsersManager from './UsersManager';

interface AdminDashboardProps {
    onLogout: () => void;
}

const AdminDashboard = ({ onLogout }: AdminDashboardProps) => {
    const [activeTab, setActiveTab] = useState<'lists' | 'users' | 'categories' | 'products' | 'settings'>('lists');
    const [isDefaultPassword, setIsDefaultPassword] = useState(false);
    const { isDark, toggleTheme, lang, setLang } = useShopStore();
    const t = translations[lang] as any;

    // Check if admin is using default password
    useEffect(() => {
        const checkDefaultPassword = async () => {
            try {
                // Try to authenticate with default password to check if it's still valid
                await pb.collection('site_admins').authWithPassword('admin', 'admin123');
                setIsDefaultPassword(true);
            } catch {
                // Auth failed, meaning password has been changed
                setIsDefaultPassword(false);
            }
        };
        checkDefaultPassword();
    }, []);

    const renderHeader = () => (
        <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-6 py-4 flex justify-between items-center sticky top-0 z-50">
            <h1 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 p-1.5 rounded-lg">
                    <SettingsIcon size={20} />
                </span>
                {useShopStore.getState().serverName}
            </h1>

            <div className="flex items-center gap-4">
                {/* Theme Toggle */}
                <button
                    onClick={toggleTheme}
                    className="p-2 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                    title="Cambiar tema"
                >
                    {isDark ? <Sun size={18} /> : <Moon size={18} />}
                </button>

                {/* Lang Switch */}
                <div className="flex bg-slate-100 dark:bg-slate-700 p-1 rounded-lg">
                    {(['ca', 'es', 'en'] as const).map((l) => (
                        <button
                            key={l}
                            onClick={() => setLang(l)}
                            className={`px-2 py-1 text-[10px] font-black uppercase rounded ${lang === l ? 'bg-white dark:bg-slate-600 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}
                        >
                            {l}
                        </button>
                    ))}
                </div>

                <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 hidden md:block"></div>

                <button
                    onClick={onLogout}
                    className="text-slate-500 hover:text-red-500 transition-colors flex items-center gap-2 text-sm font-bold"
                >
                    <LogOut size={16} /> <span className="hidden sm:inline">{t.logout}</span>
                </button>
            </div>
        </header>
    );

    const renderTabs = () => (
        <div className="flex gap-1 px-6 pt-6 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 sticky top-16 z-40">
            <button
                onClick={() => setActiveTab('lists')}
                className={`px-4 py-3 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${activeTab === 'lists'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                    }`}
            >
                <List size={16} /> {t.tabLists}
            </button>
            {useShopStore.getState().enableUsernames && (
                <button
                    onClick={() => setActiveTab('users')}
                    className={`px-4 py-3 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${activeTab === 'users'
                        ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                        : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                        }`}
                >
                    <Users size={16} /> {t.tabUsers}
                </button>
            )}
            <button
                onClick={() => setActiveTab('categories')}
                className={`px-4 py-3 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${activeTab === 'categories'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                    }`}
            >
                <Tag size={16} /> {t.tabCategories}
            </button>
            <button
                onClick={() => setActiveTab('products')}
                className={`px-4 py-3 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${activeTab === 'products'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                    }`}
            >
                <Package size={16} /> {t.tabProducts}
            </button>
            <button
                onClick={() => setActiveTab('settings')}
                className={`px-4 py-3 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${activeTab === 'settings'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                    }`}
            >
                <SettingsIcon size={16} /> {t.settings}
            </button>
        </div>
    );

    const renderPasswordWarning = () => (
        <div className="mx-6 mt-4 p-4 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-xl flex items-center gap-3">
            <AlertTriangle className="text-red-600 dark:text-red-400 shrink-0" size={24} />
            <div className="flex-1">
                <p className="text-red-800 dark:text-red-200 font-bold text-sm">
                    ¡Contraseña por defecto detectada!
                </p>
                <p className="text-red-600 dark:text-red-300 text-xs">
                    Por seguridad, cambia la contraseña en la pestaña de <strong>Ajustes</strong>.
                </p>
            </div>
            <button
                onClick={() => setActiveTab('settings')}
                className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg transition-colors"
            >
                Ir a Ajustes
            </button>
        </div>
    );

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
            {renderHeader()}
            {renderTabs()}

            {isDefaultPassword && renderPasswordWarning()}

            <main className="p-6 max-w-5xl mx-auto">
                {activeTab === 'lists' && <ListsManager />}
                {activeTab === 'users' && <UsersManager />}
                {activeTab === 'categories' && <CategoryManager />}
                {activeTab === 'products' && <ProductManager />}
                {activeTab === 'settings' && <AdminSettings />}
            </main>
        </div>
    );
};

export default AdminDashboard;

