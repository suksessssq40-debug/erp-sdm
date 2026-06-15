import React, { useState } from 'react';
import { X, Save, AlertCircle, RefreshCw } from 'lucide-react';
import { ChartOfAccount } from '../../types';

interface CreateCoaModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: Partial<ChartOfAccount>) => Promise<void>;
    toast: any;
}

export const CreateCoaModal: React.FC<CreateCoaModalProps> = ({ isOpen, onClose, onSave, toast }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [formData, setFormData] = useState<Partial<ChartOfAccount>>({
        code: '',
        name: '',
        type: 'EXPENSE',
        normalPos: 'DEBIT',
        description: ''
    });

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            // Auto-set Normal Position base on Type if not manually set?
            // But let's respect user input or default
            await onSave(formData);
            onClose();
        } catch (error) {
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    // Auto-update Normal Position based on Type
    const handleTypeChange = (type: string) => {
        let normalPos = 'DEBIT';
        if (['REVENUE', 'INCOME', 'LIABILITY', 'EQUITY'].includes(type)) normalPos = 'CREDIT';
        setFormData(prev => ({ ...prev, type, normalPos }));
    };

    // Auto-detect Type & Pos based on Code
    const handleCodeChange = (code: string) => {
        const cleanCode = code.replace(/\D/g, '');
        let updates: Partial<ChartOfAccount> = { code: cleanCode };

        if (cleanCode.length >= 1) {
            const firstDigit = cleanCode[0];
            let type = 'ASSET';
            let pos = 'DEBIT';

            switch (firstDigit) {
                case '1': type = 'ASSET'; pos = 'DEBIT'; break;
                case '2': type = 'LIABILITY'; pos = 'CREDIT'; break;
                case '3': type = 'EQUITY'; pos = 'CREDIT'; break;
                case '4': type = 'INCOME'; pos = 'CREDIT'; break;
                case '5': case '6': case '7': case '8': case '9': type = 'EXPENSE'; pos = 'DEBIT'; break;
            }
            updates.type = type;
            updates.normalPos = pos;
        }
        setFormData(prev => ({ ...prev, ...updates }));
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-300 border border-slate-100">

                {/* Header */}
                <div className="bg-slate-50 px-8 py-6 border-b border-slate-100 flex justify-between items-center">
                    <div>
                        <h2 className="text-xl font-black text-slate-800 uppercase italic tracking-tight">Tambah Akun Baru</h2>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Chart of Accounts</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition text-slate-400 hover:text-slate-600">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-8 space-y-6">

                    {/* Kode Akun */}
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Kode Akun</label>
                        <input
                            type="text"
                            required
                            placeholder="Contoh: 5101"
                            value={formData.code}
                            onChange={e => handleCodeChange(e.target.value)}
                            className="w-full bg-slate-50 border-none rounded-2xl px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/20 transition placeholder:text-slate-300 font-mono"
                        />
                        <p className="text-[9px] text-slate-400 italic px-1 flex items-center gap-1">
                            <AlertCircle size={10} />
                            Kode harus unik & berupa angka.
                        </p>
                    </div>

                    {/* Nama Akun */}
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nama Akun</label>
                        <input
                            type="text"
                            required
                            placeholder="Contoh: Biaya Listrik Kantor"
                            value={formData.name}
                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                            className="w-full bg-slate-50 border-none rounded-2xl px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/20 transition placeholder:text-slate-300"
                        />
                    </div>

                    {/* Tipe Akun & Posisi */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tipe</label>
                            <select
                                value={formData.type}
                                onChange={e => handleTypeChange(e.target.value)}
                                className="w-full bg-slate-50 border-none rounded-2xl px-4 py-3 text-[11px] font-black uppercase text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/20 transition appearance-none cursor-pointer"
                            >
                                <option value="ASSET">HARTA (ASSET)</option>
                                <option value="LIABILITY">KEWAJIBAN (LIABILITY)</option>
                                <option value="EQUITY">MODAL (EQUITY)</option>
                                <option value="INCOME">PENDAPATAN (INCOME)</option>
                                <option value="EXPENSE">BEBAN (EXPENSE)</option>
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Saldo Normal</label>
                            <div className="w-full bg-slate-100 border-none rounded-2xl px-4 py-3 text-[11px] font-black uppercase text-slate-500 cursor-not-allowed">
                                {formData.normalPos}
                            </div>
                        </div>
                    </div>

                    {/* Description */}
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Keterangan (Opsional)</label>
                        <textarea
                            rows={2}
                            value={formData.description || ''}
                            onChange={e => setFormData({ ...formData, description: e.target.value })}
                            className="w-full bg-slate-50 border-none rounded-2xl px-4 py-3 text-xs font-medium text-slate-600 outline-none focus:ring-2 focus:ring-blue-500/20 transition resize-none"
                        ></textarea>
                    </div>

                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full bg-slate-900 text-white py-4 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-slate-800 active:scale-[0.98] transition shadow-xl shadow-slate-200 disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2"
                    >
                        {isLoading ? <RefreshCw className="animate-spin" size={16} /> : <Save size={16} />}
                        SIMPAN AKUN
                    </button>
                </form>
            </div>
        </div>
    );
};
