import { useState, useEffect } from 'react';
import { pb } from '../../lib/pocketbase';
import { Trash2, Loader, RefreshCw, CheckSquare, Square, User, Clock, AlertTriangle, Shield, Ghost } from 'lucide-react';

interface UserRecord {
    id: string;
    username: string;
    display_name: string;
    current_list: string;
    last_active_at: string;
    updated: string;
    created: string;
}

const UsersManager = () => {
    const [users, setUsers] = useState<UserRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    useEffect(() => {
        loadUsers();
    }, []);

    const loadUsers = async () => {
        setLoading(true);
        try {
            const result = await pb.collection('users').getFullList<UserRecord>({ sort: '-last_active_at' });
            setUsers(result);
            setSelectedIds(new Set());
        } catch (e) {
            console.error(e);
            alert('Error cargando usuarios');
        } finally {
            setLoading(false);
        }
    };

    const toggleSelect = (id: string) => {
        const newSelected = new Set(selectedIds);
        if (newSelected.has(id)) {
            newSelected.delete(id);
        } else {
            newSelected.add(id);
        }
        setSelectedIds(newSelected);
    };

    const toggleSelectAll = () => {
        if (selectedIds.size === users.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(users.map(u => u.id)));
        }
    };

    const handleDelete = async () => {
        if (selectedIds.size === 0) return;
        const count = selectedIds.size;
        if (!confirm(`¿Estás seguro de que quieres borrar ${count} usuario${count > 1 ? 's' : ''}? Esta acción es irreversible.`)) return;

        setLoading(true);
        try {
            // Use sequential or individual handling to avoid one failure stopping everything
            const ids = Array.from(selectedIds);
            let successCount = 0;

            for (const id of ids) {
                try {
                    await pb.collection('users').delete(id);
                    successCount++;
                } catch (err) {
                    console.error(`Failed to delete user ${id}:`, err);
                }
            }

            if (successCount < ids.length) {
                alert(`Se borraron ${successCount} de ${ids.length} usuarios.`);
            }

            await loadUsers();
        } catch (e) {
            console.error(e);
            alert('Error general borrando usuarios');
            setLoading(false);
        }
    };

    const formatTime = (dateStr: string) => {
        if (!dateStr) return 'Nunca';
        return new Date(dateStr).toLocaleString();
    };

    const isActive = (user: UserRecord) => {
        if (!user.last_active_at) return false;
        const lastActive = new Date(user.last_active_at).getTime();
        const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
        return lastActive > fiveMinutesAgo;
    };

    const isStale = (user: UserRecord) => {
        if (!user.last_active_at) return true;
        const lastActive = new Date(user.last_active_at).getTime();
        const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
        return lastActive < thirtyDaysAgo;
    };

    if (loading && users.length === 0) return (
        <div className="flex flex-col items-center justify-center p-12 space-y-4">
            <Loader className="animate-spin text-blue-500" size={32} />
            <p className="text-slate-500 font-medium">Cargando usuarios...</p>
        </div>
    );

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-end">
                <div>
                    <h2 className="text-2xl font-black dark:text-white flex items-center gap-3">
                        Gestor de Usuarios
                        <button
                            onClick={loadUsers}
                            className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors"
                            title="Recargar"
                        >
                            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                        </button>
                    </h2>
                    <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                        Total: <span className="font-bold">{users.length}</span> |
                        Activos ahora: <span className="font-bold text-green-500">{users.filter(isActive).length}</span> |
                        Obsoletos: <span className="font-bold text-orange-500">{users.filter(isStale).length}</span>
                    </p>
                </div>
                <div className="flex gap-3">
                    {selectedIds.size > 0 && (
                        <button
                            onClick={handleDelete}
                            className="flex items-center gap-2 bg-red-600 text-white px-5 py-2.5 rounded-xl hover:bg-red-700 transition-all animate-fade-in shadow-lg shadow-red-500/20 font-bold active:scale-95"
                        >
                            <Trash2 size={18} /> Borrar seleccionados ({selectedIds.size})
                        </button>
                    )}
                </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-200 dark:border-slate-800 overflow-hidden transition-all">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50/50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
                                <th className="p-4 w-12">
                                    <button
                                        onClick={toggleSelectAll}
                                        className="flex items-center justify-center text-slate-400 hover:text-blue-500 transition-colors"
                                    >
                                        {users.length > 0 && selectedIds.size === users.length ?
                                            <CheckSquare size={22} className="text-blue-500" /> :
                                            <Square size={22} />
                                        }
                                    </button>
                                </th>
                                <th className="p-4 text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">Estado / Usuario</th>
                                <th className="p-4 text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">Lista Actual</th>
                                <th className="p-4 text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">Última Actividad</th>
                                <th className="p-4 text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">Nivel</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {users.map(user => {
                                const isSelected = selectedIds.has(user.id);
                                const active = isActive(user);
                                const stale = isStale(user);

                                return (
                                    <tr
                                        key={user.id}
                                        className={`group hover:bg-blue-50/30 dark:hover:bg-blue-900/5 transition-colors cursor-pointer ${isSelected ? 'bg-blue-50/80 dark:bg-blue-900/10' : ''}`}
                                        onClick={() => toggleSelect(user.id)}
                                    >
                                        <td className="p-4 text-center">
                                            <div className="flex justify-center transition-transform group-active:scale-90">
                                                {isSelected ?
                                                    <CheckSquare size={22} className="text-blue-500" /> :
                                                    <Square size={22} className="text-slate-300 dark:text-slate-700" />
                                                }
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex items-center gap-3">
                                                {active ? (
                                                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
                                                ) : stale ? (
                                                    <div className="text-orange-500/50" title="Obsoleto (>30d)"><Ghost size={14} /></div>
                                                ) : (
                                                    <div className="w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-700" />
                                                )}
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-slate-900 dark:text-slate-100 leading-none">
                                                        {user.display_name || user.username}
                                                    </span>
                                                    <span className="text-[10px] text-slate-400 font-medium mt-1">ID: {user.id}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            {user.current_list ? (
                                                <div className="flex items-center gap-1.5">
                                                    <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-md font-mono text-xs font-bold uppercase tracking-wider">
                                                        {user.current_list}
                                                    </span>
                                                </div>
                                            ) : (
                                                <span className="text-slate-300 dark:text-slate-700 text-xs italic">Ninguna</span>
                                            )}
                                        </td>
                                        <td className="p-4">
                                            <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                                                <Clock size={14} className="opacity-50" />
                                                <span className="text-sm font-medium">{formatTime(user.last_active_at)}</span>
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg w-fit">
                                                <Shield size={12} className="text-slate-400" />
                                                <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-tighter">Usuario</span>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                            {users.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="p-20 text-center">
                                        <div className="flex flex-col items-center gap-2 text-slate-400">
                                            <User size={48} className="opacity-20" />
                                            <p className="font-bold">No se encontraron usuarios.</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 px-6 py-4 rounded-2xl flex items-start gap-3">
                <AlertTriangle className="text-blue-500 mt-1" size={18} />
                <div className="text-sm text-blue-700 dark:text-blue-300 leading-relaxed">
                    <p className="font-black mb-1 leading-none uppercase tracking-tighter">Gestión de Usuarios</p>
                    Aquí puedes ver quién está usando la aplicación y en qué lista están suscritos actualmente. Los usuarios <strong>obsoletos</strong> (inactivos hace más de 30 días) pueden ser borrados de forma segura.
                </div>
            </div>
        </div>
    );
};

export default UsersManager;
