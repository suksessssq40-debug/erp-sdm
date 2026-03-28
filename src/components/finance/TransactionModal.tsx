import React, { useState, useEffect } from 'react';
import { Transaction, TransactionType, FinancialAccountDef, TransactionCategory, BusinessUnit, ChartOfAccount } from '../../types';
import { Landmark, Search, CreditCard, User as UserIcon, BookOpen } from 'lucide-react';
import { useToast } from '../Toast';

interface TransactionModalProps {
    isOpen: boolean;
    onClose: () => void;
    isEditing: boolean;
    initialData: Transaction;

    financialAccounts: FinancialAccountDef[];
    categories: TransactionCategory[];
    coaList?: ChartOfAccount[];
    businessUnits: BusinessUnit[];

    onSave: (data: Transaction) => Promise<void>;

    onAddAccount?: (acc: FinancialAccountDef) => Promise<void>;
    onAddCategory?: (cat: TransactionCategory) => Promise<void>;

    uploadFile?: (file: File) => Promise<string>;
    toast: ReturnType<typeof useToast>;
}

export const TransactionModal: React.FC<TransactionModalProps> = ({
    isOpen, onClose, isEditing, initialData,
    financialAccounts, coaList = [], businessUnits,
    onSave, toast
}) => {
    const [formData, setFormData] = useState<Transaction>(initialData);
    const [debitSearch, setDebitSearch] = useState('');
    const [creditSearch, setCreditSearch] = useState('');
    const [showDebitDropdown, setShowDebitDropdown] = useState(false);
    const [showCreditDropdown, setShowCreditDropdown] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [mode, setMode] = useState<'CASH' | 'GENERAL'>('CASH');

    useEffect(() => {
        if (isOpen) {
            const isGeneral = isEditing && !initialData.accountId;
            setMode(isGeneral ? 'GENERAL' : 'CASH');

            setFormData({
                ...initialData,
                status: 'PAID',
                date: initialData.date ? initialData.date : new Date().toISOString()
            });

            // Universal Loading: Debit is always 'account', Credit is always 'category'
            if (isEditing) {
                setDebitSearch(initialData.account || '');
                setCreditSearch(initialData.category || '');
            } else {
                setDebitSearch('');
                setCreditSearch('');
            }
        }
    }, [isOpen, initialData, coaList, isEditing]);

    const handleSubmit = async () => {
        if (isSubmitting) return;

        if (formData.amount <= 0) {
            toast.warning("Nominal harus lebih dari 0");
            return;
        }

        if (!debitSearch || !creditSearch) {
            toast.warning("Lengkapi Akun Debet dan Akun Kredit");
            return;
        }

        if (!formData.description) {
            toast.warning("Deskripsi wajib diisi");
            return;
        }

        setIsSubmitting(true);

        try {
            const payload: Transaction & { isNonCash?: boolean } = {
                ...formData,
                status: 'PAID',
                account: debitSearch,      // Now representing any account on Debit
                category: creditSearch,    // Now representing any account on Credit
                type: TransactionType.IN,  // Backend will determine real P&L type (IN/OUT)
                date: formData.date ? new Date(formData.date).toISOString() : new Date().toISOString(),
                isNonCash: true            // Use universal processing logic
            };

            await onSave(payload);
            onClose();
        } catch (e) {
            console.error("Submit Error", e);
            toast.error("Gagal menyimpan transaksi.");
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    // Unified account search (Bank + COA)
    const getFilteredAccounts = (q: string) => {
        const query = q.toLowerCase();
        const results: any[] = [];

        // Banks
        financialAccounts.forEach(acc => {
            if (acc.isActive !== false && acc.name.toLowerCase().includes(query)) {
                results.push({ id: acc.id, name: acc.name, type: 'BANK', icon: <Landmark size={14} /> });
            }
        });

        // COAs
        coaList.forEach(coa => {
            if (coa.isActive !== false && (coa.name.toLowerCase().includes(query) || coa.code.includes(query))) {
                results.push({ id: coa.id, name: `${coa.code} - ${coa.name}`, type: coa.type, isCoa: true, icon: <BookOpen size={14} /> });
            }
        });

        return results.slice(0, 50);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/90 backdrop-blur-xl p-4 animate-in fade-in duration-300">
            <div className="bg-white rounded-[3.5rem] w-full max-w-2xl p-12 shadow-[0_35px_60px_-15px_rgba(0,0,0,0.3)] border border-white/20 animate-in zoom-in duration-500 overflow-y-auto max-h-[90vh] custom-scrollbar">

                <div className="flex justify-between items-center mb-10">
                    <div>
                        <h3 className="text-3xl font-black text-slate-800 italic uppercase tracking-tighter leading-none">
                            {isEditing ? 'Koreksi Jurnal' : 'Entri Jurnal'}
                        </h3>
                        <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mt-3 flex items-center gap-2">
                            <span className="w-4 h-px bg-emerald-600"></span> UNIVERSAL JOURNAL SYSTEM
                        </p>
                    </div>
                    <button onClick={onClose} className="w-12 h-12 bg-slate-100 rounded-2xl text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-all flex items-center justify-center font-bold">✕</button>
                </div>

                <div className="space-y-8">
                    <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-4">TANGGAL TRANSAKSI</label>
                            <input type="date" className="w-full px-7 py-4 bg-slate-50 border-2 border-transparent focus:border-blue-500 rounded-3xl text-sm font-bold outline-none transition-all shadow-sm"
                                value={formData.date ? formData.date.split('T')[0] : ''}
                                onChange={e => setFormData({ ...formData, date: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-4">UNIT BISNIS</label>
                            <select className="w-full px-7 py-4 bg-slate-50 border-2 border-transparent focus:border-blue-500 rounded-3xl text-sm font-bold outline-none transition-all shadow-sm uppercase"
                                value={formData.businessUnitId || ''}
                                onChange={e => setFormData({ ...formData, businessUnitId: e.target.value })}
                            >
                                <option value="">Shared / Umum</option>
                                {businessUnits.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                            </select>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">NOMINAL TRANSAKSI</label>
                        <div className="relative group">
                            <span className="absolute left-8 top-1/2 -translate-y-1/2 text-2xl font-black text-slate-300 group-focus-within:text-blue-500 transition-colors">Rp</span>
                            <input
                                type="text"
                                inputMode="numeric"
                                className="w-full text-4xl font-black pl-20 pr-8 py-7 bg-slate-900 border-2 border-transparent focus:border-blue-500 rounded-[2.5rem] outline-none transition-all text-white shadow-2xl tabular-nums placeholder:text-slate-800"
                                placeholder="0"
                                value={formData.amount ? new Intl.NumberFormat('id-ID').format(Number(formData.amount)) : ''}
                                onChange={e => {
                                    // Remove formatting characters (like dot) to get raw numbers
                                    const raw = e.target.value.replace(/[^0-9]/g, '');
                                    const val = raw ? parseFloat(raw) : 0;
                                    setFormData({ ...formData, amount: val });
                                }}
                                onWheel={(e) => (e.target as HTMLElement).blur()}
                            />
                        </div>
                    </div>

                    {/* DEBIT SIDE */}
                    <div className="space-y-3">
                        <div className="flex justify-between items-center px-4">
                            <label className="text-[11px] font-black text-emerald-600 uppercase tracking-widest flex items-center gap-2">
                                <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                                KOLOM DEBIT (PENERIMA / PENAMBAHAN ASET)
                            </label>
                        </div>
                        <div className="relative">
                            <div className="absolute left-6 top-1/2 -translate-y-1/2 w-8 h-8 bg-emerald-100/50 rounded-xl flex items-center justify-center text-emerald-600 font-black text-xs shadow-sm">D</div>
                            <input className="w-full pl-16 pr-6 py-5 bg-emerald-50/20 border-2 border-dashed border-emerald-100 focus:border-emerald-500 focus:border-solid rounded-[2rem] text-sm font-bold outline-none transition-all hover:bg-emerald-50/40"
                                placeholder="Cari akun apa saja (Bank, Kas, Biaya, dll)..."
                                value={debitSearch}
                                onChange={e => { setDebitSearch(e.target.value); setShowDebitDropdown(true); }}
                                onFocus={() => setShowDebitDropdown(true)}
                            />
                            {showDebitDropdown && (
                                <div className="absolute z-30 mt-3 w-full bg-white rounded-[2.5rem] shadow-[0_25px_50px_-12px_rgba(0,0,0,0.15)] border border-slate-100 max-h-64 overflow-y-auto p-4 animate-in fade-in slide-in-from-top-4 custom-scrollbar">
                                    {getFilteredAccounts(debitSearch).length > 0 ? getFilteredAccounts(debitSearch).map((acc, idx) => (
                                        <button key={`${acc.id}-${idx}`} onClick={() => { setDebitSearch(acc.name); setShowDebitDropdown(false); }} className="w-full text-left p-4 hover:bg-emerald-50 rounded-2xl text-xs font-bold text-slate-700 flex flex-col transition-colors group">
                                            <div className="flex justify-between items-center">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-emerald-500 group-hover:scale-110 transition-transform">{acc.icon}</span>
                                                    <span>{acc.name}</span>
                                                </div>
                                                <span className="text-[8px] font-black uppercase text-slate-400 bg-slate-50 px-2 py-1 rounded-lg">{acc.type}</span>
                                            </div>
                                        </button>
                                    )) : <p className="p-6 text-xs text-slate-400 italic text-center">Akun tidak ditemukan</p>}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* CREDIT SIDE */}
                    <div className="space-y-3">
                        <div className="flex justify-between items-center px-4">
                            <label className="text-[11px] font-black text-rose-600 uppercase tracking-widest flex items-center gap-2">
                                <div className="w-2 h-2 bg-rose-500 rounded-full"></div>
                                KOLOM KREDIT (PEMBERI / PENGURANGAN ASET)
                            </label>
                        </div>
                        <div className="relative">
                            <div className="absolute left-6 top-1/2 -translate-y-1/2 w-8 h-8 bg-rose-100/50 rounded-xl flex items-center justify-center text-rose-600 font-black text-xs shadow-sm">K</div>
                            <input className="w-full pl-16 pr-6 py-5 bg-rose-50/20 border-2 border-dashed border-rose-100 focus:border-rose-500 focus:border-solid rounded-[2rem] text-sm font-bold outline-none transition-all hover:bg-rose-50/40"
                                placeholder="Cari akun apa saja (Bank, Kas, Pendapatan, dll)..."
                                value={creditSearch}
                                onChange={e => { setCreditSearch(e.target.value); setShowCreditDropdown(true); }}
                                onFocus={() => setShowCreditDropdown(true)}
                            />
                            {showCreditDropdown && (
                                <div className="absolute z-20 mt-3 w-full bg-white rounded-[2.5rem] shadow-[0_25px_50px_-12px_rgba(0,0,0,0.15)] border border-slate-100 max-h-64 overflow-y-auto p-4 animate-in fade-in slide-in-from-top-4 custom-scrollbar">
                                    {getFilteredAccounts(creditSearch).length > 0 ? getFilteredAccounts(creditSearch).map((acc, idx) => (
                                        <button key={`${acc.id}-${idx}`} onClick={() => { setCreditSearch(acc.name); setShowCreditDropdown(false); }} className="w-full text-left p-4 hover:bg-rose-50 rounded-2xl text-xs font-bold text-slate-700 flex flex-col transition-colors group">
                                            <div className="flex justify-between items-center">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-rose-500 group-hover:scale-110 transition-transform">{acc.icon}</span>
                                                    <span>{acc.name}</span>
                                                </div>
                                                <span className="text-[8px] font-black uppercase text-slate-400 bg-slate-50 px-2 py-1 rounded-lg">{acc.type}</span>
                                            </div>
                                        </button>
                                    )) : <p className="p-6 text-xs text-slate-400 italic text-center">Akun tidak ditemukan</p>}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="bg-slate-900 p-8 rounded-[2.8rem] border border-slate-800 shadow-2xl relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                            <Landmark size={80} className="text-white" />
                        </div>
                        <p className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.3em] mb-4 flex items-center gap-2">
                            📘 PRINSIP JURNAL UNIVERSAL:
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-[10px] font-bold text-slate-400 leading-relaxed">
                            <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                                <span className="block text-emerald-500 mb-1 uppercase tracking-widest">DEBIT UNTUK:</span>
                                <span>📌 Rekening Masuk, Penambahan Aset, atau Munculnya Beban/Biaya.</span>
                            </div>
                            <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                                <span className="block text-rose-500 mb-1 uppercase tracking-widest">KREDIT UNTUK:</span>
                                <span>📌 Rekening Keluar, Penambahan Hutang/Modal, atau Pendapatan.</span>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-6 mt-4">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-6">DESKRIPSI / KETERANGAN</label>
                            <textarea className="w-full px-8 py-6 bg-slate-50 border-2 border-transparent focus:border-blue-500 rounded-[2.5rem] text-sm font-bold outline-none resize-none h-28 transition-all shadow-sm hover:bg-slate-100/30"
                                placeholder="Tuliskan alasan atau tujuan transaksi ini..."
                                value={formData.description || ''}
                                onChange={e => setFormData({ ...formData, description: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-6">MITRA / KONTAK</label>
                            <div className="relative">
                                <UserIcon size={16} className="absolute left-8 top-1/2 -translate-y-1/2 text-slate-300" />
                                <input className="w-full pl-16 pr-6 py-5 bg-slate-50 border-2 border-transparent focus:border-blue-500 rounded-[2rem] text-sm font-bold outline-none transition-all shadow-sm"
                                    placeholder="Nama Pemasok, Klien, atau Staff terkait..."
                                    value={formData.contactName || ''}
                                    onChange={e => setFormData({ ...formData, contactName: e.target.value })}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-6 pt-10">
                        <button onClick={onClose} className="flex-[0.5] py-5 text-slate-400 font-bold uppercase text-[10px] tracking-[0.3em] hover:bg-slate-100 rounded-[2rem] transition-all">BATAL</button>
                        <button onClick={handleSubmit} disabled={isSubmitting} className={`flex-1 py-5 text-white font-black uppercase text-[11px] tracking-[0.3em] rounded-[2rem] transition-all shadow-2xl flex items-center justify-center gap-4 ${isSubmitting ? 'bg-slate-300' : 'bg-blue-600 hover:bg-emerald-600 hover:-translate-y-1 active:translate-y-0 shadow-blue-200'}`}>
                            {isSubmitting ? 'MENGIRIM JURNAL...' : (isEditing ? 'PERBARUI JURNAL' : 'POSTING JURNAL')}
                        </button>
                    </div>
                </div>

                {(showDebitDropdown || showCreditDropdown) && <div className="fixed inset-0 z-10" onClick={() => { setShowDebitDropdown(false); setShowCreditDropdown(false); }}></div>}
            </div>
        </div>
    );
};
