import React, { useState, useEffect } from 'react';
import { Transaction, TransactionType, FinancialAccountDef, TransactionCategory, BusinessUnit, ChartOfAccount } from '../../types';
import { Landmark, Search, CreditCard, User as UserIcon } from 'lucide-react';
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
    const [cashSide, setCashSide] = useState<'DEBIT' | 'CREDIT'>('DEBIT');

    useEffect(() => {
        if (isOpen) {
            const isGeneral = isEditing && !initialData.accountId;
            setMode(isGeneral ? 'GENERAL' : 'CASH');

            setFormData({
                ...initialData,
                status: 'PAID',
                date: initialData.date ? initialData.date : new Date().toISOString()
            });

            if (!isGeneral) {
                setCashSide(initialData.type === TransactionType.IN ? 'DEBIT' : 'CREDIT');
                setDebitSearch(initialData.type === TransactionType.IN ? initialData.account || '' : (coaList.find(c => c.id === initialData.coaId)?.name || initialData.category || ''));
                setCreditSearch(initialData.type === TransactionType.OUT ? initialData.account || '' : (coaList.find(c => c.id === initialData.coaId)?.name || initialData.category || ''));
            } else {
                setDebitSearch(initialData.account || '');
                setCreditSearch(coaList.find(c => c.id === initialData.coaId)?.name || initialData.category || '');
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
            let finalAccount = "";
            let finalCategory = "";
            let finalType = TransactionType.IN;

            if (mode === 'CASH') {
                finalAccount = cashSide === 'DEBIT' ? debitSearch : creditSearch;
                finalCategory = cashSide === 'DEBIT' ? creditSearch : debitSearch;
                finalType = cashSide === 'DEBIT' ? TransactionType.IN : TransactionType.OUT;
            } else {
                finalAccount = debitSearch;
                finalCategory = creditSearch;
                // Type will be determined by backend based on COA types (Revenue/Expense)
                finalType = TransactionType.IN;
            }

            const payload: Transaction & { isNonCash?: boolean } = {
                ...formData,
                status: 'PAID',
                account: finalAccount,
                category: finalCategory,
                type: finalType,
                date: formData.date ? new Date(formData.date).toISOString() : new Date().toISOString(),
                isNonCash: mode === 'GENERAL'
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

    const filteredBank = (q: string) => financialAccounts.filter(a => a.name.toLowerCase().includes(q.toLowerCase()));
    const filteredCoa = (q: string) => coaList.filter(c => c.code.includes(q) || c.name.toLowerCase().includes(q.toLowerCase())).slice(0, 50);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/90 backdrop-blur-xl p-4 animate-in fade-in duration-300">
            <div className="bg-white rounded-[3.5rem] w-full max-w-2xl p-12 shadow-[0_35px_60px_-15px_rgba(0,0,0,0.3)] border border-white/20 animate-in zoom-in duration-500 overflow-y-auto max-h-[90vh] custom-scrollbar">

                <div className="flex justify-between items-center mb-10">
                    <div>
                        <h3 className="text-3xl font-black text-slate-800 italic uppercase tracking-tighter leading-none">
                            {isEditing ? 'Koreksi Jurnal' : 'Entri Jurnal'}
                        </h3>
                        <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mt-3 flex items-center gap-2">
                            <span className="w-4 h-px bg-blue-600"></span> UNIVERSAL JOURNAL SYSTEM
                        </p>
                    </div>
                    <button onClick={onClose} className="w-12 h-12 bg-slate-100 rounded-2xl text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-all flex items-center justify-center font-bold">✕</button>
                </div>

                <div className="flex bg-slate-100 p-2 rounded-[2.5rem] mb-10 border border-slate-200 shadow-inner">
                    <button onClick={() => setMode('CASH')} className={`flex-1 py-5 flex flex-col items-center gap-2 rounded-[2rem] transition-all duration-300 ${mode === 'CASH' ? 'bg-white shadow-xl text-blue-600' : 'text-slate-400 hover:text-slate-500'}`}>
                        <Landmark size={20} /><span className="text-[10px] font-black uppercase tracking-widest">Jurnal Kas & Bank</span>
                    </button>
                    <button onClick={() => setMode('GENERAL')} className={`flex-1 py-5 flex flex-col items-center gap-2 rounded-[2rem] transition-all duration-300 ${mode === 'GENERAL' ? 'bg-white shadow-xl text-indigo-600' : 'text-slate-400 hover:text-slate-500'}`}>
                        <CreditCard size={20} /><span className="text-[10px] font-black uppercase tracking-widest">Jurnal Umum (Memorial)</span>
                    </button>
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
                            <input type="number" className="w-full text-4xl font-black pl-20 pr-8 py-7 bg-slate-900 border-2 border-transparent focus:border-blue-500 rounded-[2.5rem] outline-none transition-all text-white shadow-2xl tabular-nums"
                                placeholder="0"
                                value={formData.amount || ''}
                                onChange={e => setFormData({ ...formData, amount: parseFloat(e.target.value) })}
                            />
                        </div>
                    </div>

                    {/* DEBIT SIDE */}
                    <div className="space-y-3">
                        <div className="flex justify-between items-center px-4">
                            <label className="text-[11px] font-black text-emerald-600 uppercase tracking-widest flex items-center gap-2">
                                <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                                {mode === 'CASH' && cashSide === 'DEBIT' ? '🔴 TUJUAN PENYIMPANAN (DEBIT)' : '🔵 POSISI DEBIT (PENERIMA)'}
                            </label>
                            {mode === 'CASH' && (
                                <button onClick={() => { setCashSide('DEBIT'); setDebitSearch(''); setCreditSearch(''); }} className={`px-5 py-2 rounded-full text-[10px] font-black uppercase transition-all ${cashSide === 'DEBIT' ? 'bg-emerald-500 text-white shadow-xl shadow-emerald-200 ring-4 ring-emerald-50' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}>Uang Masuk</button>
                            )}
                        </div>
                        <div className="relative">
                            <div className="absolute left-6 top-1/2 -translate-y-1/2 w-8 h-8 bg-emerald-100/50 rounded-xl flex items-center justify-center text-emerald-600 font-black text-xs">D</div>
                            <input className="w-full pl-16 pr-6 py-5 bg-emerald-50/20 border-2 border-dashed border-emerald-100 focus:border-emerald-500 focus:border-solid rounded-[2rem] text-sm font-bold outline-none transition-all hover:bg-emerald-50/40"
                                placeholder={mode === 'CASH' && cashSide === 'DEBIT' ? "Pilih Bank/Kas Penerima..." : "Cari Akun yang Bertambah (Aset/Beban)..."}
                                value={debitSearch}
                                onChange={e => { setDebitSearch(e.target.value); setShowDebitDropdown(true); }}
                                onFocus={() => setShowDebitDropdown(true)}
                            />
                            {showDebitDropdown && (
                                <div className="absolute z-30 mt-3 w-full bg-white rounded-[2.5rem] shadow-[0_25px_50px_-12px_rgba(0,0,0,0.15)] border border-slate-100 max-h-64 overflow-y-auto p-4 animate-in fade-in slide-in-from-top-4">
                                    {mode === 'CASH' && cashSide === 'DEBIT' ? (
                                        filteredBank(debitSearch).length > 0 ? filteredBank(debitSearch).map(acc => (
                                            <button key={acc.id} onClick={() => { setDebitSearch(acc.name); setShowDebitDropdown(false); }} className="w-full text-left p-4 hover:bg-emerald-50 rounded-2xl text-xs font-bold text-slate-700 flex items-center gap-4 transition-colors">
                                                <Landmark size={18} className="text-emerald-500" /> {acc.name}
                                            </button>
                                        )) : <p className="p-6 text-xs text-slate-400 italic text-center">Rekening tidak ditemukan</p>
                                    ) : (
                                        filteredCoa(debitSearch).length > 0 ? filteredCoa(debitSearch).map(coa => (
                                            <button key={coa.id} onClick={() => { setDebitSearch(`${coa.code} - ${coa.name}`); setShowDebitDropdown(false); }} className="w-full text-left p-4 hover:bg-emerald-50 rounded-2xl text-xs font-bold text-slate-700 flex flex-col transition-colors">
                                                <div className="flex justify-between items-center mb-1">
                                                    <span>{coa.name}</span>
                                                    <span className="text-[10px] font-mono text-slate-400 px-3 py-1 bg-slate-50 rounded-lg">{coa.code}</span>
                                                </div>
                                                <span className="text-[9px] uppercase tracking-[0.2em] text-slate-400 font-black">{coa.type}</span>
                                            </button>
                                        )) : <p className="p-6 text-xs text-slate-400 italic text-center">Akun tidak ditemukan</p>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* CREDIT SIDE */}
                    <div className="space-y-3">
                        <div className="flex justify-between items-center px-4">
                            <label className="text-[11px] font-black text-rose-600 uppercase tracking-widest flex items-center gap-2">
                                <div className="w-2 h-2 bg-rose-500 rounded-full"></div>
                                {mode === 'CASH' && cashSide === 'CREDIT' ? '🔴 ASAL PEMBAYARAN (KREDIT)' : '🔵 POSISI KREDIT (PEMBERI)'}
                            </label>
                            {mode === 'CASH' && (
                                <button onClick={() => { setCashSide('CREDIT'); setDebitSearch(''); setCreditSearch(''); }} className={`px-5 py-2 rounded-full text-[10px] font-black uppercase transition-all ${cashSide === 'CREDIT' ? 'bg-rose-500 text-white shadow-xl shadow-rose-200 ring-4 ring-rose-50' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}>Uang Keluar</button>
                            )}
                        </div>
                        <div className="relative">
                            <div className="absolute left-6 top-1/2 -translate-y-1/2 w-8 h-8 bg-rose-100/50 rounded-xl flex items-center justify-center text-rose-600 font-black text-xs">K</div>
                            <input className="w-full pl-16 pr-6 py-5 bg-rose-50/20 border-2 border-dashed border-rose-100 focus:border-rose-500 focus:border-solid rounded-[2rem] text-sm font-bold outline-none transition-all hover:bg-rose-50/40"
                                placeholder={mode === 'CASH' && cashSide === 'CREDIT' ? "Pilih Bank/Kas Sumber..." : "Cari Akun yang Berkurang atau Sumber Dana..."}
                                value={creditSearch}
                                onChange={e => { setCreditSearch(e.target.value); setShowCreditDropdown(true); }}
                                onFocus={() => setShowCreditDropdown(true)}
                            />
                            {showCreditDropdown && (
                                <div className="absolute z-20 mt-3 w-full bg-white rounded-[2.5rem] shadow-[0_25px_50px_-12px_rgba(0,0,0,0.15)] border border-slate-100 max-h-64 overflow-y-auto p-4 animate-in fade-in slide-in-from-top-4">
                                    {mode === 'CASH' && cashSide === 'CREDIT' ? (
                                        filteredBank(creditSearch).length > 0 ? filteredBank(creditSearch).map(acc => (
                                            <button key={acc.id} onClick={() => { setCreditSearch(acc.name); setShowCreditDropdown(false); }} className="w-full text-left p-4 hover:bg-rose-50 rounded-2xl text-xs font-bold text-slate-700 flex items-center gap-4 transition-colors">
                                                <Landmark size={18} className="text-rose-500" /> {acc.name}
                                            </button>
                                        )) : <p className="p-6 text-xs text-slate-400 italic text-center">Rekening tidak ditemukan</p>
                                    ) : (
                                        filteredCoa(creditSearch).length > 0 ? filteredCoa(creditSearch).map(coa => (
                                            <button key={coa.id} onClick={() => { setCreditSearch(`${coa.code} - ${coa.name}`); setShowCreditDropdown(false); }} className="w-full text-left p-4 hover:bg-rose-50 rounded-2xl text-xs font-bold text-slate-700 flex flex-col transition-colors">
                                                <div className="flex justify-between items-center mb-1">
                                                    <span>{coa.name}</span>
                                                    <span className="text-[10px] font-mono text-slate-400 px-3 py-1 bg-slate-50 rounded-lg">{coa.code}</span>
                                                </div>
                                                <span className="text-[9px] uppercase tracking-[0.2em] text-slate-400 font-black">{coa.type}</span>
                                            </button>
                                        )) : <p className="p-6 text-xs text-slate-400 italic text-center">Akun tidak ditemukan</p>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="bg-blue-50/30 p-7 rounded-[2.5rem] border border-blue-100/50 mt-6 relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-10">
                            <CreditCard size={64} className="text-blue-600" />
                        </div>
                        <p className="text-[10px] font-black text-blue-500 uppercase tracking-[0.3em] mb-4 flex items-center gap-2">
                            📘 LOGIKA AKUNTANSI DASAR:
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-[10px] font-bold text-slate-500 leading-relaxed">
                            <div className="bg-white/60 p-4 rounded-2xl border border-blue-50">
                                <span className="block text-emerald-600 mb-1 uppercase tracking-widest">DEBIT BERTAMBAH:</span>
                                <span>📌 Aset (Uang/Barang) & Beban (Biaya Operasional)</span>
                            </div>
                            <div className="bg-white/60 p-4 rounded-2xl border border-blue-50">
                                <span className="block text-rose-600 mb-1 uppercase tracking-widest">KREDIT BERTAMBAH:</span>
                                <span>📌 Utang, Modal, & Pendapatan Penjualan</span>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-6 mt-8">
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
                        <button onClick={handleSubmit} disabled={isSubmitting} className={`flex-1 py-5 text-white font-black uppercase text-[11px] tracking-[0.3em] rounded-[2rem] transition-all shadow-2xl flex items-center justify-center gap-4 ${isSubmitting ? 'bg-slate-300' : 'bg-slate-900 hover:bg-blue-600 hover:-translate-y-1 active:translate-y-0'}`}>
                            {isSubmitting ? 'MENGIRIM JURNAL...' : (isEditing ? 'PERBARUI JURNAL' : 'POSTING JURNAL')}
                        </button>
                    </div>
                </div>

                {(showDebitDropdown || showCreditDropdown) && <div className="fixed inset-0 z-10" onClick={() => { setShowDebitDropdown(false); setShowCreditDropdown(false); }}></div>}
            </div>
        </div>
    );
};
