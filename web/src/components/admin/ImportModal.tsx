import { X, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
import { useState } from 'react';

export interface ImportOptions {
    mode: 'combine' | 'substitute';
    applyHidden: boolean;
}

interface ImportModalProps {
    filename: string;
    onClose: () => void;
    onConfirm: (options: ImportOptions) => Promise<void>;
}

const ImportModal = ({ filename, onClose, onConfirm }: ImportModalProps) => {
    const [options, setOptions] = useState<ImportOptions>({
        mode: 'combine',
        applyHidden: true
    });
    const [loading, setLoading] = useState(false);
    const [done, setDone] = useState(false);
    const [error, setError] = useState('');

    const handleProceed = async () => {
        setLoading(true);
        setError('');
        try {
            await onConfirm(options);
            setDone(true);
        } catch (e: any) {
            setError(e.message || 'Error durante la importación');
        } finally {
            setLoading(false);
        }
    };

    if (done) {
        return (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                <div className="bg-white dark:bg-slate-800 rounded-3xl p-8 max-w-sm w-full shadow-2xl text-center flex flex-col items-center">
                    <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-full flex items-center justify-center mb-4">
                        <CheckCircle2 size={32} />
                    </div>
                    <h3 className="text-xl font-black text-slate-800 dark:text-white mb-2">¡Importación completada!</h3>
                    <p className="text-slate-500 text-sm mb-6">Los datos se han procesado correctamente.</p>
                    <button
                        onClick={onClose}
                        className="w-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 py-3 rounded-xl font-bold transition-all"
                    >
                        Cerrar
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 dark:border-slate-700">
                <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
                    <div>
                        <h3 className="text-lg font-black text-slate-800 dark:text-white">Importar Backup</h3>
                        <p className="text-xs text-slate-400 font-bold uppercase">{filename}</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors">
                        <X size={20} className="text-slate-400" />
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    {/* Mode Selection */}
                    <div className="space-y-3">
                        <label className="text-xs font-black uppercase text-slate-400">Método de Importación</label>
                        <div className="grid grid-cols-1 gap-2">
                            <button
                                onClick={() => setOptions({ ...options, mode: 'combine' })}
                                className={`flex items-start gap-4 p-4 rounded-2xl border-2 transition-all text-left ${options.mode === 'combine' ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-900/10' : 'border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50'}`}
                            >
                                <div className={`mt-1 w-4 h-4 rounded-full border-2 flex items-center justify-center ${options.mode === 'combine' ? 'border-blue-500' : 'border-slate-300'}`}>
                                    {options.mode === 'combine' && <div className="w-2 h-2 bg-blue-500 rounded-full" />}
                                </div>
                                <div>
                                    <div className="font-bold text-slate-800 dark:text-white dark:text-white">Combinar</div>
                                    <div className="text-xs text-slate-500">Mantiene los datos actuales y añade los nuevos del backup.</div>
                                </div>
                            </button>
                            <button
                                onClick={() => setOptions({ ...options, mode: 'substitute' })}
                                className={`flex items-start gap-4 p-4 rounded-2xl border-2 transition-all text-left ${options.mode === 'substitute' ? 'border-amber-500 bg-amber-50/50 dark:bg-amber-900/10' : 'border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50'}`}
                            >
                                <div className={`mt-1 w-4 h-4 rounded-full border-2 flex items-center justify-center ${options.mode === 'substitute' ? 'border-amber-500' : 'border-slate-300'}`}>
                                    {options.mode === 'substitute' && <div className="w-2 h-2 bg-amber-500 rounded-full" />}
                                </div>
                                <div>
                                    <div className="font-bold text-slate-800 dark:text-white">Substituir</div>
                                    <div className="text-xs text-slate-500 text-amber-600 dark:text-amber-400 flex items-center gap-1">
                                        <AlertTriangle size={12} /> Borra TODO el catálogo actual antes de importar.
                                    </div>
                                </div>
                            </button>
                        </div>
                    </div>

                    {/* Checkbox Options */}
                    <div className="space-y-3 pt-2">
                        <label className="text-xs font-black uppercase text-slate-400">Reglas Adicionales</label>
                        <label className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700 cursor-pointer hover:bg-slate-100 transition-colors">
                            <input
                                type="checkbox"
                                checked={options.applyHidden}
                                onChange={e => setOptions({ ...options, applyHidden: e.target.checked })}
                                className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                            />
                            <div className="text-sm font-bold text-slate-700 dark:text-slate-200">Respetar estado de "Oculto"</div>
                        </label>
                        <p className="text-[10px] text-slate-400 px-1 leading-tight">
                            Si se activa, los productos que estaban marcados como ocultos en el backup se importarán como ocultos. Si se desactiva, todos se importarán como visibles.
                        </p>
                    </div>

                    {error && (
                        <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm font-bold rounded-xl flex items-center gap-2">
                            <AlertTriangle size={16} /> {error}
                        </div>
                    )}
                </div>

                <div className="p-6 bg-slate-50 dark:bg-slate-800/50 flex gap-3">
                    <button
                        onClick={onClose}
                        disabled={loading}
                        className="flex-1 px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 font-bold text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 transition-all disabled:opacity-50"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleProceed}
                        disabled={loading}
                        className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-bold text-white transition-all shadow-lg active:scale-95 disabled:opacity-50 ${options.mode === 'combine' ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/20' : 'bg-amber-600 hover:bg-amber-700 shadow-amber-500/20'}`}
                    >
                        {loading ? <Loader2 className="animate-spin" size={20} /> : 'Empezar Importación'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ImportModal;
