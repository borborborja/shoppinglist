import { useState, useEffect } from 'react';
import { Database, Check, AlertTriangle, Loader, Shield, Save, Settings as SettingsIcon, Download, Upload, Loader2, Users } from 'lucide-react';
import { defaultCategories, translations } from '../../data/constants';
import { pb } from '../../lib/pocketbase';
import { useShopStore } from '../../store/shopStore';
import ImportModal from './ImportModal';
import type { ImportOptions } from './ImportModal';

const AdminSettings = () => {
    const [seeding, setSeeding] = useState(false);
    const [status, setStatus] = useState('');

    // Password change state
    const [pwdData, setPwdData] = useState({ current: '', new: '', confirm: '' });
    const [pwdStatus, setPwdStatus] = useState({ msg: '', type: '' });
    const [pwdLoading, setPwdLoading] = useState(false);

    // Server Config state
    const [serverName, setServerNameState] = useState('');
    const [enableUsernames, setEnableUsernamesState] = useState(false);
    const [enableRemoteAccess, setEnableRemoteAccessState] = useState(false);
    const [enableWebApp, setEnableWebAppState] = useState(true);
    const [srvLoading, setSrvLoading] = useState(false);
    const [srvStatus, setSrvStatus] = useState({ msg: '', type: '' });

    // Backup/Import state
    const [importingFile, setImportingFile] = useState<{ name: string, data: any } | null>(null);


    useEffect(() => {
        // Initial load of server name and other config
        const fetchConfig = async () => {
            try {
                const config = await pb.collection('admin_config').getFullList();
                const srvRecord = config.find(c => c.key === 'server_name');
                if (srvRecord) setServerNameState(srvRecord.value);

                const userToggleRecord = config.find(c => c.key === 'enable_usernames');
                if (userToggleRecord) setEnableUsernamesState(userToggleRecord.value === 'true');

                const remoteRecord = config.find(c => c.key === 'enable_remote_access');
                if (remoteRecord) setEnableRemoteAccessState(remoteRecord.value === 'true');

                const webAppRecord = config.find(c => c.key === 'enable_web_app');
                if (webAppRecord) setEnableWebAppState(webAppRecord.value !== 'false');
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
            const config = await pb.collection('admin_config').getFullList();

            const srvRecord = config.find(c => c.key === 'server_name');
            if (srvRecord) await pb.collection('admin_config').update(srvRecord.id, { value: serverName });

            const userToggleRecord = config.find(c => c.key === 'enable_usernames');
            const toggleVal = enableUsernames ? 'true' : 'false';
            if (userToggleRecord) {
                await pb.collection('admin_config').update(userToggleRecord.id, { value: toggleVal });
            } else {
                await pb.collection('admin_config').create({ key: 'enable_usernames', value: toggleVal });
            }

            const remoteRecord = config.find(c => c.key === 'enable_remote_access');
            const remoteVal = enableRemoteAccess ? 'true' : 'false';
            if (remoteRecord) {
                await pb.collection('admin_config').update(remoteRecord.id, { value: remoteVal });
            } else {
                await pb.collection('admin_config').create({ key: 'enable_remote_access', value: remoteVal });
            }

            const webAppRecord = config.find(c => c.key === 'enable_web_app');
            const webAppVal = enableWebApp ? 'true' : 'false';
            if (webAppRecord) {
                await pb.collection('admin_config').update(webAppRecord.id, { value: webAppVal });
            } else {
                await pb.collection('admin_config').create({ key: 'enable_web_app', value: webAppVal });
            }

            useShopStore.getState().setServerName(serverName);
            useShopStore.getState().setEnableUsernames(enableUsernames);

            setSrvStatus({ msg: 'Configuración guardada', type: 'success' });
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

    const handleWipeUsers = async () => {
        if (!confirm('PELIGRO: Esto borrará TODOS los usuarios (invitados) de la base de datos. Se cerrará la sesión de todos. ¿Estás seguro?')) return;

        setSeeding(true);
        setStatus('Borrando usuarios...');

        try {
            const users = await pb.collection('users').getFullList();
            for (const user of users) {
                await pb.collection('users').delete(user.id);
            }
            setStatus('Todos los usuarios borrados.');
        } catch (e: any) {
            setStatus(`Error: ${e.message}`);
        } finally {
            setSeeding(false);
        }
    }

    const handleExport = async () => {
        setSeeding(true);
        setStatus('Preparando exportación...');
        try {
            const [cats, items] = await Promise.all([
                pb.collection('catalog_categories').getFullList(),
                pb.collection('catalog_items').getFullList()
            ]);

            // Map category IDs to keys for items
            const catMap = new Map();
            cats.forEach(c => catMap.set(c.id, c.key));

            const backup = {
                version: "1.0",
                backupDate: new Date().toISOString(),
                categories: cats.map(c => ({
                    key: c.key,
                    icon: c.icon,
                    color: c.color,
                    name_es: c.name_es,
                    name_ca: c.name_ca,
                    name_en: c.name_en,
                    hidden: c.hidden || false
                })),
                items: items.map(i => ({
                    category_key: catMap.get(i.category),
                    name_es: i.name_es,
                    name_ca: i.name_ca,
                    name_en: i.name_en,
                    hidden: i.hidden || false
                }))
            };

            const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `backup_catalog_${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            setStatus('Exportación completada con éxito.');
        } catch (e: any) {
            setStatus(`Error exportando: ${e.message}`);
        } finally {
            setSeeding(false);
        }
    };

    const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = JSON.parse(event.target?.result as string);
                if (!data.categories || !data.items) throw new Error('Formato de backup inválido');
                setImportingFile({ name: file.name, data });
            } catch (err: any) {
                alert(`Error al leer el archivo: ${err.message}`);
            }
        };
        reader.readAsText(file);
        // Reset input
        e.target.value = '';
    };

    const executeImport = async (opts: ImportOptions) => {
        if (!importingFile) return;
        const { data } = importingFile;

        setStatus('Iniciando importación del backup...');

        try {
            if (opts.mode === 'substitute') {
                setStatus('Limpiando base de datos actual...');
                const [oldItems, oldCats] = await Promise.all([
                    pb.collection('catalog_items').getFullList(),
                    pb.collection('catalog_categories').getFullList()
                ]);
                for (const i of oldItems) await pb.collection('catalog_items').delete(i.id);
                for (const c of oldCats) await pb.collection('catalog_categories').delete(c.id);
                setStatus('Base de datos limpia.');
            }

            // 1. Create/Find Categories
            const catIdMap = new Map(); // key -> id
            const existingCats = opts.mode === 'combine' ? await pb.collection('catalog_categories').getFullList() : [];

            for (const cat of data.categories) {
                setStatus(`Procesando categoría: ${cat.key}...`);
                let record;
                const existing = existingCats.find(c => c.key === cat.key);

                const catData = {
                    key: cat.key,
                    icon: cat.icon,
                    color: cat.color,
                    name_es: cat.name_es,
                    name_ca: cat.name_ca,
                    name_en: cat.name_en,
                    hidden: opts.applyHidden ? (cat.hidden || false) : false
                };

                if (existing) {
                    record = await pb.collection('catalog_categories').update(existing.id, catData);
                } else {
                    record = await pb.collection('catalog_categories').create(catData);
                }
                catIdMap.set(cat.key, record.id);
            }

            // 2. Create/Find Items
            const existingItems = opts.mode === 'combine' ? await pb.collection('catalog_items').getFullList() : [];

            for (let i = 0; i < data.items.length; i++) {
                const item = data.items[i];
                if (i % 10 === 0) setStatus(`Importando productos (${i}/${data.items.length})...`);

                const catId = catIdMap.get(item.category_key);
                if (!catId) continue;

                const itemData = {
                    category: catId,
                    name_es: item.name_es,
                    name_ca: item.name_ca,
                    name_en: item.name_en,
                    hidden: opts.applyHidden ? (item.hidden || false) : false
                };

                const existing = existingItems.find(ei =>
                    ei.category === catId &&
                    ei.name_es.toLowerCase() === item.name_es.toLowerCase()
                );

                if (existing) {
                    await pb.collection('catalog_items').update(existing.id, itemData);
                } else {
                    await pb.collection('catalog_items').create(itemData);
                }
            }

            setStatus('Backup importado correctamente.');
            // Reload local catalog
            useShopStore.getState().loadCatalog();
        } catch (e: any) {
            console.error(e);
            throw new Error(`Error en la importación: ${e.message}`);
        }
    };

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
            // First, verify current password by authenticating
            let authData;
            try {
                authData = await pb.collection('site_admins').authWithPassword('admin', pwdData.current);
            } catch (authErr: any) {
                console.error('Auth error:', authErr);
                setPwdStatus({ msg: 'Contraseña actual incorrecta', type: 'error' });
                setPwdLoading(false);
                return;
            }

            const adminId = authData.record.id;

            // Update password using PocketBase auth update
            await pb.collection('site_admins').update(adminId, {
                oldPassword: pwdData.current,
                password: pwdData.new,
                passwordConfirm: pwdData.new
            });

            setPwdStatus({ msg: '¡Contraseña actualizada correctamente!', type: 'success' });
            setPwdData({ current: '', new: '', confirm: '' });
        } catch (e: any) {
            console.error('Password change error:', e);
            setPwdStatus({ msg: `Error: ${e.message || 'Error desconocido'}`, type: 'error' });
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

                        <div className="p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                    <SettingsIcon size={16} className="text-green-600 dark:text-green-400" />
                                    <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300">Aplicación Web (Pública)</h4>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setEnableWebAppState(!enableWebApp)}
                                    className={`relative w-10 h-5 rounded-full transition-colors duration-300 ${enableWebApp ? 'bg-green-500' : 'bg-slate-300 dark:bg-slate-700'}`}
                                >
                                    <div className={`absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow-md transform transition-transform duration-300 ${enableWebApp ? 'translate-x-5' : 'translate-x-0'}`}></div>
                                </button>
                            </div>
                            <p className="text-[10px] text-green-700 dark:text-green-300">
                                🌍 Si se desactiva, la web mostrará un mensaje de "Solo Móvil". La API y Admin seguirán funcionando. Ideal para modo "Backend Only".
                            </p>
                        </div>

                        {/* Usernames Toggle with Beta Warning */}
                        <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                    <Users size={16} className="text-amber-600 dark:text-amber-400" />
                                    <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300">Nombres de Usuario</h4>
                                    <span className="text-[9px] font-black uppercase px-1.5 py-0.5 bg-amber-500 text-white rounded">BETA</span>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setEnableUsernamesState(!enableUsernames)}
                                    className={`relative w-10 h-5 rounded-full transition-colors duration-300 ${enableUsernames ? 'bg-amber-500' : 'bg-slate-300 dark:bg-slate-700'}`}
                                >
                                    <div className={`absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow-md transform transition-transform duration-300 ${enableUsernames ? 'translate-x-5' : 'translate-x-0'}`}></div>
                                </button>
                            </div>
                            <p className="text-[10px] text-amber-700 dark:text-amber-300">
                                ⚠️ Función experimental. Permite que los usuarios elijan un nombre para mostrar quién está conectado a la lista. Puede ser inestable.
                            </p>
                        </div>

                        {/* Remote Access Toggle */}
                        <div className="p-3 rounded-lg bg-cyan-50 dark:bg-cyan-900/20 border border-cyan-200 dark:border-cyan-800">
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                    <SettingsIcon size={16} className="text-cyan-600 dark:text-cyan-400" />
                                    <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300">Acceso Remoto (Apps)</h4>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setEnableRemoteAccessState(!enableRemoteAccess)}
                                    className={`relative w-10 h-5 rounded-full transition-colors duration-300 ${enableRemoteAccess ? 'bg-cyan-500' : 'bg-slate-300 dark:bg-slate-700'}`}
                                >
                                    <div className={`absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow-md transform transition-transform duration-300 ${enableRemoteAccess ? 'translate-x-5' : 'translate-x-0'}`}></div>
                                </button>
                            </div>
                            <p className="text-[10px] text-cyan-700 dark:text-cyan-300">
                                📱 Permite que apps móviles (Capacitor) se conecten a este servidor. Desactivado por defecto por seguridad.
                            </p>
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

                {/* System Info Card (Version Check) */}
                <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
                    <div className="flex items-center gap-3 mb-4 text-slate-600 dark:text-slate-400">
                        <SettingsIcon size={24} />
                        <h3 className="font-bold text-lg">Sistema</h3>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-xs font-bold text-slate-500 uppercase">Versión Actual</span>
                            <span className="text-sm font-mono font-bold text-slate-700 dark:text-slate-200">v{import.meta.env.VITE_APP_VERSION}</span>
                        </div>

                        <VersionChecker />
                    </div>
                </div>

                {/* CATALOG Data Maintenance Card */}
                <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
                    <div className="flex items-center gap-3 mb-4 text-amber-600 dark:text-amber-400">
                        <Database size={24} />
                        <h3 className="font-bold text-lg">Catálogo de Productos</h3>
                    </div>
                    <p className="text-slate-500 text-sm mb-4">
                        Gestión de categorías y productos de la lista de la compra.
                    </p>
                    <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-2">
                            <button
                                onClick={handleImportDefaults}
                                disabled={seeding}
                                className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-bold py-2 px-4 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 transition-colors text-sm"
                            >
                                {seeding ? <Loader className="animate-spin" size={16} /> : <Check size={16} />}
                                Defaults
                            </button>
                            <button
                                onClick={handleExport}
                                disabled={seeding}
                                className="bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/40 text-blue-600 dark:text-blue-400 font-bold py-2 px-4 rounded-xl flex items-center justify-center gap-2 border border-blue-100 dark:border-blue-800 transition-colors text-sm"
                            >
                                <Download size={16} />
                                Exportar
                            </button>
                        </div>
                        <label className={`bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer shadow-lg shadow-indigo-500/20 ${seeding ? 'opacity-50 pointer-events-none' : ''}`}>
                            <Upload size={20} />
                            Importar Backup (.json)
                            <input type="file" accept=".json" onChange={handleImportFile} className="hidden" />
                        </label>
                        <button
                            onClick={handleWipe}
                            disabled={seeding}
                            className="w-full bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 text-red-600 dark:text-red-400 font-bold py-2.5 px-6 rounded-lg flex items-center justify-center gap-2 border border-red-200 dark:border-red-800 transition-colors text-sm"
                        >
                            <AlertTriangle size={16} />
                            Borrar Todo el Catálogo
                        </button>
                    </div>
                </div>

                {/* USERS Database Card (Beta) */}
                <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-amber-200 dark:border-amber-800">
                    <div className="flex items-center gap-3 mb-4 text-amber-600 dark:text-amber-400">
                        <Users size={24} />
                        <h3 className="font-bold text-lg">Base de Datos de Usuarios</h3>
                        <span className="text-[9px] font-black uppercase px-1.5 py-0.5 bg-amber-500 text-white rounded">BETA</span>
                    </div>
                    <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800 mb-4">
                        <p className="text-[11px] text-amber-700 dark:text-amber-300">
                            ⚠️ Esta sección gestiona los usuarios creados por el sistema de presencia (función beta).
                            Solo es relevante si has habilitado "Nombres de Usuario" en la configuración.
                        </p>
                    </div>
                    <p className="text-slate-500 text-sm mb-4">
                        Borrar todos los usuarios invitados forzará la regeneración de cuentas cuando se vuelvan a conectar.
                    </p>
                    <button
                        onClick={handleWipeUsers}
                        disabled={seeding}
                        className="w-full bg-orange-50 hover:bg-orange-100 dark:bg-orange-900/20 dark:hover:bg-orange-900/40 text-orange-600 dark:text-orange-400 font-bold py-2.5 px-6 rounded-lg flex items-center justify-center gap-2 border border-orange-200 dark:border-orange-800 transition-colors"
                    >
                        <Users size={18} />
                        Borrar Todos los Usuarios
                    </button>
                </div>
            </div>

            {status && (
                <div className="flex items-start gap-3 bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                    {seeding ? <Loader2 className="animate-spin text-amber-500 shrink-0 mt-0.5" size={18} /> : <Check className="text-green-500 shrink-0 mt-0.5" size={18} />}
                    <p className="text-sm font-bold text-slate-700 dark:text-slate-300">{status}</p>
                </div>
            )}

            {importingFile && (
                <ImportModal
                    filename={importingFile.name}
                    onClose={() => setImportingFile(null)}
                    onConfirm={executeImport}
                />
            )}
        </div>
    );
};

const VersionChecker = () => {
    const [status, setStatus] = useState<'loading' | 'uptodate' | 'outdated' | 'error'>('loading');
    const [latest, setLatest] = useState('');
    const [url, setUrl] = useState('');

    useEffect(() => {
        const check = async () => {
            try {
                const res = await fetch('https://api.github.com/repos/borborborja/shoppinglist/releases/latest');
                const data = await res.json();
                const latestRel = data.tag_name?.replace('v', '') || '0.0.0';
                setLatest(latestRel);
                setUrl(data.html_url);

                const current = (import.meta.env.VITE_APP_VERSION || '0.0.0').replace('v', '');

                // Simple compare
                const isNewer = latestRel.localeCompare(current, undefined, { numeric: true, sensitivity: 'base' }) > 0;
                setStatus(isNewer ? 'outdated' : 'uptodate');
            } catch (e) {
                setStatus('error');
            }
        };
        check();
    }, []);

    if (status === 'loading') return <div className="text-[10px] text-slate-400 flex items-center gap-1"><Loader2 size={10} className="animate-spin" /> Comprobando actualizaciones...</div>;

    if (status === 'error') return <div className="text-[10px] text-red-400">Error comprobando versión (GitHub API).</div>;

    if (status === 'uptodate') return (
        <div className="flex items-center gap-2 text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-3 py-2 rounded-lg border border-green-200 dark:border-green-800">
            <Check size={14} />
            <span className="text-xs font-bold">Sistema Actualizado</span>
        </div>
    );

    return (
        <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-3 py-2 rounded-lg border border-amber-200 dark:border-amber-800">
                <AlertTriangle size={14} />
                <span className="text-xs font-bold">Nueva versión disponible: v{latest}</span>
            </div>
            <a href={url} target="_blank" rel="noopener noreferrer" className="text-center text-[10px] font-bold text-blue-500 hover:underline">
                Ver en GitHub
            </a>
        </div>
    );
};

export default AdminSettings;
