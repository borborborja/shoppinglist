import { useState } from 'react';
import { Lock, Loader, User } from 'lucide-react';
import { pb } from '../../lib/pocketbase';

interface AdminLoginProps {
    onLogin: () => void;
}

const AdminLogin = ({ onLogin }: AdminLoginProps) => {
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            // Authenticate with the site_admins collection (username is always 'admin')
            await pb.collection('site_admins').authWithPassword('admin', password);
            onLogin();
        } catch (err: any) {
            console.error('Login error:', err);
            setError('Usuario o contraseña incorrectos');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-slate-100 dark:bg-slate-900">
            <div className="w-full max-w-md p-8 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 animate-slide-up">
                <div className="flex flex-col items-center mb-6">
                    <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mb-4 text-blue-600 dark:text-blue-400">
                        <Lock size={32} />
                    </div>
                    <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Admin Panel</h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Acceso restringido</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Usuario</label>
                        <div className="relative">
                            <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                            <input
                                type="text"
                                value="admin"
                                disabled
                                className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-200 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-500 dark:text-slate-400 cursor-not-allowed"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Contraseña</label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-white"
                            />
                        </div>
                        {error && <p className="text-red-500 text-sm mt-2 ml-1">{error}</p>}
                    </div>
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-lg shadow-blue-500/30 transition transform active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {loading ? <Loader className="animate-spin" size={20} /> : 'Entrar'}
                    </button>
                </form>

                <p className="text-center text-xs text-slate-400 mt-4">
                    Por defecto: admin / admin123
                </p>
            </div>
        </div>
    );
};

export default AdminLogin;
