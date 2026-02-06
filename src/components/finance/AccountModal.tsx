import React, { useState, useEffect } from 'react';
import { FinancialAccountDef } from '../../types';
import { CreditCard, Trash2 } from 'lucide-react';
import { useToast } from '../Toast';

interface AccountModalProps {
    isOpen: boolean;
    onClose: () => void;
    isEditing: boolean;
    initialData: Partial<FinancialAccountDef>;
    onSave: (data: FinancialAccountDef) => Promise<void>;
    onDelete?: (id: string) => Promise<void>;
    toast: ReturnType<typeof useToast>;
}

export const AccountModal: React.FC<AccountModalProps> = ({
    isOpen, onClose, isEditing, initialData,
    onSave, onDelete, toast
}) => {
    const [formData, setFormData] = useState<Partial<FinancialAccountDef>>(initialData);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setFormData(initialData);
            setIsSubmitting(false);
        }
    }, [isOpen, initialData]);

    if (!isOpen) return null;

    const handleSubmit = async () => {
        if (isSubmitting) return;
        if (!formData.name || !formData.bankName) {
            toast.warning("Nama Akun dan Nama Bank wajib diisi");
            return;
        }

        setIsSubmitting(true);
        try {
            await onSave(formData as FinancialAccountDef);
            onClose();
        } catch (error) {
            toast.error("Gagal menyimpan data rekening.");
            setIsSubmitting(false);
        }
    };

    const handleDelete = async () => {
        if (!isEditing || !formData.id || !onDelete) return;
        if (confirm(`Yakin ingin menghapus rekening ${formData.name}? Data akan dinonaktifkan.`)) {
            await onDelete(formData.id);
            onClose();
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/90 backdrop-blur-md p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-[3.5rem] w-full max-w-lg p-12 shadow-2xl border border-white/20 animate-in zoom-in duration-300">
                <div className="flex justify-between items-center mb-10">
                    <div>
                        <h3 className="text-2xl font-black text-slate-800 leading-tight italic uppercase tracking-tighter">{isEditing ? 'Edit Rekening' : 'Tambah Rekening'}</h3>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">{isEditing ? 'PERBARUI DATA' : 'BUAT BARU'}</p>
                    </div>
                    <button onClick={onClose} className="p-4 bg-slate-100 rounded-2xl text-slate-400 hover:text-rose-500 transition">✕</button>
                </div>

                <div className="space-y-6">
                    <div className="space-y-3">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">NAMA IDENTIFIER AKUN (ALIAS)</label>
                        <input
                            className="w-full p-5 bg-slate-50 border-2 border-transparent rounded-[1.5rem] text-xs font-bold outline-none focus:border-blue-600 focus:bg-white transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                            placeholder="Contoh: Mandiri Utama..."
                            value={formData.name || ''}
                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                            disabled={isSubmitting}
                        />
                    </div>

                    <div className="space-y-3">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">NAMA BANK</label>
                        <input
                            className="w-full p-5 bg-slate-50 border-2 border-transparent rounded-[1.5rem] text-xs font-bold outline-none focus:border-blue-600 focus:bg-white transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                            placeholder="Contoh: Bank BCA, Bank Mandiri..."
                            value={formData.bankName || ''}
                            onChange={e => setFormData({ ...formData, bankName: e.target.value })}
                            disabled={isSubmitting}
                        />
                    </div>

                    <div className="space-y-3">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">NOMOR REKENING (OPSIONAL)</label>
                        <div className="relative">
                            <CreditCard size={16} className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300" />
                            <input
                                className="w-full pl-14 p-5 bg-slate-50 border-2 border-transparent rounded-[1.5rem] text-xs font-bold outline-none focus:border-blue-600 focus:bg-white transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                placeholder="0000-0000-0000"
                                value={formData.accountNumber || ''}
                                onChange={e => setFormData({ ...formData, accountNumber: e.target.value })}
                                disabled={isSubmitting}
                            />
                        </div>
                    </div>

                    <div className="space-y-3">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">DESKRIPSI SINGKAT</label>
                        <input
                            className="w-full p-5 bg-slate-50 border-2 border-transparent rounded-[1.5rem] text-xs font-bold outline-none focus:border-blue-600 focus:bg-white transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                            placeholder="Contoh: Rekening Operasional Harian"
                            value={formData.description || ''}
                            onChange={e => setFormData({ ...formData, description: e.target.value })}
                            disabled={isSubmitting}
                        />
                    </div>

                    <div className="flex gap-6 pt-8 border-t border-slate-50 mt-4">
                        {isEditing && onDelete && (
                            <button
                                onClick={handleDelete}
                                disabled={isSubmitting}
                                className="p-5 bg-rose-50 text-rose-500 hover:bg-rose-500 hover:text-white rounded-[2rem] transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Trash2 size={20} />
                            </button>
                        )}
                        <button
                            onClick={handleSubmit}
                            disabled={isSubmitting}
                            className={`flex-1 py-5 text-white rounded-[2rem] font-black uppercase tracking-[0.2em] transition text-[10px] shadow-2xl shadow-slate-200 flex items-center justify-center gap-3 ${isSubmitting ? 'bg-slate-400 cursor-not-allowed' : 'bg-slate-900 hover:bg-blue-600'}`}
                        >
                            {isSubmitting ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    MENYIMPAN...
                                </>
                            ) : 'Simpan Data'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
