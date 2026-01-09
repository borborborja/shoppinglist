import { useState, useEffect } from 'react';
import { Database, Check, AlertTriangle, Loader, Shield, Save, Settings as SettingsIcon } from 'lucide-react';
import { defaultCategories, translations } from '../../data/constants';
import { pb } from '../../lib/pocketbase';
import { useShopStore } from '../../store/shopStore';

const AdminSettings = () => {
    const [seeding, setSeeding] = useState(false);
    const [status, setStatus] = useState('');

    // Password change state
    const [pwdData, setPwdData] = useState({ current: '', new: '', confirm: '' });
    const [pwdStatus, setPwdStatus] = useState({ msg: '', type: '' });
    const [pwdLoading, setPwdLoading] = useState(false);

    // Server Config state
    const [serverName, setServerNameState] = useState('');
    const [srvLoading, setSrvLoading] = useState(false);
    const [srvStatus, setSrvStatus] = useState({ msg: '', type: '' });


    useEffect(() => {
        // Initial load of server name
        const fetchConfig = async () => {
            try {
                const config = await pb.collection('admin_config').getFullList({ filter: 'key="server_name"' });
                if (config[0]) setServerNameState(config[0].value);
            } catch (e) {
                console.error(e);
            }
        };
        fetchConfig();
    }, []);

    const handleSaveServerName = async (e: React.FormEvent) => {
        e.preventDefault();
        setSrvLoading(true);
        setSrvStatus({ msg: '', type: '' });
        try {
            const config = await pb.collection('admin_config').getFullList({ filter: 'key="server_name"' });
            if (config[0]) {
                await pb.collection('admin_config').update(config[0].id, { value: serverName });
                useShopStore.getState().setServerName(serverName); // Update local store
                setSrvStatus({ msg: 'Configuración guardada', type: 'success' });
            }
        } catch (e: any) {
            setSrvStatus({ msg: `Error: ${e.message}`, type: 'error' });
        } finally {
            setSrvLoading(false);
        }
    };

    const handleImportDefaults = async () => {
        if (!confirm('Esto importará todos los datos por defecto a la base de datos. Si ya existen, se duplicarán (usa Borrar Todo antes si es necesario). ¿Continuar?')) return;

        setSeeding(true);
        setStatus('Iniciando importación...');

        try {
            const keys = Object.keys(defaultCategories);
            let totalCats = 0;
            let totalItems = 0;
            for (const key of keys) {
                const catData = defaultCategories[key];
                setStatus(`Importando categoría: ${key}...`);

                // Create Category
                const catRecord = await pb.collection('catalog_categories').create({
                    key: key,
                    icon: catData.icon,
                    color: key,
                    name_es: (translations as any).es.cats[key] || key,
                    name_ca: (translations as any).ca.cats[key] || key,
                    name_en: (translations as any).en.cats[key] || key
                });
                totalCats++;

                // Create Items
                for (const item of catData.items) {
                    await pb.collection('catalog_items').create({
                        category: catRecord.id,
                        name_es: item.es,
                        name_ca: item.ca,
                        name_en: item.en
                    });
                    totalItems++;
                }
            }

            setStatus(`¡Éxito! Importadas ${totalCats} categorías y ${totalItems} productos.`);
            setTimeout(() => setStatus(''), 5000);
        } catch (e: any) {
            console.error(e);
            setStatus(`Error: ${e.message}`);
        } finally {
            setSeeding(false);
        }
    };

    const handleWipe = async () => {
        if (!confirm('PELIGRO: Esto borrará TODAS las categorías y productos de la base de datos. ¿Estás seguro?')) return;

        setSeeding(true);
        setStatus('Borrando datos...');

        try {
            const items = await pb.collection('catalog_items').getFullList();
            for (const item of items) {
                await pb.collection('catalog_items').delete(item.id);
            }

            const cats = await pb.collection('catalog_categories').getFullList();
            for (const cat of cats) {
                await pb.collection('catalog_categories').delete(cat.id);
            }

            setStatus('Base de datos limpiada.');
        } catch (e: any) {
            setStatus(`Error: ${e.message}`);
        } finally {
            setSeeding(false);
        }
    }

    const handleChangePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (pwdData.new !== pwdData.confirm) {
            setPwdStatus({ msg: 'Las contraseñas no coinciden', type: 'error' });
            return;
        }
        if (pwdData.new.length < 4) {
            setPwdStatus({ msg: 'La contraseña debe tener al menos 4 caracteres', type: 'error' });
            return;
        }

        setPwdLoading(true);
        setPwdStatus({ msg: '', type: '' });

        try {
            // 1. Verify current password
            const records = await pb.collection('admin_config').getFullList({ filter: 'key="password"' });
            const pwdRecord = records[0];
            const currentDbPwd = pwdRecord?.value || 'admin123';

            if (pwdData.current !== currentDbPwd) {
                setPwdStatus({ msg: 'Contraseña actual incorrecta', type: 'error' });
                return;
            }

            // 2. Update or Create password record
            if (pwdRecord) {
                await pb.collection('admin_config').update(pwdRecord.id, { value: pwdData.new });
            } else {
                await pb.collection('admin_config').create({ key: 'password', value: pwdData.new });
            }

            setPwdStatus({ msg: '¡Contraseña actualizada correctamente!', type: 'success' });
            setPwdData({ current: '', new: '', confirm: '' });
        } catch (e: any) {
            setPwdStatus({ msg: `Error: ${e.message}`, type: 'error' });
        } finally {
            setPwdLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <h2 className="text-xl font-bold dark:text-white">Ajustes del Sistema</h2>

            <div className="grid gap-6 md:grid-cols-2">
                {/* Server Config Card */}
                <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
                    <div className="flex items-center gap-3 mb-4 text-blue-600 dark:text-blue-400">
                        <SettingsIcon size={24} />
                        <h3 className="font-bold text-lg">Configuración del Servidor</h3>
                    </div>
                    <form onSubmit={handleSaveServerName} className="space-y-4">
                        <div>
                            <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Nombre del Servidor</label>
                            <input
                                type="text"
                                value={serverName}
                                onChange={e => setServerNameState(e.target.value)}
                                className="w-full px-4 py-2 rounded-lg bg-slate-50 dark:bg-slate-900 border-none focus:ring-2 focus:ring-blue-500 dark:text-white text-sm"
                                placeholder="P. ej. La Lista de Compra"
                                required
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={srvLoading}
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 rounded-lg flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50"
                        >
                            {srvLoading ? <Loader className="animate-spin" size={18} /> : <Save size={18} />}
                            Guardar Configuración
                        </button>
                    </form>
                    {srvStatus.msg && (
                        <p className={`mt-3 text-sm font-bold p-2 rounded-lg text-center ${srvStatus.type === 'error' ? 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400' : 'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400'}`}>
                            {srvStatus.msg}
                        </p>
                    )}
                </div>

                {/* Password Change Card */}
                <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
                    <div className="flex items-center gap-3 mb-4 text-purple-600 dark:text-purple-400">
                        <Shield size={24} />
                        <h3 className="font-bold text-lg">Seguridad</h3>
                    </div>
                    <form onSubmit={handleChangePassword} className="space-y-3">
                        <div>
                            <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Contraseña Actual</label>
                            <input
                                type="password"
                                value={pwdData.current}
                                onChange={e => setPwdData({ ...pwdData, current: e.target.value })}
                                className="w-full px-4 py-2 rounded-lg bg-slate-50 dark:bg-slate-900 border-none focus:ring-2 focus:ring-purple-500 dark:text-white text-sm"
                                placeholder="••••••••"
                                required
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Nueva Contraseña</label>
                                <input
                                    type="password"
                                    value={pwdData.new}
                                    onChange={e => setPwdData({ ...pwdData, new: e.target.value })}
                                    className="w-full px-4 py-2 rounded-lg bg-slate-50 dark:bg-slate-900 border-none focus:ring-2 focus:ring-purple-500 dark:text-white text-sm"
                                    placeholder="••••••••"
                                    required
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Repetir Nueva</label>
                                <input
                                    type="password"
                                    value={pwdData.confirm}
                                    onChange={e => setPwdData({ ...pwdData, confirm: e.target.value })}
                                    className="w-full px-4 py-2 rounded-lg bg-slate-50 dark:bg-slate-900 border-none focus:ring-2 focus:ring-purple-500 dark:text-white text-sm"
                                    placeholder="••••••••"
                                    required
                                />
                            </div>
                        </div>
                        <button
                            type="submit"
                            disabled={pwdLoading}
                            className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 rounded-lg flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 mt-2"
                        >
                            {pwdLoading ? <Loader className="animate-spin" size={18} /> : <Save size={18} />}
                            Cambiar Contraseña
                        </button>
                    </form>
                    {pwdStatus.msg && (
                        <p className={`mt-3 text-sm font-bold p-2 rounded-lg text-center ${pwdStatus.type === 'error' ? 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400' : 'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400'}`}>
                            {pwdStatus.msg}
                        </p>
                    )}
                </div>

                {/* Data Maintenance Card */}
                <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 md:col-span-2">
                    <div className="flex items-center gap-3 mb-4 text-amber-600 dark:text-amber-400">
                        <Database size={24} />
                        <h3 className="font-bold text-lg">Mantenimiento de Datos</h3>
                    </div>
                    <div className="grid md:grid-cols-2 gap-8 items-start">
                        <div>
                            <p className="text-slate-500 text-sm mb-4">
                                Si la base de datos está vacía, puedes importar las categorías y productos por defecto (hardcoded) para empezar a editarlos.
                            </p>
                            <button
                                onClick={handleImportDefaults}
                                disabled={seeding}
                                className="w-full md:w-auto bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-bold py-2.5 px-6 rounded-lg flex items-center justify-center gap-2 disabled:opacity-50 transition-colors"
                            >
                                {seeding ? <Loader className="animate-spin" size={18} /> : <Check size={18} />}
                                Importar Defaults
                            </button>
                        </div>
                        <div className="border-t md:border-t-0 md:border-l border-slate-100 dark:border-slate-700 pt-6 md:pt-0 md:pl-8">
                            <p className="text-slate-500 text-sm mb-4">
                                Borrado total del catálogo. Esta acción es <span className="text-red-500 font-bold italic">irreversible</span>.
                            </p>
                            <button
                                onClick={handleWipe}
                                disabled={seeding}
                                className="w-full md:w-auto bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 text-red-600 dark:text-red-400 font-bold py-2.5 px-6 rounded-lg flex items-center justify-center gap-2 border border-red-200 dark:border-red-800 transition-colors"
                            >
                                <AlertTriangle size={18} />
                                Borrar Todo el Catálogo
                            </button>
                        </div>
                    </div>
                    {status && <p className="mt-6 text-sm font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700/50 p-4 rounded-lg border-l-4 border-amber-500">{status}</p>}
                </div>
            </div>
        </div>
    );
};

export default AdminSettings;
