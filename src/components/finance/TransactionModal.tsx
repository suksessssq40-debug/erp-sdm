import React, { useState, useEffect } from 'react';
import { Transaction, TransactionType, FinancialAccountDef, TransactionCategory, BusinessUnit, ChartOfAccount } from '../../types';
import { Landmark, Plus, Search, ImageIcon, Trash2, CreditCard, Calendar, User as UserIcon } from 'lucide-react';
import { useToast } from '../Toast';

interface TransactionModalProps {
    isOpen: boolean;
    onClose: () => void;
    isEditing: boolean;
    initialData: Transaction;

    financialAccounts: FinancialAccountDef[];
    categories: TransactionCategory[]; // Legacy support
    coaList?: ChartOfAccount[]; // New
    businessUnits: BusinessUnit[];

    onSave: (data: Transaction) => Promise<void>;

    // Logic for Auto-Create props
    onAddAccount?: (acc: FinancialAccountDef) => Promise<void>;
    onAddCategory?: (cat: TransactionCategory) => Promise<void>;

    uploadFile?: (file: File) => Promise<string>;
    toast: ReturnType<typeof useToast>;
}

// Helper for currency formatting
const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(amount);
};

export const TransactionModal: React.FC<TransactionModalProps> = ({
    isOpen, onClose, isEditing, initialData,
    financialAccounts, categories, coaList = [], businessUnits,
    onSave, onAddAccount, onAddCategory,
    uploadFile, toast
}) => {
    const [formData, setFormData] = useState<Transaction>(initialData);
    const [accountSearch, setAccountSearch] = useState('');
    const [showAccountDropdown, setShowAccountDropdown] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false); // State to locking UI processing

    // COA Search State (Single Mode)
    const [coaSearch, setCoaSearch] = useState('');
    const [showCoaDropdown, setShowCoaDropdown] = useState(false);
    const [isGeneralMode, setIsGeneralMode] = useState(false); // New: General Journal Mode

    // SPLIT MODE STATE
    const [isSplit, setIsSplit] = useState(false);
    const [splitItems, setSplitItems] = useState<{ coaId: string, coaName: string, amount: number, description: string, type: TransactionType }[]>([
        { coaId: '', coaName: '', amount: 0, description: '', type: TransactionType.OUT }
    ]);
    const [activeSplitIndex, setActiveSplitIndex] = useState<number | null>(null);

    // Initialize state when modal opens
    useEffect(() => {
        if (isOpen) {
            setFormData({
                ...initialData,
                status: initialData.status || 'PAID',
                date: initialData.date ? initialData.date : new Date().toISOString()
            });
            setAccountSearch(initialData.account || '');
            setIsSplit(false);
            setSplitItems([{ coaId: '', coaName: '', amount: 0, description: '', type: initialData.type }]);

            // COA Search Pre-fill Logic
            const linkedCoa = coaList.find(c => c.id === initialData.coaId);
            if (linkedCoa) {
                setCoaSearch(`${linkedCoa.code} - ${linkedCoa.name}`);
            } else {
                setCoaSearch(initialData.category || '');
            }
        }
    }, [isOpen, initialData, coaList]);

    // Helper: auto-detect type from COA
    const getCoaType = (coa: ChartOfAccount) => {
        // Default heuristic
        if (coa.type === 'REVENUE' || coa.normalPos === 'CREDIT') return TransactionType.IN;
        return TransactionType.OUT;
    }

    const handleSubmit = async () => {
        if (isSubmitting) return;

        // COMMON VALIDATION
        if (formData.amount <= 0) {
            toast.warning("Nominal Total harus lebih dari 0");
            return;
        }
        const finalAccountName = accountSearch || formData.account;
        if (!finalAccountName) {
            toast.warning("Pilih atau ketik nama akun keuangan (Bank/Kas)");
            return;
        }

        setIsSubmitting(true);

        try {
            // --- SPLIT MODE SAVE LOGIC ---
            if (isSplit) {
                // 1. Validate Totals
                const totalSplit = splitItems.reduce((sum, item) => sum + item.amount, 0);
                if (Math.abs(totalSplit - formData.amount) > 100) { // Tolerance 100 rupiah
                    toast.warning(`Total Pecahan (${totalSplit}) tidak klop dengan Total Nominal (${formData.amount})`);
                    setIsSubmitting(false);
                    return;
                }

                // 2. Validate Items
                for (const item of splitItems) {
                    if (!item.coaId) {
                        toast.warning("Semua baris pecahan wajib pilih Akun Lawan (COA)");
                        setIsSubmitting(false);
                        return;
                    }
                }

                toast.info(`Menyimpan ${splitItems.length} transaksi pecahan...`);

                // 3. Save Multiple Transactions
                const baseId = isEditing ? formData.id : Math.random().toString(36).substr(2, 9);

                for (let i = 0; i < splitItems.length; i++) {
                    const item = splitItems[i];
                    const payload: Transaction = {
                        ...formData,
                        id: i === 0 && isEditing ? baseId : `${baseId}_split_${i + 1}`, // Keep original ID for first one if editing
                        account: finalAccountName,

                        // Per-Item Overrides
                        amount: item.amount, // Part Amount
                        type: item.type,     // Allow mix IN/OUT? Usually split is same direction. But let's respect item type.

                        // COA & Category
                        category: item.coaName, // Legacy
                        coaId: item.coaId,
                        description: `${formData.description} (${item.description || item.coaName})`, // Append detail

                        // Ensure Date is same
                        date: formData.date ? new Date(formData.date).toISOString() : new Date().toISOString()
                    };

                    await onSave(payload);
                }

                onClose();
                return;
            }

            // --- NORMAL MODE SAVE LOGIC ---
            if (!formData.description) {
                toast.warning("Deskripsi wajib diisi");
                setIsSubmitting(false);
                return;
            }

            // Auto-Create Account Logic CHECK (Only for Cash Mode)
            if (!isGeneralMode) {
                const accountExists = financialAccounts.some(acc => acc.name.toLowerCase() === finalAccountName.toLowerCase());
                if (!accountExists) {
                    if (!confirm(`Akun Keuangan "${finalAccountName}" belum ada. Buat baru otomatis?`)) {
                        setIsSubmitting(false);
                        return;
                    }
                    if (onAddAccount) {
                        await onAddAccount({
                            id: Math.random().toString(36).substr(2, 9),
                            name: finalAccountName,
                            bankName: 'General / Tunai',
                            accountNumber: '-',
                            description: 'Auto-created from transaction entry',
                            isActive: true
                        });
                    }
                }
            }

            // Auto-Create COA Logic CHECK
            if (!formData.coaId && coaSearch) {
                const coaExists = coaList.some(c => `${c.code} - ${c.name}`.toLowerCase() === coaSearch.toLowerCase());
                if (!coaExists) {
                    if (confirm(`Akun/Kategori "${coaSearch}" belum ada. Buat baru otomatis?`)) {
                        // We let the backend handle the creation if coaId is missing, 
                        // but we can also trigger onAddAccount logic if we have an onAddCoa prop.
                        // For now, the updated API handles this perfectly when it receives a category name without coaId.
                    } else {
                        setIsSubmitting(false);
                        return; // User canceled
                    }
                }
            }

            if (!formData.coaId && !coaSearch) {
                toast.warning("Wajib pilih Akun (COA)");
                setIsSubmitting(false);
                return;
            }

            // Accrual Validation
            if (formData.status === 'PENDING' && !formData.contactName) {
                toast.warning("Wajib isi Nama Kontak untuk transaksi hutang/piutang");
                setIsSubmitting(false);
                return;
            }

            const payload: Transaction & { isNonCash?: boolean } = {
                ...formData,
                account: finalAccountName,
                category: coaSearch,
                id: isEditing ? formData.id : (formData.id || Math.random().toString(36).substr(2, 9)),
                date: formData.date ? new Date(formData.date).toISOString() : new Date().toISOString(),
                isNonCash: isGeneralMode
            };

            await onSave(payload);
            onClose();

        } catch (e) {
            console.error("Submit Error", e);
            toast.error("Terjadi kesalahan saat menyimpan transaksi.");
            setIsSubmitting(false);
        }
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file && uploadFile) {
            try {
                const url = await uploadFile(file);
                setFormData(prev => ({ ...prev, imageUrl: url }));
            } catch (err) { }
        }
    };

    const handleSplitCoaSelect = (coa: ChartOfAccount) => {
        if (activeSplitIndex === null) return;
        const newItems = [...splitItems];
        newItems[activeSplitIndex] = {
            ...newItems[activeSplitIndex],
            coaId: coa.id,
            coaName: `${coa.code} - ${coa.name}`,
            type: getCoaType(coa)
        };
        setSplitItems(newItems);
        setActiveSplitIndex(null); // Close dropdown
        setShowCoaDropdown(false); // Close dropdown UI
    }

    // Calculate Remaining for Split
    const splitTotal = splitItems.reduce((s, i) => s + (i.amount || 0), 0);
    const splitRemaining = (formData.amount || 0) - splitTotal;

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/90 backdrop-blur-md p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-[3.5rem] w-full max-w-3xl p-10 shadow-2xl border border-white/20 animate-in zoom-in duration-300 overflow-y-auto max-h-[90vh] custom-scrollbar">
                {/* Header */}
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h3 className="text-2xl font-black text-slate-800 leading-tight italic uppercase tracking-tighter">
                            {isEditing ? 'Edit Transaksi' : 'Input Jurnal'}
                            {isSplit && <span className="text-blue-600 ml-2 not-italic bg-blue-50 px-3 py-1 rounded-full text-xs">/ MODE SPLIT</span>}
                        </h3>
                    </div>
                    <button onClick={onClose} className="p-4 bg-slate-100 rounded-2xl text-slate-400 hover:text-rose-500 transition">✕</button>
                </div>

                {/* TYPE SELECTION (PEMASUKAN vs PENGELUARAN) */}
                {!isGeneralMode && (
                    <div className="flex gap-4 mb-8">
                        <button
                            onClick={() => setFormData({ ...formData, type: TransactionType.IN })}
                            className={`flex-1 flex flex-col items-center gap-2 p-6 rounded-[2rem] border-4 transition-all duration-300 ${formData.type === TransactionType.IN
                                ? 'bg-emerald-500 border-emerald-500 text-white shadow-xl shadow-emerald-100'
                                : 'bg-white border-slate-50 text-slate-400 hover:border-emerald-100 hover:bg-emerald-50/30'}`}
                        >
                            <Plus size={24} className={formData.type === TransactionType.IN ? 'text-white' : 'text-emerald-500'} />
                            <span className="text-xs font-black uppercase tracking-[0.2em]">PEMASUKAN (IN)</span>
                        </button>
                        <button
                            onClick={() => setFormData({ ...formData, type: TransactionType.OUT })}
                            className={`flex-1 flex flex-col items-center gap-2 p-6 rounded-[2rem] border-4 transition-all duration-300 ${formData.type === TransactionType.OUT
                                ? 'bg-rose-500 border-rose-500 text-white shadow-xl shadow-rose-100'
                                : 'bg-white border-slate-100 text-slate-400 hover:border-rose-100 hover:bg-rose-50/30'}`}
                        >
                            <Trash2 size={24} className={formData.type === TransactionType.OUT ? 'text-white' : 'text-rose-500'} />
                            <span className="text-xs font-black uppercase tracking-[0.2em]">PENGELUARAN (OUT)</span>
                        </button>
                    </div>
                )}

                {/* MAIN FORM CONTAINER with Dynamic Background */}
                <div className={`space-y-6 p-8 rounded-[2.5rem] border transition-colors duration-500 ${isGeneralMode ? 'bg-blue-50/30 border-blue-100' :
                        formData.type === TransactionType.IN ? 'bg-emerald-50/20 border-emerald-100' : 'bg-rose-50/20 border-rose-100'
                    }`}>

                    {/* 1. STATUS & REKENING / JOURNAL MODE */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                        {/* MODE TOGGLE & STATUS */}
                        <div className="space-y-4">
                            <div className="flex justify-between items-center">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">MODE INPUT</label>
                                <div className="flex bg-slate-200/50 rounded-lg p-1">
                                    <button
                                        onClick={() => { setFormData({ ...formData, account: '' }); setIsGeneralMode(false); }}
                                        className={`px-3 py-1 text-[9px] font-bold rounded-md transition ${!isGeneralMode ? 'bg-white shadow text-slate-800' : 'text-slate-400'}`}
                                    >KAS/BANK</button>
                                    <button
                                        onClick={() => { setFormData({ ...formData, account: '' }); setIsGeneralMode(true); }}
                                        className={`px-3 py-1 text-[9px] font-bold rounded-md transition ${isGeneralMode ? 'bg-white shadow text-slate-800' : 'text-slate-400'}`}
                                    >JURNAL UMUM</button>
                                </div>
                            </div>

                            {!isGeneralMode ? (
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">STATUS PEMBAYARAN</label>
                                    <div className="flex bg-white/50 p-1.5 rounded-[1.2rem] border border-slate-200">
                                        <button
                                            onClick={() => setFormData({ ...formData, status: 'PAID' })}
                                            className={`flex-1 py-3 text-[9px] font-black uppercase tracking-widest rounded-2xl transition-all ${formData.status !== 'PENDING' ? 'bg-slate-900 shadow-md text-white' : 'text-slate-400 hover:text-slate-600'}`}
                                        >LUNAS (CASH)</button>
                                        <button
                                            onClick={() => setFormData({ ...formData, status: 'PENDING' })}
                                            className={`flex-1 py-3 text-[9px] font-black uppercase tracking-widest rounded-2xl transition-all ${formData.status === 'PENDING' ? 'bg-orange-500 shadow-md text-white' : 'text-slate-400 hover:text-slate-600'}`}
                                        >BELUM LUNAS</button>
                                    </div>
                                </div>
                            ) : (
                                <div className="p-4 bg-blue-600 text-white rounded-[1.5rem] text-[10px] font-bold shadow-lg shadow-blue-100 leading-relaxed border-none">
                                    <span className="font-black block mb-1 uppercase tracking-widest opacity-80">💡 INFO JURNAL UMUM:</span>
                                    Transaksi ini <span className="underline italic">tidak melibatkan Kas/Bank</span>. Digunakan untuk penyusutan, pengakuan piutang/hutang, atau koreksi saldo.
                                </div>
                            )}
                        </div>

                        {/* ACCOUNT SELECTOR (DEBIT SIDE) */}
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                {isGeneralMode ? 'AKUN POSISI DEBIT' : 'REKENING KAS / BANK'}
                            </label>
                            <div className="relative">
                                <input
                                    className="w-full pl-4 pr-4 py-3.5 bg-slate-50 border-2 border-transparent rounded-[1.2rem] text-xs font-bold uppercase outline-none focus:border-blue-600 transition shadow-sm"
                                    placeholder={isGeneralMode ? "Cari Akun Debit (COA)..." : "Pilih Akun Bank..."}
                                    value={accountSearch}
                                    onChange={(e) => {
                                        setAccountSearch(e.target.value);
                                        setFormData({ ...formData, account: e.target.value });
                                        setShowAccountDropdown(true);
                                    }}
                                    onFocus={() => setShowAccountDropdown(true)}
                                />
                                {showAccountDropdown && (
                                    <div className="absolute z-10 mt-2 w-full bg-white rounded-2xl shadow-xl border border-slate-100 max-h-40 overflow-y-auto p-2">
                                        {!isGeneralMode ? (
                                            // LIST BANK
                                            financialAccounts.filter(a => a.name.toLowerCase().includes(accountSearch.toLowerCase())).map(acc => (
                                                <button key={acc.id} onClick={() => { setAccountSearch(acc.name); setFormData(p => ({ ...p, account: acc.name })); setShowAccountDropdown(false); }} className="w-full text-left p-3 hover:bg-slate-50 rounded-xl text-[10px] font-bold text-slate-600 block">{acc.name}</button>
                                            ))
                                        ) : (
                                            // LIST COA (For Debit Side)
                                            coaList.filter(c => c.code.includes(accountSearch) || c.name.toLowerCase().includes(accountSearch.toLowerCase())).slice(0, 50).map(coa => (
                                                <button key={coa.id}
                                                    onClick={() => {
                                                        setAccountSearch(`${coa.code} - ${coa.name}`);
                                                        // IN Jurnal Umum: Account Field stores Debit Name. type=IN implies Account is Debit.
                                                        setFormData(p => ({ ...p, account: `${coa.code} - ${coa.name}`, type: TransactionType.IN }));
                                                        setShowAccountDropdown(false);
                                                    }}
                                                    className="w-full text-left p-3 hover:bg-slate-50 rounded-xl text-[10px] font-bold text-slate-600 flex justify-between group"
                                                >
                                                    <span><span className="font-mono text-slate-400 mr-2">{coa.code}</span> {coa.name}</span>
                                                    {/* Hint for correctness */}
                                                    <span className="opacity-0 group-hover:opacity-100 text-[8px] bg-slate-200 px-1 rounded">Pilih sbg Debit</span>
                                                </button>
                                            ))
                                        )}
                                    </div>
                                )}
                                {showAccountDropdown && <div className="fixed inset-0 z-0" onClick={() => setShowAccountDropdown(false)}></div>}
                            </div>
                        </div>
                    </div>

                    {/* 2. TOTAL NOMINAL */}
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex justify-between">
                            <span>TOTAL NOMINAL (IDR)</span>
                            <button onClick={() => setIsSplit(!isSplit)} className="text-blue-500 hover:underline cursor-pointer">{isSplit ? 'Batal Split' : 'Pecah Akun (Split)?'}</button>
                        </label>
                        <div className="relative">
                            <span className="absolute left-5 top-1/2 -translate-y-1/2 text-sm font-black text-slate-300">Rp</span>
                            <input
                                type="number"
                                className="w-full text-2xl font-black pl-12 pr-5 py-5 bg-slate-50 border-2 border-transparent focus:border-blue-600 focus:bg-white rounded-[1.8rem] outline-none transition"
                                placeholder="0"
                                value={formData.amount || ''}
                                onChange={e => setFormData({ ...formData, amount: parseFloat(e.target.value) })}
                            />
                        </div>
                        {isSplit && (
                            <div className="flex justify-between px-2">
                                <span className="text-[10px] font-bold text-slate-400">Terbagi: <span className="text-slate-700">{formatCurrency(splitTotal)}</span></span>
                                <span className={`text-[10px] font-bold ${splitRemaining === 0 ? 'text-emerald-500' : 'text-rose-500'}`}>Sisa: {formatCurrency(splitRemaining)}</span>
                            </div>
                        )}
                    </div>

                    {/* 3. COA SELECTION (NORMAL vs SPLIT) */}
                    {!isSplit ? (
                        // NORMAL MODE
                        <div className="space-y-3">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex justify-between">
                                <span>{isGeneralMode ? 'AKUN POSISI KREDIT' : 'AKUN LAWAN (COA)'}</span>
                                {!isGeneralMode && <span className="text-blue-500 cursor-pointer text-[9px]" onClick={() => toast.info('Fitur Request Akun segera aktif')}>+ REQUEST AKUN</span>}
                            </label>
                            <div className="relative">
                                <Search size={16} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300" />
                                <input
                                    className="w-full pl-12 pr-5 py-4 bg-indigo-50 border-2 border-indigo-100 rounded-[1.5rem] text-sm font-bold outline-none focus:border-indigo-600 focus:bg-white transition shadow-sm text-indigo-900 placeholder:text-indigo-300"
                                    placeholder="Cari Kode atau Nama Akun..."
                                    value={coaSearch}
                                    onChange={(e) => { setCoaSearch(e.target.value); setShowCoaDropdown(true); setFormData(p => ({ ...p, coaId: undefined })); }}
                                    onFocus={() => setShowCoaDropdown(true)}
                                />
                                {showCoaDropdown && (
                                    <div className="absolute z-20 mt-2 w-full bg-white rounded-[1.5rem] shadow-2xl border border-slate-100 max-h-60 overflow-y-auto custom-scrollbar p-2">
                                        {coaList.filter(c => c.code.includes(coaSearch) || c.name.toLowerCase().includes(coaSearch.toLowerCase())).slice(0, 50).map(coa => (
                                            <button key={coa.id}
                                                onClick={() => {
                                                    setCoaSearch(`${coa.code} - ${coa.name}`);
                                                    setFormData(p => ({ ...p, coaId: coa.id, type: getCoaType(coa) }));
                                                    setShowCoaDropdown(false);
                                                }}
                                                className="w-full text-left px-5 py-3 rounded-xl hover:bg-indigo-50 transition text-xs font-bold text-slate-700 flex justify-between items-center"
                                            >
                                                <span><span className="font-mono text-slate-400 mr-2">{coa.code}</span> {coa.name}</span>
                                                <span className={`text-[8px] px-2 py-1 rounded uppercase tracking-widest ${['ASSET', 'EXPENSE'].includes(coa.type) ? 'bg-orange-100 text-orange-600' : 'bg-emerald-100 text-emerald-600'}`}>{coa.type}</span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                                {showCoaDropdown && <div className="fixed inset-0 z-10" onClick={() => setShowCoaDropdown(false)}></div>}
                            </div>
                        </div>
                    ) : (
                        // SPLIT MODE UI
                        <div className="bg-slate-50 rounded-[2rem] p-6 space-y-4 border border-slate-200">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">RINCIAN PECAHAN (SPLIT)</label>
                            {splitItems.map((item, idx) => (
                                <div key={idx} className="flex gap-3 items-start animate-in slide-in-from-left-2">
                                    <div className="flex-1 space-y-1">
                                        <div className="relative">
                                            <input
                                                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-blue-500 disabled:opacity-50 disabled:bg-slate-50"
                                                placeholder="Pilih atau Ketik Akun..."
                                                value={item.coaName}
                                                disabled={isSubmitting}
                                                onFocus={() => { setActiveSplitIndex(idx); setShowCoaDropdown(true); }}
                                                onChange={(e) => {
                                                    const newItems = [...splitItems];
                                                    newItems[idx].coaName = e.target.value;
                                                    newItems[idx].coaId = ''; // Reset ID if typing
                                                    setSplitItems(newItems);
                                                    setActiveSplitIndex(idx); // Ensure active
                                                    setShowCoaDropdown(true);
                                                }}
                                            />
                                            {/* Inline Dropdown for Split Item */}
                                            {showCoaDropdown && activeSplitIndex === idx && (
                                                <>
                                                    <div className="fixed inset-0 z-10 cursor-default" onClick={(e) => { e.stopPropagation(); setShowCoaDropdown(false); setActiveSplitIndex(null); }}></div>
                                                    <div className="absolute z-20 top-full mt-1 w-full bg-white rounded-xl shadow-xl border border-slate-200 max-h-48 overflow-y-auto p-1 custom-scrollbar">
                                                        {/* FILTERED LIST */}
                                                        {coaList
                                                            .filter(c =>
                                                                !item.coaName ||
                                                                c.code.includes(item.coaName) ||
                                                                c.name.toLowerCase().includes(item.coaName.toLowerCase()) ||
                                                                `${c.code} - ${c.name}`.toLowerCase().includes(item.coaName.toLowerCase())
                                                            )
                                                            .slice(0, 50)
                                                            .map(c => (
                                                                <button key={c.id} onClick={() => handleSplitCoaSelect(c)} className="w-full text-left p-2 hover:bg-slate-100 text-xs rounded-lg flex justify-between group">
                                                                    <span><span className="font-mono text-slate-400 pr-2">{c.code}</span>{c.name}</span>
                                                                    {['ASSET', 'EXPENSE'].includes(c.type) ? <span className="text-[9px] text-orange-400 font-bold bg-orange-50 px-1 rounded">DEBIT</span> : <span className="text-[9px] text-emerald-400 font-bold bg-emerald-50 px-1 rounded">KREDIT</span>}
                                                                </button>
                                                            ))}
                                                        {coaList.filter(c => !item.coaName || c.code.includes(item.coaName) || c.name.toLowerCase().includes(item.coaName.toLowerCase())).length === 0 && (
                                                            <div className="p-3 text-center text-slate-400 text-[10px] italic">Tidak ada akun cocok</div>
                                                        )}
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                        <input
                                            className="w-full px-4 py-2 bg-transparent border-b border-dashed border-slate-300 text-[10px] font-medium outline-none placeholder:text-slate-400 disabled:opacity-50"
                                            placeholder="Keterangan tambahan item ini..."
                                            value={item.description}
                                            disabled={isSubmitting}
                                            onChange={(e) => {
                                                const newItems = [...splitItems];
                                                newItems[idx].description = e.target.value;
                                                setSplitItems(newItems);
                                            }}
                                        />
                                    </div>
                                    <div className="w-32">
                                        <input
                                            type="number"
                                            className="w-full px-3 py-3 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none text-right disabled:opacity-50 disabled:bg-slate-50"
                                            placeholder="0"
                                            value={item.amount || ''}
                                            disabled={isSubmitting}
                                            onChange={(e) => {
                                                const newItems = [...splitItems];
                                                newItems[idx].amount = parseFloat(e.target.value);
                                                setSplitItems(newItems);
                                            }}
                                        />
                                    </div>
                                    <button onClick={() => {
                                        const newItems = splitItems.filter((_, i) => i !== idx);
                                        setSplitItems(newItems);
                                    }} className="p-3 text-slate-300 hover:text-rose-500"><Trash2 size={16} /></button>
                                </div>
                            ))}
                            <button
                                onClick={() => setSplitItems([...splitItems, { coaId: '', coaName: '', amount: 0, description: '', type: TransactionType.OUT }])}
                                className="w-full py-3 border-2 border-dashed border-slate-200 rounded-xl text-xs font-bold text-slate-400 hover:border-blue-400 hover:text-blue-500 transition"
                            >
                                + TAMBAH BARIS
                            </button>
                        </div>
                    )}

                    {/* 4. DETAILS (Date, Desc, Contact) */}
                    <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-3">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">TANGGAL</label>
                            <input type="date" className="w-full p-4 bg-slate-50 rounded-[1.5rem] text-xs font-bold outline-none disabled:opacity-50"
                                value={formData.date ? formData.date.split('T')[0] : ''}
                                onChange={e => setFormData({ ...formData, date: e.target.value })}
                                disabled={isSubmitting}
                            />
                        </div>
                        <div className="space-y-3">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">KONTAK</label>
                            <input className="w-full p-4 bg-slate-50 rounded-[1.5rem] text-xs font-bold outline-none disabled:opacity-50"
                                placeholder="Nama Orang/PT"
                                value={formData.contactName || ''}
                                onChange={e => setFormData({ ...formData, contactName: e.target.value })}
                                disabled={isSubmitting}
                            />
                        </div>
                    </div>

                    {!isSplit && (
                        <div className="space-y-3">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">DESKRIPSI UMUM</label>
                            <textarea
                                className="w-full p-5 bg-slate-50 rounded-[1.5rem] text-xs font-bold outline-none resize-none h-20 disabled:opacity-50"
                                placeholder="Keterangan transaksi..."
                                value={formData.description || ''}
                                onChange={e => setFormData({ ...formData, description: e.target.value })}
                                disabled={isSubmitting}
                            />
                        </div>
                    )}

                    {/* New: Business Unit (Shared) */}
                    <div className="space-y-3">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">ALOKASI UNIT (KB POS)</label>
                        <select
                            className="w-full p-4 bg-slate-50 border-none rounded-[1.5rem] text-xs font-bold uppercase outline-none disabled:opacity-50"
                            value={formData.businessUnitId || ''}
                            onChange={e => setFormData({ ...formData, businessUnitId: e.target.value })}
                            disabled={isSubmitting}
                        >
                            <option value="">-- ILUSTRASI UMUM / SHARED --</option>
                            {businessUnits.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                        </select>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-6 pt-6 border-t border-slate-50">
                        <button
                            onClick={onClose}
                            disabled={isSubmitting}
                            className="flex-1 py-4 text-slate-400 font-bold uppercase tracking-widest hover:bg-slate-50 rounded-[1.5rem] transition text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            BATAL
                        </button>
                        <button
                            onClick={handleSubmit}
                            disabled={isSubmitting}
                            className={`flex-1 py-4 text-white rounded-[2rem] font-bold uppercase tracking-widest transition text-xs shadow-xl flex items-center justify-center gap-2 ${isSubmitting ? 'bg-slate-400 cursor-not-allowed' : 'bg-slate-900 hover:bg-blue-600'}`}
                        >
                            {isSubmitting ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                    MENYIMPAN...
                                </>
                            ) : (
                                isEditing ? 'UPDATE' : 'SIMPAN'
                            )}
                        </button>
                    </div>

                </div>
            </div>
        </div>
    );
};
