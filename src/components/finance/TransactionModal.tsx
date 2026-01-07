import React, { useState, useEffect } from 'react';
import { Transaction, TransactionType, FinancialAccountDef, TransactionCategory, BusinessUnit } from '../../types';
import { Landmark, Plus, Search, ImageIcon, Trash2, CreditCard } from 'lucide-react';
import { useToast } from '../Toast';

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  isEditing: boolean;
  initialData: Transaction;
  
  financialAccounts: FinancialAccountDef[];
  categories: TransactionCategory[];
  businessUnits: BusinessUnit[];

  onSave: (data: Transaction) => Promise<void>;
  
  // Logic for Auto-Create props
  onAddAccount?: (acc: FinancialAccountDef) => Promise<void>;
  onAddCategory?: (cat: TransactionCategory) => Promise<void>;
  
  uploadFile?: (file: File) => Promise<string>;
  toast: ReturnType<typeof useToast>;
}

export const TransactionModal: React.FC<TransactionModalProps> = ({
  isOpen, onClose, isEditing, initialData,
  financialAccounts, categories, businessUnits,
  onSave, onAddAccount, onAddCategory,
  uploadFile, toast
}) => {
  const [formData, setFormData] = useState<Transaction>(initialData);
  const [accountSearch, setAccountSearch] = useState('');
  const [showAccountDropdown, setShowAccountDropdown] = useState(false);
  const [categorySearch, setCategorySearch] = useState('');
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);

  // Initialize state when modal opens
  useEffect(() => {
    if (isOpen) {
      setFormData(initialData);
      setAccountSearch(initialData.account || '');
      setCategorySearch(initialData.category || '');
    }
  }, [isOpen, initialData]);

  // Group Categories Data used for Search
  const groupedCategories = React.useMemo(() => {
     const income = categories.filter(c => c.type === TransactionType.IN && !c.parentId);
     const expense = categories.filter(c => c.type === TransactionType.OUT && !c.parentId);
     const getChildren = (parentId: string) => categories.filter(c => c.parentId === parentId);

     return {
         IN: income.map(c => ({ ...c, children: getChildren(c.id) })),
         OUT: expense.map(c => ({ ...c, children: getChildren(c.id) }))
     };
  }, [categories]);

  const handleSubmit = async () => {
    if (formData.amount <= 0) {
      toast.warning("Nominal harus lebih dari 0");
      return;
    }
    if (!formData.description) {
      toast.warning("Deskripsi wajib diisi");
      return;
    }

    // --- ACCOUNT LOGIC ---
    const finalAccountName = accountSearch || formData.account;
    if (!finalAccountName) {
        toast.warning("Pilih atau ketik nama akun keuangan");
        return;
    }
    
    // Auto-Create Account
    const accountExists = financialAccounts.some(acc => acc.name.toLowerCase() === finalAccountName.toLowerCase());
    if (!accountExists) {
         if (!confirm(`Akun "${finalAccountName}" belum ada. Buat baru otomatis?`)) return;

         try {
             if (onAddAccount) {
                 await onAddAccount({
                     id: Math.random().toString(36).substr(2, 9),
                     name: finalAccountName,
                     bankName: 'General / Tunai', 
                     accountNumber: '-',
                     description: 'Auto-created from transaction entry',
                     isActive: true
                 });
                 toast.success(`Akun "${finalAccountName}" berhasil dibuat.`);
             } else {
                 toast.error("Fungsi tambah akun tidak tersedia.");
                 return;
             }
         } catch(e) {
             toast.error("Gagal membuat akun baru otomatis.");
             return;
         }
    }

    // --- CATEGORY LOGIC ---
    let finalCategory = formData.category;
    if (categorySearch && categorySearch !== formData.category) {
        finalCategory = categorySearch; 
    }
    
    // Auto-Create Category
    if (finalCategory && !categories.some(c => c.name.toLowerCase() === finalCategory.toLowerCase())) {
        if (!confirm(`Kategori "${finalCategory}" belum ada. Buat otomatis?`)) return;

        try {
            if (onAddCategory) {
                await onAddCategory({
                    id: Math.random().toString(36).substr(2, 9),
                    name: finalCategory,
                    type: formData.type, 
                    parentId: null
                });
                toast.success(`Kategori "${finalCategory}" dibuat otomatis.`);
            }
        } catch (e) {
            toast.error("Gagal membuat kategori baru otomatis.");
            return;
        }
    }

    // Final Payload
    const payload: Transaction = {
        ...formData,
        account: finalAccountName,
        category: finalCategory,
        // Ensure ID is passed if editing, else new ID is handled by Parent or API (Here parent expects ID in payload usually if we look at legacy code)
        // Actually, the legacy code generated ID in HandleSubmit if not editing.
        // We will respect that logic.
        id: isEditing ? formData.id : (formData.id || Math.random().toString(36).substr(2, 9)),
        date: formData.date ? new Date(formData.date).toISOString() : new Date().toISOString()
    };
    
    await onSave(payload);
    onClose();
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.warning("Ukuran file maksimal 5MB");
        return;
      }
      if (uploadFile) {
        try {
          toast.info("Mengupload bukti...");
          const url = await uploadFile(file);
          setFormData(prev => ({ ...prev, imageUrl: url }));
          toast.success("Bukti berhasil diupload!");
        } catch(err) {
          toast.error("Gagal upload gambar.");
        }
      } else {
        const reader = new FileReader();
        reader.onloadend = () => {
          setFormData(prev => ({ ...prev, imageUrl: reader.result as string }));
        };
        reader.readAsDataURL(file);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/90 backdrop-blur-md p-4 animate-in fade-in duration-200">
        <div className="bg-white rounded-[3.5rem] w-full max-w-2xl p-12 shadow-2xl border border-white/20 animate-in zoom-in duration-300 overflow-y-auto max-h-[90vh]">
            {/* Header */}
            <div className="flex justify-between items-center mb-10">
            <div>
                <h3 className="text-3xl font-black text-slate-800 leading-tight italic uppercase tracking-tighter">{isEditing ? 'Edit Transaksi' : 'Input Transaksi'}</h3>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">{formData.type === TransactionType.IN ? 'DANA MASUK (IN)' : 'DANA KELUAR (OUT)'}</p>
            </div>
            <button onClick={onClose} className="p-4 bg-slate-100 rounded-2xl text-slate-400 hover:text-rose-500 transition">✕</button>
            </div>
            
            <div className="space-y-8">
            {/* Type Toggle */}
            <div className="flex bg-slate-50 p-2 rounded-[1.5rem] border border-slate-100">
                <button 
                onClick={() => setFormData({...formData, type: TransactionType.IN, category: ''})}
                className={`flex-1 py-4 text-xs font-black uppercase tracking-widest rounded-2xl transition-all ${formData.type === TransactionType.IN ? 'bg-slate-900 shadow-xl text-emerald-400' : 'text-slate-400'}`}
                >DANA MASUK (IN)</button>
                <button 
                onClick={() => setFormData({...formData, type: TransactionType.OUT, category: ''})}
                className={`flex-1 py-4 text-xs font-black uppercase tracking-widest rounded-2xl transition-all ${formData.type === TransactionType.OUT ? 'bg-slate-900 shadow-xl text-rose-500' : 'text-slate-400'}`}
                >DANA KELUAR (OUT)</button>
            </div>

            {/* Date Input */}
            <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">TANGGAL TRANSAKSI</label>
                <input 
                type="date"
                className="w-full p-5 bg-slate-50 border-2 border-transparent rounded-[1.5rem] text-xs font-bold outline-none focus:border-blue-600 focus:bg-white transition shadow-sm text-slate-800"
                placeholder="YYYY-MM-DD"
                value={formData.date ? formData.date.split('T')[0] : ''} // Ensure format
                onChange={e => setFormData({...formData, date: e.target.value})}
                />
            </div>

            {/* Amount Input */}
            <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">NOMINAL TRANSAKSI (IDR)</label>
                <div className="relative">
                <span className="absolute left-6 top-1/2 -translate-y-1/2 text-2xl font-black text-slate-300">Rp</span>
                <input 
                    type="number" 
                    className="w-full text-5xl font-black pl-20 pr-8 py-6 bg-slate-50 border-4 border-transparent focus:border-blue-600 focus:bg-white rounded-[2rem] outline-none transition placeholder:text-slate-200"
                    placeholder="0"
                    value={formData.amount || ''}
                    onChange={e => setFormData({...formData, amount: parseFloat(e.target.value)})}
                />
                </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
                {/* Account Search */}
                <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">PILIH REKENING AKUN</label>
                    <div className="relative">
                    <div className="relative">
                        <Landmark size={16} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300" />
                        <input 
                        className="w-full pl-12 pr-5 py-5 bg-slate-50 border-2 border-transparent rounded-[1.5rem] text-xs font-black uppercase tracking-widest outline-none focus:border-blue-600 focus:bg-white transition shadow-sm"
                        placeholder="Cari / Ketik Akun Baru..."
                        value={accountSearch}
                        onChange={(e) => {
                            setAccountSearch(e.target.value);
                            setFormData({...formData, account: e.target.value});
                            setShowAccountDropdown(true);
                        }}
                        onFocus={() => setShowAccountDropdown(true)}
                        />
                    </div>
                    {showAccountDropdown && (accountSearch.length > 0 || true) && (
                        <div className="absolute z-10 mt-2 w-full bg-white rounded-[1.5rem] shadow-2xl border border-slate-100 max-h-60 overflow-y-auto custom-scrollbar p-2">
                            {(() => {
                                const filteredAccs = financialAccounts.filter(a => a.name.toLowerCase().includes(accountSearch.toLowerCase()));
                                const exactMatch = filteredAccs.some(a => a.name.toLowerCase() === accountSearch.toLowerCase());
                                
                                return (
                                    <>
                                        {filteredAccs.map(acc => (
                                            <button 
                                                key={acc.id}
                                                onClick={() => {
                                                    setAccountSearch(acc.name);
                                                    setFormData({...formData, account: acc.name});
                                                    setShowAccountDropdown(false);
                                                }}
                                                className="w-full text-left px-5 py-3 rounded-xl hover:bg-slate-50 transition text-[10px] font-black uppercase tracking-widest text-slate-600 flex justify-between"
                                            >
                                                <span>{acc.name}</span>
                                                <span className="text-[8px] bg-slate-100 px-2 py-0.5 rounded text-slate-400">{acc.bankName}</span>
                                            </button>
                                        ))}
                                        {accountSearch && !exactMatch && (
                                            <button 
                                                onClick={() => {
                                                    setShowAccountDropdown(false);
                                                }}
                                                className="w-full text-left px-5 py-3 rounded-xl hover:bg-emerald-50 bg-blue-50/50 mt-1 transition text-[10px] font-black uppercase tracking-widest text-blue-600 border border-blue-100 flex items-center gap-2"
                                            >
                                                <Plus size={14} /> <span>BUAT AKUN BARU: "{accountSearch}"</span>
                                            </button>
                                        )}
                                    </>
                                );
                            })()}
                        </div>
                    )}
                    {showAccountDropdown && <div className="fixed inset-0 z-0" onClick={() => setShowAccountDropdown(false)} style={{ display: 'none' }}></div>}
                    </div>
                </div>

                {/* Business Unit Select */}
                <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">ALOKASI UNIT (KB POS)</label>
                    <select 
                    className="w-full p-5 bg-indigo-50 border-2 border-transparent rounded-[1.5rem] text-xs font-black uppercase tracking-widest outline-none focus:border-indigo-500 focus:bg-white transition shadow-sm text-indigo-900"
                    value={formData.businessUnitId || ''}
                    onChange={e => setFormData({...formData, businessUnitId: e.target.value})}
                    >
                    <option value="">-- ILUSTRASI UMUM / SHARED --</option>
                    {businessUnits.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                    </select>
                </div>

                {/* Category Search */}
                <div className="space-y-3 col-span-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">KATEGORI AKUNTANSI (SEARCH)</label>
                <div className="relative">
                    <div className="relative">
                        <Search size={16} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300" />
                        <input 
                            className="w-full pl-12 pr-5 py-5 bg-slate-50 border-2 border-transparent rounded-[1.5rem] text-xs font-black uppercase tracking-widest outline-none focus:border-blue-600 focus:bg-white transition shadow-sm"
                            placeholder="Ketik untuk mencari kategori..."
                            value={categorySearch}
                            onChange={(e) => {
                            setCategorySearch(e.target.value);
                            setFormData({...formData, category: e.target.value}); 
                            setShowCategoryDropdown(true);
                            }}
                            onFocus={() => setShowCategoryDropdown(true)}
                        />
                    </div>
                    {showCategoryDropdown && (categorySearch.length > 0 || true) && (
                        <div className="absolute z-10 mt-2 w-full bg-white rounded-[1.5rem] shadow-2xl border border-slate-100 max-h-60 overflow-y-auto custom-scrollbar p-2">
                            {(() => {
                                const availableCats = formData.type === TransactionType.IN ? groupedCategories.IN : groupedCategories.OUT;
                                let allOptions: TransactionCategory[] = [];
                                
                                availableCats.forEach(c => {
                                    if (c.name.toLowerCase().includes(categorySearch.toLowerCase())) allOptions.push(c);
                                    if (c.children) {
                                        c.children.forEach(child => {
                                            if (child.name.toLowerCase().includes(categorySearch.toLowerCase())) allOptions.push(child);
                                        });
                                    }
                                });
                                // Deduplicate
                                const uniqueOptions = Array.from(new Map(allOptions.map(item => [item.id, item])).values());
                                const exactMatch = uniqueOptions.some(c => c.name.toLowerCase() === categorySearch.toLowerCase());

                                return (
                                    <>
                                        {uniqueOptions.map(cat => (
                                            <button 
                                            key={cat.id}
                                            onClick={() => {
                                                setCategorySearch(cat.name);
                                                setFormData({...formData, category: cat.name});
                                                setShowCategoryDropdown(false);
                                            }}
                                            className="w-full text-left px-5 py-3 rounded-xl hover:bg-slate-50 transition text-[10px] font-black uppercase tracking-widest text-slate-600 flex justify-between group"
                                            >
                                                <span>{cat.name}</span>
                                                {cat.parentId && <span className="text-[8px] bg-slate-100 px-2 py-0.5 rounded text-slate-400">Sub</span>}
                                            </button>
                                        ))}
                                        
                                        {categorySearch && !exactMatch && (
                                            <button 
                                            onClick={() => {
                                                setFormData({...formData, category: categorySearch});
                                                setShowCategoryDropdown(false);
                                            }}
                                            className="w-full text-left px-5 py-3 rounded-xl hover:bg-emerald-50 bg-blue-50/50 mt-1 transition text-[10px] font-black uppercase tracking-widest text-blue-600 border border-blue-100 flex items-center gap-2"
                                            >
                                                <Plus size={14} /> <span>PAKAI & BUAT BARU: "{categorySearch}"</span>
                                            </button>
                                        )}
                                        {uniqueOptions.length === 0 && !categorySearch && (
                                            <div className="p-4 text-center text-[10px] text-slate-400 italic">Mulai ketik untuk mencari kategori...</div>
                                        )}
                                    </>
                                );
                            })()}
                        </div>
                    )}
                    {showCategoryDropdown && <div className="fixed inset-0 z-0" onClick={() => setShowCategoryDropdown(false)} style={{ display: 'none' }}></div>}
                </div>
                </div>
            </div>

            {/* Description Input */}
            <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">DESKRIPSI / CATATAN TRANSAKSI</label>
                <input 
                className="w-full p-5 bg-slate-50 border-2 border-transparent rounded-[1.5rem] text-xs font-bold outline-none focus:border-blue-600 focus:bg-white transition shadow-sm"
                placeholder="Contoh: Pembayaran Pelunasan Project X..."
                value={formData.description}
                onChange={e => setFormData({...formData, description: e.target.value})}
                />
            </div>

            {/* Evidence Upload */}
            <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">LAMPIRAN BUKTI (OPSIONAL)</label>
                {!formData.imageUrl ? (
                <label className="w-full h-40 bg-slate-50 border-4 border-dashed border-slate-100 rounded-[2rem] flex flex-col items-center justify-center cursor-pointer hover:border-blue-300 hover:bg-blue-50 transition group">
                    <ImageIcon size={40} className="text-slate-200 group-hover:text-blue-500 mb-3 transition" />
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">UPLOAD BUKTI TF / KWITANSI</span>
                    <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
                </label>
                ) : (
                <div className="relative rounded-[2rem] overflow-hidden group h-40 border-4 border-slate-50 shadow-inner">
                    <img src={formData.imageUrl} alt="Bukti" className="w-full h-full object-cover" />
                    <button onClick={() => setFormData({...formData, imageUrl: ''})} className="absolute top-4 right-4 p-3 bg-rose-500 text-white rounded-xl shadow-xl opacity-0 group-hover:opacity-100 transition"><Trash2 size={18} /></button>
                </div>
                )}
            </div>

            {/* Actions */}
            <div className="flex gap-6 pt-10 border-t border-slate-50">
                <button onClick={onClose} className="flex-1 py-5 text-slate-400 font-black uppercase tracking-widest hover:bg-slate-50 rounded-[1.5rem] transition text-[10px]">BATAL</button>
                <button onClick={handleSubmit} className="flex-1 py-5 bg-slate-900 text-white rounded-[2rem] font-black uppercase tracking-[0.2em] hover:bg-blue-600 transition text-[10px] shadow-2xl shadow-slate-200">
                {isEditing ? 'UPDATE TRANSAKSI' : 'SIMPAN TRANSAKSI'}
                </button>
            </div>
            </div>
        </div>
    </div>
  );
};
