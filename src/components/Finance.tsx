
import React, { useState, useEffect, useMemo } from 'react';
import { read, utils, writeFile } from 'xlsx';
import { Transaction, TransactionType, FinancialAccountDef, TransactionCategory, BusinessUnit } from '../types';
import { formatCurrency } from '../utils';
import { Plus, TrendingUp, Landmark, PieChart, FileSpreadsheet, Wallet, Filter, Search, Image as ImageIcon, BookOpen, ChevronRight, Trash2, Edit, Calendar, RefreshCw, CreditCard, FolderTree, ArrowDown, ArrowUp, Folder, Building2, LayoutGrid } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { useToast } from './Toast';

interface FinanceProps {
  transactions: Transaction[]; // Fallback or Initial
  financialAccounts: FinancialAccountDef[];
  categories: TransactionCategory[];
  
  onAddTransaction: (t: Transaction) => Promise<void>;
  onUpdateTransaction: (t: Transaction) => Promise<void>;
  onDeleteTransaction: (id: string, detail: string) => Promise<void>;
  
  // Account Management Props
  onAddAccount?: (acc: FinancialAccountDef) => Promise<void>;
  onUpdateAccount?: (acc: FinancialAccountDef) => Promise<void>;
  onDeleteAccount?: (id: string) => Promise<void>;

  // Category Management Props
  onAddCategory?: (cat: TransactionCategory) => Promise<void>;
  onUpdateCategory?: (cat: TransactionCategory) => Promise<void>;
  onDeleteCategory?: (id: string) => Promise<void>;
  importCategories?: (cats: Partial<TransactionCategory>[]) => Promise<void>;

  // Business Unit Props
  businessUnits: BusinessUnit[];
  onAddBusinessUnit?: (unit: BusinessUnit) => Promise<void>;
  onUpdateBusinessUnit?: (unit: BusinessUnit) => Promise<void>;
  onDeleteBusinessUnit?: (id: string) => Promise<void>;

  toast: ReturnType<typeof useToast>;
  uploadFile?: (file: File) => Promise<string>;
}

const FinanceModule: React.FC<FinanceProps> = ({ 
  transactions: initialTransactions, 
  financialAccounts, 
  categories,
  onAddTransaction, 
  onUpdateTransaction, 
  onDeleteTransaction, 
  onAddAccount,
  onUpdateAccount,
  onDeleteAccount,
  onAddCategory,
  onUpdateCategory,
  onDeleteCategory,
  importCategories,
  businessUnits,
  onAddBusinessUnit,
  onUpdateBusinessUnit,
  onDeleteBusinessUnit,
  toast, 
  uploadFile 
}) => {
  const [activeTab, setActiveTab] = useState<'MUTASI' | 'BUKU_BESAR' | 'LAPORAN' | 'KATEGORI' | 'KBPOS'>('MUTASI');
  const [showAdd, setShowAdd] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  
  // Filters
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [filterAccount, setFilterAccount] = useState<string>('ALL');
  const [filterBusinessUnit, setFilterBusinessUnit] = useState<string>('ALL');
  
  // Data State
  const [localTransactions, setLocalTransactions] = useState<Transaction[]>([]);
  const [summary, setSummary] = useState<{
    accountBalances: Record<string, number>;
    totalAssets: number;
    monthStats: { income: number; expense: number };
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Selected for Ledger
  const [ledgerAccount, setLedgerAccount] = useState<string>('');
  
  // Transaction Form State
  const [formData, setFormData] = useState({
    id: '',
    amount: 0,
    type: TransactionType.IN,
    category: '',
    description: '',
    account: '',
    businessUnitId: '',
    imageUrl: ''
  });

  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // Account Form State
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [isEditingAccount, setIsEditingAccount] = useState(false);
  const [accountFormData, setAccountFormData] = useState<Partial<FinancialAccountDef>>({
      name: '',
      bankName: '',
      accountNumber: '',
      description: '',
      isActive: true
  });

  // Category Form State
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [categoryFormData, setCategoryFormData] = useState<Partial<TransactionCategory>>({
      name: '',
      type: TransactionType.OUT,
      parentId: null
  });
  const [expandedCategories, setExpandedCategories] = useState<string[]>([]); // Ids of expanded categories
  
  // Searchable Category State
  const [categorySearch, setCategorySearch] = useState('');
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);

  // Business Unit Form State
  const [showBusinessModal, setShowBusinessModal] = useState(false);
  const [businessFormData, setBusinessFormData] = useState<Partial<BusinessUnit>>({
      name: '',
      description: '',
      isActive: true
  });

  // Initial Load & Refresh
  const fetchData = async () => {
    setIsLoading(true);
    const token = typeof window !== 'undefined' ? localStorage.getItem('sdm_erp_auth_token') : null;
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      let url = '/api/finance/summary';
      if (filterBusinessUnit && filterBusinessUnit !== 'ALL') {
          url += `?businessUnitId=${filterBusinessUnit}`;
      }
      const resSum = await fetch(url, { headers });
      if (resSum.ok) {
        setSummary(await resSum.json());
      } else {
         if (resSum.status === 401) toast.error("Sesi habis, silakan login ulang");
      }

      const year = selectedYear;
      const month = selectedMonth + 1; // 1-12
      const startDate = `${year}-${month.toString().padStart(2, '0')}-01`;
      const lastDay = new Date(year, month, 0).getDate();
      const endDate = `${year}-${month.toString().padStart(2, '0')}-${lastDay}`;

      const resTrans = await fetch(`/api/transactions?startDate=${startDate}&endDate=${endDate}&limit=2000`, { headers });
      if (resTrans.ok) {
        const data = await resTrans.json();
        setLocalTransactions(data);
      }
    } catch (e) {
      console.error(e);
      toast.error('Gagal memuat data keuangan');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedMonth, selectedYear, filterBusinessUnit]);

  // Set default ledger account when accounts load
  useEffect(() => {
    if (financialAccounts.length > 0 && !ledgerAccount) {
      setLedgerAccount(financialAccounts[0].name);
    }
    if (financialAccounts.length > 0 && !formData.account) {
      setFormData(prev => ({ ...prev, account: financialAccounts[0].name }));
    }
    // Set default business unit if available
    if (businessUnits.length > 0 && !formData.businessUnitId) {
        setFormData(prev => ({ ...prev, businessUnitId: businessUnits[0].id }));
    }
  }, [financialAccounts, businessUnits]);

  const filteredTransactions = useMemo(() => {
    return localTransactions
      .filter(t => filterAccount === 'ALL' || t.account === filterAccount)
      .filter(t => filterBusinessUnit === 'ALL' || t.businessUnitId === filterBusinessUnit) // Filter by KB Pos
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [localTransactions, filterAccount, filterBusinessUnit]);

  // Ledger Logic
  const ledgerEntries = useMemo(() => {
    const accountTransactions = localTransactions
      .filter(t => t.account === ledgerAccount)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()); 

    let runningBalance = 0; 
    
    return accountTransactions.map(t => {
      if (t.type === TransactionType.IN) runningBalance += t.amount;
      else runningBalance -= t.amount;
      return { ...t, runningBalance };
    }).reverse(); 
  }, [localTransactions, ledgerAccount]);

  const handleOpenAdd = () => {
    setFormData({
      id: '',
      amount: 0,
      type: TransactionType.IN,
      category: '',
      description: '',
      account: financialAccounts[0]?.name || '',
      businessUnitId: businessUnits[0]?.id || '',
      imageUrl: ''
    });
    setIsEditing(false);
    setCategorySearch(''); // Reset search
    setShowAdd(true);
  };

  const handleEdit = (t: Transaction) => {
    setFormData({
      id: t.id,
      amount: t.amount,
      type: t.type,
      category: t.category,
      description: t.description,
      account: t.account,
      businessUnitId: t.businessUnitId || '',
      imageUrl: t.imageUrl || ''
    });
    setCategorySearch(t.category); // Init search with existing category
    setIsEditing(true);
    setShowAdd(true);
  };

  const handleDelete = async (t: Transaction) => {
    if (confirm(`Yakin ingin menghapus transaksi: ${t.description}?`)) {
      await onDeleteTransaction(t.id, `${formatCurrency(t.amount)} - ${t.description}`);
      toast.success('Transaksi dihapus');
      fetchData(); // Refresh
    }
  };

  const handleSubmit = async () => {
    if (formData.amount <= 0) {
      toast.warning("Nominal harus lebih dari 0");
      return;
    }
    if (!formData.description) {
      toast.warning("Deskripsi wajib diisi");
      return;
    }
    if (!formData.account) {
        toast.warning("Pilih akun keuangan");
        return;
    }
    
    // Auto-Create Category Logic
    let finalCategory = formData.category;
    if (categorySearch && categorySearch !== formData.category) {
        finalCategory = categorySearch; // Use what user typed
    }
    
    if (finalCategory && !categories.some(c => c.name.toLowerCase() === finalCategory.toLowerCase())) {
        const confirmCreate = confirm(`Kategori "${finalCategory}" belum ada. Buat otomatis sebagai ${formData.type === TransactionType.IN ? 'PEMASUKAN' : 'PENGELUARAN'}?`);
        if (!confirmCreate) return;

        try {
            if (onAddCategory) {
                await onAddCategory({
                    id: Math.random().toString(36).substr(2, 9),
                    name: finalCategory,
                    type: formData.type, // Auto-inherit type from transaction
                    parentId: null
                });
                toast.success(`Kategori "${finalCategory}" dibuat otomatis.`);
            }
        } catch (e) {
            toast.error("Gagal membuat kategori baru otomatis.");
            return;
        }
    }

    try {
      const payload: Transaction = {
        ...formData,
        category: finalCategory,
        id: isEditing ? formData.id : Math.random().toString(36).substr(2, 9),
        date: isEditing ? localTransactions.find(t => t.id === formData.id)?.date || new Date().toISOString() : new Date().toISOString()
      };

      if (isEditing) {
        await onUpdateTransaction(payload);
        toast.success('Transaksi diperbarui');
      } else {
        await onAddTransaction(payload);
        toast.success('Transaksi berhasil disimpan');
      }
      setShowAdd(false);
      fetchData(); // Refresh data
    } catch (e) {
      toast.error('Gagal menyimpan transaksi');
    }
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

  // --- ACCOUNT MANAGEMENT HANDLERS ---
  const openAddAccount = () => {
      setAccountFormData({ name: '', bankName: '', accountNumber: '', description: '', isActive: true });
      setIsEditingAccount(false);
      setShowAccountModal(true);
  };

  const openEditAccount = (acc: FinancialAccountDef, e: React.MouseEvent) => {
      e.stopPropagation(); 
      setAccountFormData(acc);
      setIsEditingAccount(true);
      setShowAccountModal(true);
  };

  const handleSubmitAccount = async () => {
      if (!accountFormData.name || !accountFormData.bankName) {
          toast.warning("Nama Akun dan Nama Bank wajib diisi");
          return;
      }
      try {
          if (isEditingAccount && onUpdateAccount && accountFormData.id) {
              await onUpdateAccount(accountFormData as FinancialAccountDef);
              toast.success("Rekening berhasil update");
          } else if (!isEditingAccount && onAddAccount) {
              await onAddAccount(accountFormData as any);
              toast.success("Rekening berhasil dibuat");
          }
          setShowAccountModal(false);
      } catch (e) {
          toast.error("Gagal menyimpan rekening");
      }
  };

  const handleDeleteAccount = async () => {
      if (!isEditingAccount || !accountFormData.id || !onDeleteAccount) return;
      if (confirm(`Yakin ingin menghapus rekening ${accountFormData.name}? Data akan dinonaktifkan.`)) {
          try {
              await onDeleteAccount(accountFormData.id);
              toast.success("Rekening dihapus");
              setShowAccountModal(false);
          } catch(e) {
              toast.error("Gagal menghapus rekening");
          }
      }
  };

  // --- CATEGORY MANAGEMENT HANDLERS ---
  const groupedCategories = useMemo(() => {
    const income = categories.filter(c => c.type === TransactionType.IN && !c.parentId);
    const expense = categories.filter(c => c.type === TransactionType.OUT && !c.parentId);
    
    // Helper to get children
    const getChildren = (parentId: string) => categories.filter(c => c.parentId === parentId);

    return {
        IN: income.map(c => ({ ...c, children: getChildren(c.id) })),
        OUT: expense.map(c => ({ ...c, children: getChildren(c.id) }))
    };
  }, [categories]);

  const openAddCategory = (type: TransactionType, parentId: string | null = null) => {
      setCategoryFormData({ name: '', type, parentId });
      setShowCategoryModal(true);
  };

  const handleDeleteCategory = async (id: string, name: string) => {
      if (confirm(`Hapus kategori "${name}"? Sub-kategori juga akan hilang.`)) {
          if (onDeleteCategory) await onDeleteCategory(id);
      }
  }

  const handleAddCategory = async () => {
      if (!categoryFormData.name) {
          toast.warning("Nama kategori wajib diisi");
          return;
      }
      try {
          if (onAddCategory) await onAddCategory(categoryFormData as any);
          toast.success("Kategori ditambahkan");
          setShowCategoryModal(false);
      } catch (e) {
          toast.error("Gagal menambah kategori");
      }
  };

  const handleDownloadTemplate = () => {
      const headers = ["Name", "Type", "Parent"];
      const data = [
          { Name: "Contoh: Gaji Pokok", Type: "OUT", Parent: "Gaji & Tunjangan" },
          { Name: "Contoh: Penjualan Produk", Type: "IN", Parent: "" },
          { Name: "Contoh: Listrik & Air", Type: "OUT", Parent: "Operasional Kantor" },
      ];

      const ws = utils.json_to_sheet(data, { header: headers });
      
      // Auto-width adjustment for better UX
      const wscols = [
          { wch: 30 }, // Name
          { wch: 10 }, // Type
          { wch: 30 }, // Parent
      ];
      ws['!cols'] = wscols;

      const wb = utils.book_new();
      utils.book_append_sheet(wb, ws, "Template Kategori");
      
      writeFile(wb, "Template_Import_Kategori.xlsx");
      toast.success("Template berhasil didownload");
  };

  const handleImportCategory = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      try {
          const data = await file.arrayBuffer();
          const workbook = read(data);
          const sheetName = workbook.SheetNames[0];
          const sheet = workbook.Sheets[sheetName];
          const jsonData = utils.sheet_to_json(sheet);
          
          // Validate and Format
          const categoriesToImport: any[] = jsonData.map((row: any) => {
             const typeStr = (row['Type'] || row['Tipe'] || '').toString().toUpperCase();
             const type = typeStr.includes('IN') || typeStr.includes('MASUK') ? TransactionType.IN : TransactionType.OUT;
             
             return {
                 name: row['Name'] || row['Nama'],
                 type: type,
                 parentName: row['Parent'] || row['Induk'] || null
             };
          }).filter(c => c.name); // Filter empty names

          if (categoriesToImport.length === 0) {
             toast.warning("Tidak ada data kategori yang valid dalam file (Pastikan kolom Name/Nama ada)");
             return;
          }

          if (importCategories) {
              toast.info(`Mengimport ${categoriesToImport.length} kategori...`);
              await importCategories(categoriesToImport);
              toast.success("Import berhasil!");
          }
      } catch (err) {
          console.error(err);
          toast.error("Gagal memproses file import");
      }
      
      // Reset input
      e.target.value = '';
  };

  // --- BUSINESS UNIT MANAGMENT HANDLERS ---
  const handleOpenBusinessModal = (unit?: BusinessUnit) => {
      if (unit) {
          setBusinessFormData(unit);
      } else {
          setBusinessFormData({ name: '', description: '', isActive: true });
      }
      setShowBusinessModal(true);
  };
  
  const handleSaveBusinessUnit = async () => {
      if (!businessFormData.name) {
          toast.warning("Nama Unit/KB Pos wajib diisi");
          return;
      }
      try {
        if (businessFormData.id && onUpdateBusinessUnit) {
            await onUpdateBusinessUnit(businessFormData as BusinessUnit);
            toast.success("KB Pos diupdate");
        } else if (onAddBusinessUnit) {
            await onAddBusinessUnit(businessFormData as BusinessUnit);
            toast.success("KB Pos baru dibuat");
        }
        setShowBusinessModal(false);
      } catch (e) {
         toast.error("Gagal simpan KB Pos"); 
      }
  };

  const handleDeleteBusinessUnit = async (id: string, name: string) => {
      if (confirm(`Hapus KB Pos "${name}"? Data historis mungkin terpengaruh.`)) {
          if (onDeleteBusinessUnit) {
              await onDeleteBusinessUnit(id);
              toast.success("KB Pos dihapus");
          }
      }
  };

  const MONTHS = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      {/* Header & Filter */}
      <div className="flex flex-col md:flex-row justify-between items-center bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 gap-4">
         <div>
            <h2 className="text-2xl font-black text-slate-800 italic uppercase">Finance Dashboard</h2>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">MONITORING ARUS KAS & ASET</p>
         </div>
         <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-2xl border border-slate-100">
            <Calendar size={16} className="text-slate-400 ml-2" />
            <select 
              value={selectedMonth} 
              onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
              className="bg-transparent text-sm font-bold text-slate-700 outline-none p-2"
            >
              {MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
            </select>
            <select 
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="bg-transparent text-sm font-bold text-slate-700 outline-none p-2"
            >
              {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <select 
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="bg-transparent text-sm font-bold text-slate-700 outline-none p-2"
            >
              {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            {/* Filter KB Pos */}
             <select 
              value={filterBusinessUnit} 
              onChange={(e) => setFilterBusinessUnit(e.target.value)}
              className="bg-blue-50 text-blue-700 text-xs font-black uppercase rounded-xl border-none outline-none p-2 tracking-wide"
            >
              <option value="ALL">SEMUA UNIT</option>
              {businessUnits.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
            <button onClick={fetchData} className="p-2 bg-blue-100 text-blue-600 rounded-xl hover:bg-blue-200 transition">
              <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
            </button>
         </div>
      </div>

      {/* Account Highlights */}
      <div className="flex overflow-x-auto pb-4 gap-4 snap-x custom-scrollbar">
        {financialAccounts.map(acc => {
          const bal = summary?.accountBalances[acc.name] || 0;
          const isSelected = filterAccount === acc.name;
          return (
            <div 
              key={acc.id} 
              onClick={() => {
                setFilterAccount(isSelected ? 'ALL' : acc.name);
                setLedgerAccount(acc.name);
              }}
              className={`relative flex-shrink-0 w-64 snap-start p-6 rounded-[2.5rem] border-2 cursor-pointer transition-all duration-300 group ${isSelected ? 'bg-slate-900 border-slate-900 text-white shadow-2xl shadow-slate-200' : 'bg-white border-slate-100 hover:border-blue-200 hover:shadow-lg shadow-sm text-slate-800'}`}
            >
              {onUpdateAccount && (
                  <button 
                    onClick={(e) => openEditAccount(acc, e)}
                    className="absolute top-4 right-4 p-2 bg-white/10 rounded-full hover:bg-white/20 transition opacity-0 group-hover:opacity-100"
                    title="Edit Rekening"
                  >
                      <Edit size={12} className={isSelected ? "text-white" : "text-slate-600"} />
                  </button>
              )}  

              <div className="flex justify-between items-start mb-4">
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${isSelected ? 'bg-white/10' : 'bg-blue-50 text-blue-600'}`}>
                  <Landmark size={20} />
                </div>
                {isSelected && <div className="text-[9px] font-black uppercase tracking-widest bg-blue-600 px-2 py-1 rounded-lg text-white">SELECTED</div>}
              </div>
              <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${isSelected ? 'text-slate-500' : 'text-slate-400'}`}>{acc.bankName} - {acc.name}</p>
              <h4 className="text-xl font-black tracking-tight leading-none">{formatCurrency(bal)}</h4>
            </div>
          );
        })}
        {onAddAccount && (
            <button 
                onClick={openAddAccount}
                className="flex-shrink-0 w-24 snap-start p-6 rounded-[2.5rem] border-2 border-dashed border-slate-200 flex flex-col items-center justify-center gap-2 hover:bg-slate-50 hover:border-blue-300 transition text-slate-300 hover:text-blue-500"
            >
                <Plus size={24} />
                <span className="text-[9px] font-black uppercase text-center">Add Rekening</span>
            </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-end border-b-2 border-slate-100">
        <div className="flex space-x-2 overflow-x-auto pb-1 custom-scrollbar w-full md:w-auto">
          <button onClick={() => setActiveTab('MUTASI')} className={`whitespace-nowrap pb-4 px-6 text-[11px] font-black uppercase tracking-widest transition-all ${activeTab === 'MUTASI' ? 'text-slate-900 border-b-4 border-slate-900' : 'text-slate-400 hover:text-slate-600'}`}>MUTASI JURNAL</button>
          <button onClick={() => setActiveTab('BUKU_BESAR')} className={`whitespace-nowrap pb-4 px-6 text-[11px] font-black uppercase tracking-widest transition-all ${activeTab === 'BUKU_BESAR' ? 'text-slate-900 border-b-4 border-slate-900' : 'text-slate-400 hover:text-slate-600'}`}>BUKU BESAR</button>
          <button onClick={() => setActiveTab('LAPORAN')} className={`whitespace-nowrap pb-4 px-6 text-[11px] font-black uppercase tracking-widest transition-all ${activeTab === 'LAPORAN' ? 'text-slate-900 border-b-4 border-slate-900' : 'text-slate-400 hover:text-slate-600'}`}>LAPORAN PERIODE INI</button>
          <button onClick={() => setActiveTab('KATEGORI')} className={`whitespace-nowrap pb-4 px-6 text-[11px] font-black uppercase tracking-widest transition-all ${activeTab === 'KATEGORI' ? 'text-slate-900 border-b-4 border-slate-900' : 'text-slate-400 hover:text-slate-600'}`}>MANAJEMEN KATEGORI</button>
          <button onClick={() => setActiveTab('KBPOS')} className={`whitespace-nowrap pb-4 px-6 text-[11px] font-black uppercase tracking-widest transition-all ${activeTab === 'KBPOS' ? 'text-slate-900 border-b-4 border-slate-900' : 'text-slate-400 hover:text-slate-600'}`}>MANAJEMEN KB POS (UNIT)</button>
        </div>
        <div className="flex items-center space-x-3 mb-4 flex-shrink-0">
          <div className="bg-slate-900 text-white px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center shadow-xl shadow-slate-100 italic">
            <Wallet size={14} className="mr-2 text-blue-400" /> TOTAL ASSETS: <span className="ml-2">{formatCurrency(summary?.totalAssets || 0)}</span>
          </div>
          <button onClick={handleOpenAdd} className="bg-blue-600 text-white px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center hover:bg-blue-700 transition shadow-2xl shadow-blue-100">
            <Plus size={16} className="mr-2" /> ENTRY TRANSAKSI
          </button>
        </div>
      </div>

      {/* CONTENT: MUTASI */}
      {activeTab === 'MUTASI' && (
        <div className="bg-white rounded-[3rem] shadow-xl border border-slate-100 overflow-hidden animate-in fade-in duration-500">
          <div className="p-10 border-b flex flex-col md:flex-row justify-between items-center gap-6 bg-slate-50/30">
            <div>
              <h4 className="text-2xl font-black text-slate-800 italic uppercase tracking-tighter">Jurnal {MONTHS[selectedMonth]} {selectedYear}</h4>
              <p className="text-[10px] text-slate-400 uppercase font-black tracking-[0.3em] mt-1">LOG TRANSAKSI KRONOLOGIS</p>
            </div>
            <div className="flex gap-3 w-full md:w-auto">
               <div className="relative flex-1 md:w-72">
                 <Search size={18} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300" />
                 <input className="w-full pl-12 pr-6 py-4 bg-white border-2 border-slate-50 rounded-[1.5rem] text-xs font-bold focus:border-blue-600 outline-none transition shadow-sm" placeholder="Cari keterangan..." />
               </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50/50 text-slate-400 text-[9px] font-black uppercase tracking-[0.2em] border-b border-slate-100">
                  <th className="px-10 py-6">TANGGAL</th>
                  <th className="px-10 py-6">ACCOUNT</th>
                  <th className="px-10 py-6">DESKRIPSI</th>
                  <th className="px-10 py-6">KATEGORI</th>
                  <th className="px-10 py-6">UNIT (KB)</th>
                  <th className="px-10 py-6 text-right">NOMINAL</th>
                  <th className="px-10 py-6 text-center">AKSI</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredTransactions.map(t => (
                  <tr key={t.id} className="hover:bg-blue-50/30 transition-colors group">
                    <td className="px-10 py-7 text-[10px] font-black text-slate-400 uppercase tracking-widest">{new Date(t.date).toLocaleDateString('id-ID', {day: '2-digit', month: 'short'})}</td>
                    <td className="px-10 py-7">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center">
                           <Landmark size={12} />
                        </div>
                        <span className="text-[10px] font-black text-slate-700 uppercase">{t.account}</span>
                      </div>
                    </td>
                    <td className="px-10 py-7 text-xs font-bold text-slate-600 italic">"{t.description}"</td>
                    <td className="px-10 py-7">
                      <span className="bg-white border border-slate-100 text-slate-500 px-3 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-[0.15em]">{t.category || 'GENERAL'}</span>
                    </td>
                    <td className="px-10 py-7">
                        {t.businessUnitId ? (
                            <span className="bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-[0.15em]">
                                {businessUnits.find(u => u.id === t.businessUnitId)?.name || 'UNKNOWN'}
                            </span>
                        ) : <span className="text-slate-300">-</span>}
                    </td>
                    <td className={`px-10 py-7 text-sm font-black text-right ${t.type === TransactionType.IN ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {t.type === TransactionType.IN ? '+' : '-'}{formatCurrency(t.amount)}
                    </td>
                    <td className="px-10 py-7 text-center">
                      <div className="flex items-center justify-center gap-2">
                        {t.imageUrl && (
                          <button onClick={() => setPreviewImage(t.imageUrl!)} className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-600 hover:text-white transition">
                             <ImageIcon size={14} />
                          </button>
                        )}
                        <button onClick={() => handleEdit(t)} className="p-2 bg-amber-50 text-amber-600 rounded-lg hover:bg-amber-500 hover:text-white transition">
                           <Edit size={14} />
                        </button>
                        <button onClick={() => handleDelete(t)} className="p-2 bg-rose-50 text-rose-600 rounded-lg hover:bg-rose-500 hover:text-white transition">
                           <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredTransactions.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-10 py-20 text-center text-slate-400 text-xs font-black uppercase tracking-widest">
                      TIDAK ADA TRANSAKSI PADA PERIODE INI
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CONTENT: BUKU BESAR & LAPORAN - NO CHANGES (KEPT SAME LOGIC) */}
      {activeTab === 'BUKU_BESAR' && (
        <div className="space-y-6 animate-in slide-in-from-bottom-6 duration-500">
           <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              <div className="lg:col-span-1 space-y-4">
                 <div className="bg-slate-900 p-8 rounded-[3rem] text-white shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/20 blur-3xl rounded-full"></div>
                    <BookOpen size={32} className="text-blue-400 mb-6" />
                    <h4 className="text-2xl font-black italic uppercase tracking-tighter mb-2 leading-none">Buku Besar</h4>
                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">PILIH REKENING AKUN</p>
                    <div className="space-y-2 mt-8 max-h-96 overflow-y-auto custom-scrollbar">
                       {financialAccounts.map(acc => (
                         <button 
                           key={acc.id} 
                           onClick={() => setLedgerAccount(acc.name)}
                           className={`w-full p-4 rounded-2xl text-[10px] font-black text-left uppercase transition-all flex justify-between items-center ${ledgerAccount === acc.name ? 'bg-blue-600 text-white shadow-xl' : 'bg-white/5 text-slate-400 hover:bg-white/10'}`}
                         >
                            {acc.name}
                            {ledgerAccount === acc.name && <ChevronRight size={14} />}
                         </button>
                       ))}
                    </div>
                 </div>
              </div>

              <div className="lg:col-span-3 bg-white rounded-[3rem] shadow-xl border border-slate-100 overflow-hidden flex flex-col">
                 <div className="p-10 border-b flex justify-between items-center bg-slate-50/30">
                    <div>
                       <h4 className="text-xl font-black text-slate-800 uppercase italic leading-none">{ledgerAccount} <span className="text-slate-400">LEDGER</span></h4>
                       <p className="text-[10px] font-black text-slate-400 mt-2 uppercase tracking-widest">Mutasi Bulan {MONTHS[selectedMonth]} {selectedYear}</p>
                    </div>
                    <div className="text-right">
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">SALDO SAAT INI</p>
                       <p className="text-2xl font-black text-slate-900 tracking-tighter">{formatCurrency(summary?.accountBalances[ledgerAccount] || 0)}</p>
                    </div>
                 </div>
                 <div className="overflow-x-auto flex-1">
                    <table className="w-full text-left">
                       <thead>
                          <tr className="bg-slate-50/50 text-slate-400 text-[9px] font-black uppercase tracking-[0.2em] border-b">
                             <th className="px-10 py-5">TGL</th>
                             <th className="px-10 py-5">KETERANGAN</th>
                             <th className="px-10 py-5 text-right">DEBIT (+)</th>
                             <th className="px-10 py-5 text-right">KREDIT (-)</th>
                          </tr>
                       </thead>
                       <tbody className="divide-y divide-slate-50">
                          {ledgerEntries.map((entry, idx) => (
                            <tr key={entry.id} className="hover:bg-slate-50/50 transition-colors">
                               <td className="px-10 py-5 text-[9px] font-black text-slate-400">{new Date(entry.date).toLocaleDateString('id-ID')}</td>
                               <td className="px-10 py-5 text-xs font-bold text-slate-700">{entry.description}</td>
                               <td className="px-10 py-5 text-right font-black text-emerald-600 text-sm">
                                  {entry.type === TransactionType.IN ? formatCurrency(entry.amount) : '-'}
                               </td>
                               <td className="px-10 py-5 text-right font-black text-rose-600 text-sm">
                                  {entry.type === TransactionType.OUT ? formatCurrency(entry.amount) : '-'}
                               </td>
                            </tr>
                          ))}
                          {ledgerEntries.length === 0 && (
                            <tr>
                               <td colSpan={4} className="px-10 py-20 text-center text-slate-400 text-xs font-black uppercase tracking-widest">TIDAK ADA MUTASI BULAN INI</td>
                            </tr>
                          )}
                       </tbody>
                    </table>
                 </div>
              </div>
           </div>
        </div>
      )}

      {activeTab === 'LAPORAN' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in zoom-in duration-500">
           <div className="bg-white p-12 rounded-[3.5rem] shadow-xl border border-slate-100 space-y-10">
              <div className="flex justify-between items-center">
                 <div className="flex items-center">
                    <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mr-5 shadow-sm"><PieChart size={24} /></div>
                    <h4 className="text-2xl font-black text-slate-800 italic uppercase leading-none">Laba Rugi <br/><span className="text-[10px] font-black text-slate-400 tracking-[0.3em] not-italic">PERIODE {MONTHS[selectedMonth]} {selectedYear}</span></h4>
                 </div>
              </div>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={[
                    { name: 'Pemasukan', amount: summary?.monthStats.income || 0 },
                    { name: 'Pengeluaran', amount: summary?.monthStats.expense || 0 },
                  ]} margin={{top: 20, right: 30, left: 20, bottom: 5}}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 9, fontWeight: 900, fill: '#94a3b8'}} />
                    <YAxis axisLine={false} tickLine={false} tick={{fontSize: 9, fontWeight: 900, fill: '#94a3b8'}} />
                    <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '24px', border: 'none', boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.15)', fontWeight: 'bold'}} />
                    <Bar dataKey="amount" radius={[15, 15, 0, 0]} barSize={80}>
                      <Cell fill="#10b981" />
                      <Cell fill="#f43f5e" />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-2 gap-6">
                 <div className="bg-emerald-50/50 p-8 rounded-[2.5rem] border border-emerald-100 shadow-sm">
                    <p className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.25em] mb-2">INCOME</p>
                    <h5 className="text-2xl font-black text-emerald-800 tracking-tighter">{formatCurrency(summary?.monthStats.income || 0)}</h5>
                 </div>
                 <div className="bg-rose-50/50 p-8 rounded-[2.5rem] border border-rose-100 shadow-sm">
                    <p className="text-[10px] font-black text-rose-600 uppercase tracking-[0.25em] mb-2">EXPENSE</p>
                    <h5 className="text-2xl font-black text-rose-800 tracking-tighter">{formatCurrency(summary?.monthStats.expense || 0)}</h5>
                 </div>
              </div>
           </div>

           <div className="bg-slate-900 p-12 rounded-[3.5rem] shadow-2xl text-white space-y-12 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-48 h-48 bg-blue-600/10 blur-3xl rounded-full -mr-24 -mt-24"></div>
              <div className="flex items-center">
                 <div className="w-12 h-12 bg-blue-500 text-white rounded-2xl flex items-center justify-center mr-5 shadow-xl shadow-blue-500/20"><FileSpreadsheet size={24} /></div>
                 <h4 className="text-2xl font-black italic uppercase leading-none">Neraca & Aset <br/><span className="text-[10px] font-black text-slate-500 tracking-[0.3em] not-italic">REAL-TIME POSITIONS</span></h4>
              </div>
              <div className="space-y-4 max-h-[500px] overflow-y-auto custom-scrollbar pr-2">
                  {financialAccounts.map(acc => (
                    <div key={acc.id} className="flex justify-between items-center p-5 bg-white/5 border border-white/5 rounded-[1.5rem] hover:bg-white/10 transition group cursor-default">
                      <div className="flex items-center">
                        <div className="w-2 h-2 rounded-full bg-blue-500 mr-4 group-hover:scale-150 transition"></div>
                        <span className="text-xs font-black uppercase text-slate-400">{acc.name}</span>
                      </div>
                      <span className="text-sm font-black tracking-tight">{formatCurrency(summary?.accountBalances[acc.name] || 0)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between items-center p-8 bg-blue-600 rounded-[2.5rem] mt-10 shadow-2xl shadow-blue-500/30 border-2 border-white/10 sticky bottom-0">
                     <div>
                        <span className="text-[10px] font-black uppercase tracking-[0.4em] text-blue-200">TOTAL ASSETS</span>
                        <h5 className="text-3xl font-black tracking-tighter mt-1">{formatCurrency(summary?.totalAssets || 0)}</h5>
                     </div>
                     <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center"><TrendingUp size={32} /></div>
                  </div>
              </div>
           </div>
        </div>
      )}

      {/* CONTENT: MANAJEMEN KATEGORI */}
      {activeTab === 'KATEGORI' && (
          <div className="space-y-6 animate-in zoom-in duration-500">
             <div className="flex justify-between items-center bg-blue-50/50 p-4 rounded-[2rem] border border-blue-100">
                <div className="flex items-center gap-3 px-2">
                    <div className="p-2 bg-blue-100 text-blue-600 rounded-lg"><FolderTree size={20}/></div>
                    <div>
                        <h4 className="text-sm font-black text-slate-800 uppercase italic">Structure Management</h4>
                        <p className="text-[9px] font-bold text-slate-400">ATUR HIERARKI KATEGORI PEMASUKAN & PENGELUARAN</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <button onClick={handleDownloadTemplate} className="px-4 py-3 bg-white text-slate-500 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition border border-slate-200 shadow-sm flex items-center gap-2">
                        <FileSpreadsheet size={16} className="text-slate-400" />
                        Download Template
                    </button>
                    <label className="flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest cursor-pointer hover:bg-slate-800 transition shadow-xl hover:shadow-2xl hover:-translate-y-1 transform">
                        <FileSpreadsheet size={16} className="text-emerald-400" />
                        Import Excel
                        <input type="file" accept=".xlsx, .xls, .csv" className="hidden" onChange={handleImportCategory} />
                    </label>
                </div>
             </div>

             <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
             {/* Income Categories */}
             <div className="bg-white p-10 rounded-[3rem] shadow-xl border border-slate-100 flex flex-col h-full">
                <div className="flex justify-between items-center mb-8 pb-6 border-b border-slate-100">
                   <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center"><ArrowDown size={20} /></div>
                      <div>
                          <h4 className="text-xl font-black text-slate-800 uppercase italic">Kategori Pemasukan</h4>
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">INCOME STREAMS</p>
                      </div>
                   </div>
                   <button onClick={() => openAddCategory(TransactionType.IN)} className="p-3 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-500 hover:text-white transition"><Plus size={16} /></button>
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3">
                   {groupedCategories.IN.length === 0 && <p className="text-center text-slate-400 text-xs italic py-10">Belum ada kategori</p>}
                   {groupedCategories.IN.map(c => (
                       <div key={c.id} className="space-y-2">
                           <div className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl group hover:bg-white hover:shadow-lg transition border border-slate-100">
                               <span className="text-xs font-black uppercase text-slate-700">{c.name}</span>
                               <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition">
                                   <button onClick={() => openAddCategory(TransactionType.IN, c.id)} className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg" title="Tambah Sub"><Plus size={14}/></button>
                                   <button onClick={() => handleDeleteCategory(c.id, c.name)} className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg"><Trash2 size={14}/></button>
                               </div>
                           </div>
                           {/* Sub Categories */}
                           <div className="pl-6 space-y-2 border-l-2 border-slate-100 ml-4">
                               {c.children?.map(child => (
                                   <div key={child.id} className="flex justify-between items-center p-3 bg-white border border-slate-100 rounded-xl">
                                      <span className="text-[10px] font-bold text-slate-500">{child.name}</span>
                                      <button onClick={() => handleDeleteCategory(child.id, child.name)} className="p-1.5 text-rose-400 hover:bg-rose-50 rounded-lg"><Trash2 size={12}/></button>
                                   </div>
                               ))}
                           </div>
                       </div>
                   ))}
                </div>
             </div>

             {/* Expense Categories */}
             <div className="bg-white p-10 rounded-[3rem] shadow-xl border border-slate-100 flex flex-col h-full">
                <div className="flex justify-between items-center mb-8 pb-6 border-b border-slate-100">
                   <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-rose-50 text-rose-600 rounded-xl flex items-center justify-center"><ArrowUp size={20} /></div>
                      <div>
                          <h4 className="text-xl font-black text-slate-800 uppercase italic">Kategori Pengeluaran</h4>
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">EXPENSE POSTS</p>
                      </div>
                   </div>
                   <button onClick={() => openAddCategory(TransactionType.OUT)} className="p-3 bg-rose-50 text-rose-600 rounded-xl hover:bg-rose-500 hover:text-white transition"><Plus size={16} /></button>
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3">
                   {groupedCategories.OUT.length === 0 && <p className="text-center text-slate-400 text-xs italic py-10">Belum ada kategori</p>}
                   {groupedCategories.OUT.map(c => (
                       <div key={c.id} className="space-y-2">
                           <div className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl group hover:bg-white hover:shadow-lg transition border border-slate-100">
                               <span className="text-xs font-black uppercase text-slate-700">{c.name}</span>
                               <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition">
                                   <button onClick={() => openAddCategory(TransactionType.OUT, c.id)} className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg" title="Tambah Sub"><Plus size={14}/></button>
                                   <button onClick={() => handleDeleteCategory(c.id, c.name)} className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg"><Trash2 size={14}/></button>
                               </div>
                           </div>
                           {/* Sub Categories */}
                           <div className="pl-6 space-y-2 border-l-2 border-slate-100 ml-4">
                               {c.children?.map(child => (
                                   <div key={child.id} className="flex justify-between items-center p-3 bg-white border border-slate-100 rounded-xl">
                                      <span className="text-[10px] font-bold text-slate-500">{child.name}</span>
                                      <button onClick={() => handleDeleteCategory(child.id, child.name)} className="p-1.5 text-rose-400 hover:bg-rose-50 rounded-lg"><Trash2 size={12}/></button>
                                   </div>
                               ))}
                           </div>
                       </div>
                   ))}
                </div>
             </div>
             </div>
          </div>
      )}

      {activeTab === 'KBPOS' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in zoom-in duration-500">
             <div className="md:col-span-2 bg-gradient-to-r from-indigo-900 to-slate-900 p-10 rounded-[3rem] text-white shadow-2xl flex justify-between items-center relative overflow-hidden">
                <div className="relative z-10">
                   <h4 className="text-3xl font-black italic uppercase">Manajemen KB Pos (Unit Bisnis)</h4>
                   <p className="text-xs font-black text-indigo-300 uppercase tracking-widest mt-2 max-w-xl">PISAHKAN ALIRAN KAS UNTUK SETIAP USAHA ANDA DALAM SATU DASHBOARD.</p>
                </div>
                <button onClick={() => handleOpenBusinessModal()} className="relative z-10 px-8 py-4 bg-white text-indigo-900 rounded-2xl font-black uppercase tracking-widest hover:bg-indigo-50 transition shadow-xl flex items-center gap-2">
                    <Plus size={18} /> Tambah Unit Baru
                </button>
             </div>

             <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {(businessUnits || []).length === 0 && <p className="text-center text-slate-400 col-span-full py-20 italic">Belum ada Unit Bisnis / KB Pos</p>}
                {(businessUnits || []).map(unit => (
                    <div key={unit.id} className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-xl transition group relative overflow-hidden">
                        <div className="flex justify-between items-start mb-6">
                            <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center">
                                <Building2 size={24} />
                            </div>
                            <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition">
                                <button onClick={() => handleOpenBusinessModal(unit)} className="p-2 bg-amber-50 text-amber-500 rounded-xl hover:bg-amber-100"><Edit size={16} /></button>
                                <button onClick={() => handleDeleteBusinessUnit(unit.id, unit.name)} className="p-2 bg-rose-50 text-rose-500 rounded-xl hover:bg-rose-100"><Trash2 size={16} /></button>
                            </div>
                        </div>
                        <h5 className="text-xl font-black text-slate-800 uppercase italic mb-2">{unit.name}</h5>
                        <p className="text-xs font-bold text-slate-400 line-clamp-2">{unit.description || 'Tidak ada deskripsi'}</p>
                        
                        <div className="mt-6 pt-6 border-t border-slate-50 flex justify-between items-center">
                            <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${unit.isActive ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                                {unit.isActive ? 'AKTIF' : 'NON-AKTIF'}
                            </span>
                            <span className="text-[9px] font-black text-indigo-300 uppercase tracking-widest">ID: {unit.id.substr(0, 6)}</span>
                        </div>
                    </div>
                ))}
             </div>
          </div>
      )}

      {/* Modal: Form Business Unit */}
      {showBusinessModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/90 backdrop-blur-md p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-[3.5rem] w-full max-w-md p-10 shadow-2xl border border-white/20 animate-in zoom-in duration-300">
               <div className="flex justify-between items-center mb-8">
                 <div>
                    <h3 className="text-2xl font-black text-slate-800 leading-tight italic uppercase tracking-tighter">{businessFormData.id ? 'Edit Unit' : 'Tambah Unit'}</h3>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">KELOMPOK BISNIS / POS</p>
                 </div>
                 <button onClick={() => setShowBusinessModal(false)} className="p-4 bg-slate-100 rounded-2xl text-slate-400 hover:text-rose-500 transition">✕</button>
               </div>
               
               <div className="space-y-6">
                   <div className="space-y-3">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">NAMA UNIT / IDENTIFIER</label>
                      <input 
                        className="w-full p-5 bg-slate-50 border-2 border-transparent rounded-[1.5rem] text-xs font-bold outline-none focus:border-indigo-600 focus:bg-white transition shadow-sm"
                        placeholder="Contoh: Toko Cabang A, Freelance..."
                        value={businessFormData.name}
                        onChange={e => setBusinessFormData({...businessFormData, name: e.target.value})}
                        autoFocus
                      />
                   </div>

                   <div className="space-y-3">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">DESKRIPSI (OPSIONAL)</label>
                      <input 
                        className="w-full p-5 bg-slate-50 border-2 border-transparent rounded-[1.5rem] text-xs font-bold outline-none focus:border-indigo-600 focus:bg-white transition shadow-sm"
                        placeholder="Keterangan singkat..."
                        value={businessFormData.description}
                        onChange={e => setBusinessFormData({...businessFormData, description: e.target.value})}
                      />
                   </div>
                   
                   <button onClick={handleSaveBusinessUnit} className="w-full py-5 bg-indigo-900 text-white rounded-[2rem] font-black uppercase tracking-[0.2em] hover:bg-indigo-600 transition text-[10px] shadow-xl mt-4">
                        Simpan Unit Bisnis
                   </button>
               </div>
            </div>
          </div>
      )}

      {/* Modal: Form Transaction - UPDATED WITH DYNAMIC CATEGORIES */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/90 backdrop-blur-md p-4 animate-in fade-in duration-200">
           <div className="bg-white rounded-[3.5rem] w-full max-w-2xl p-12 shadow-2xl border border-white/20 animate-in zoom-in duration-300 overflow-y-auto max-h-[90vh]">
             <div className="flex justify-between items-center mb-10">
               <div>
                  <h3 className="text-3xl font-black text-slate-800 leading-tight italic uppercase tracking-tighter">{isEditing ? 'Edit Transaksi' : 'Input Transaksi'}</h3>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">{formData.type === TransactionType.IN ? 'DANA MASUK (IN)' : 'DANA KELUAR (OUT)'}</p>
               </div>
               <button onClick={() => setShowAdd(false)} className="p-4 bg-slate-100 rounded-2xl text-slate-400 hover:text-rose-500 transition">✕</button>
             </div>
             
             <div className="space-y-8">
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
                 <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">PILIH REKENING AKUN</label>
                    <select 
                      className="w-full p-5 bg-slate-50 border-2 border-transparent rounded-[1.5rem] text-xs font-black uppercase tracking-widest outline-none focus:border-blue-600 focus:bg-white transition shadow-sm"
                      value={formData.account}
                      onChange={e => setFormData({...formData, account: e.target.value})}
                    >
                      {financialAccounts.map(a => <option key={a.id} value={a.name}>{a.name} ({a.bankName})</option>)}
                    </select>
                 </div>
                 <div className="space-y-3">
                     <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">ALOKASI UNIT (KB POS)</label>
                     <select 
                       className="w-full p-5 bg-indigo-50 border-2 border-transparent rounded-[1.5rem] text-xs font-black uppercase tracking-widest outline-none focus:border-indigo-500 focus:bg-white transition shadow-sm text-indigo-900"
                       value={formData.businessUnitId}
                       onChange={e => setFormData({...formData, businessUnitId: e.target.value})}
                     >
                       <option value="">-- ILUSTRASI UMUM / SHARED --</option>
                       {businessUnits.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                     </select>
                 </div>
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
                                setFormData({...formData, category: e.target.value}); // Allow custom input too? Or strictly valid categories?
                                setShowCategoryDropdown(true);
                             }}
                             onFocus={() => setShowCategoryDropdown(true)}
                           />
                        </div>
                        
                        {/* Recommendations List */}
                        {showCategoryDropdown && (categorySearch.length > 0 || true) && (
                            <div className="absolute z-10 mt-2 w-full bg-white rounded-[1.5rem] shadow-2xl border border-slate-100 max-h-60 overflow-y-auto custom-scrollbar p-2">
                                {(() => {
                                    // Flatten available categories based on Type (IN/OUT)
                                    const availableCats = formData.type === TransactionType.IN ? groupedCategories.IN : groupedCategories.OUT;
                                    let allOptions: TransactionCategory[] = [];
                                    
                                    availableCats.forEach(c => {
                                        // Include Check: Parent match?
                                        if (c.name.toLowerCase().includes(categorySearch.toLowerCase())) {
                                            allOptions.push(c);
                                        }
                                        if (c.children) {
                                            c.children.forEach(child => {
                                                if (child.name.toLowerCase().includes(categorySearch.toLowerCase())) {
                                                    allOptions.push(child);
                                                }
                                            });
                                        }
                                    });

                                    // Deduplicate by ID
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
                                          
                                          {/* Option to create new if no exact match */}
                                          {categorySearch && !exactMatch && (
                                              <button 
                                                onClick={() => {
                                                    // Just set search, creation happens on Submit
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
                        {/* Overlay to close dropdown when clicking outside */}
                        {showCategoryDropdown && (
                            <div className="fixed inset-0 z-0" onClick={() => setShowCategoryDropdown(false)} style={{ display: 'none' }}></div> 
                            // Using fixed inset might break modal layout logic since modal is also fixed. 
                            // Better to use onBlur with delay or just click handler.
                            // Simple solution: Click backdrop handled above? No. 
                            // Let's rely on selection closing it.
                        )}
                    </div>
                 </div>
               </div>

               <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">DESKRIPSI / CATATAN TRANSAKSI</label>
                  <input 
                    className="w-full p-5 bg-slate-50 border-2 border-transparent rounded-[1.5rem] text-xs font-bold outline-none focus:border-blue-600 focus:bg-white transition shadow-sm"
                    placeholder="Contoh: Pembayaran Pelunasan Project X..."
                    value={formData.description}
                    onChange={e => setFormData({...formData, description: e.target.value})}
                  />
               </div>

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

               <div className="flex gap-6 pt-10 border-t border-slate-50">
                 <button onClick={() => setShowAdd(false)} className="flex-1 py-5 text-slate-400 font-black uppercase tracking-widest hover:bg-slate-50 rounded-[1.5rem] transition text-[10px]">BATAL</button>
                 <button onClick={handleSubmit} className="flex-1 py-5 bg-slate-900 text-white rounded-[2rem] font-black uppercase tracking-[0.2em] hover:bg-blue-600 transition text-[10px] shadow-2xl shadow-slate-200">
                    {isEditing ? 'UPDATE TRANSAKSI' : 'SIMPAN TRANSAKSI'}
                 </button>
               </div>
             </div>
           </div>
        </div>
      )}

      {/* Modal: Form Account */}
      {showAccountModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/90 backdrop-blur-md p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-[3.5rem] w-full max-w-lg p-12 shadow-2xl border border-white/20 animate-in zoom-in duration-300">
               <div className="flex justify-between items-center mb-10">
                 <div>
                    <h3 className="text-2xl font-black text-slate-800 leading-tight italic uppercase tracking-tighter">{isEditingAccount ? 'Edit Rekening' : 'Tambah Rekening'}</h3>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">{isEditingAccount ? 'PERBARUI DATA' : 'BUAT BARU'}</p>
                 </div>
                 <button onClick={() => setShowAccountModal(false)} className="p-4 bg-slate-100 rounded-2xl text-slate-400 hover:text-rose-500 transition">✕</button>
               </div>

               <div className="space-y-6">
                   <div className="space-y-3">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">NAMA IDENTIFIER AKUN (ALIAS)</label>
                      <input 
                        className="w-full p-5 bg-slate-50 border-2 border-transparent rounded-[1.5rem] text-xs font-bold outline-none focus:border-blue-600 focus:bg-white transition shadow-sm"
                        placeholder="Contoh: Mandiri Utama..."
                        value={accountFormData.name}
                        onChange={e => setAccountFormData({...accountFormData, name: e.target.value})}
                      />
                   </div>

                   <div className="space-y-3">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">NAMA BANK</label>
                      <input 
                        className="w-full p-5 bg-slate-50 border-2 border-transparent rounded-[1.5rem] text-xs font-bold outline-none focus:border-blue-600 focus:bg-white transition shadow-sm"
                        placeholder="Contoh: Bank BCA, Bank Mandiri..."
                        value={accountFormData.bankName}
                        onChange={e => setAccountFormData({...accountFormData, bankName: e.target.value})}
                      />
                   </div>

                   <div className="space-y-3">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">NOMOR REKENING (OPSIONAL)</label>
                      <div className="relative">
                          <CreditCard size={16} className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300" />
                          <input 
                            className="w-full pl-14 p-5 bg-slate-50 border-2 border-transparent rounded-[1.5rem] text-xs font-bold outline-none focus:border-blue-600 focus:bg-white transition shadow-sm"
                            placeholder="0000-0000-0000"
                            value={accountFormData.accountNumber}
                            onChange={e => setAccountFormData({...accountFormData, accountNumber: e.target.value})}
                          />
                      </div>
                   </div>

                   <div className="space-y-3">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">DESKRIPSI SINGKAT</label>
                      <input 
                        className="w-full p-5 bg-slate-50 border-2 border-transparent rounded-[1.5rem] text-xs font-bold outline-none focus:border-blue-600 focus:bg-white transition shadow-sm"
                        placeholder="Contoh: Rekening Operasional Harian"
                        value={accountFormData.description}
                        onChange={e => setAccountFormData({...accountFormData, description: e.target.value})}
                      />
                   </div>

                   <div className="flex gap-6 pt-8 border-t border-slate-50 mt-4">
                        {isEditingAccount && onDeleteAccount && (
                             <button onClick={handleDeleteAccount} className="p-5 bg-rose-50 text-rose-500 hover:bg-rose-500 hover:text-white rounded-[2rem] transition shadow-sm">
                                <Trash2 size={20} />
                             </button>
                        )}
                        <button onClick={handleSubmitAccount} className="flex-1 py-5 bg-slate-900 text-white rounded-[2rem] font-black uppercase tracking-[0.2em] hover:bg-blue-600 transition text-[10px] shadow-2xl shadow-slate-200">
                             Simpan Data
                        </button>
                   </div>
               </div>
            </div>
          </div>
      )}

      {/* Modal: Form Business Unit */}
      {showBusinessModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/90 backdrop-blur-md p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-[3.5rem] w-full max-w-md p-10 shadow-2xl border border-white/20 animate-in zoom-in duration-300">
               <div className="flex justify-between items-center mb-8">
                 <div>
                    <h3 className="text-2xl font-black text-slate-800 leading-tight italic uppercase tracking-tighter">{businessFormData.id ? 'Edit Unit' : 'Tambah Unit'}</h3>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">KELOMPOK BISNIS / POS</p>
                 </div>
                 <button onClick={() => setShowBusinessModal(false)} className="p-4 bg-slate-100 rounded-2xl text-slate-400 hover:text-rose-500 transition">✕</button>
               </div>
               
               <div className="space-y-6">
                   <div className="space-y-3">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">NAMA UNIT / IDENTIFIER</label>
                      <input 
                        className="w-full p-5 bg-slate-50 border-2 border-transparent rounded-[1.5rem] text-xs font-bold outline-none focus:border-indigo-600 focus:bg-white transition shadow-sm"
                        placeholder="Contoh: Toko Cabang A, Freelance..."
                        value={businessFormData.name}
                        onChange={e => setBusinessFormData({...businessFormData, name: e.target.value})}
                        autoFocus
                      />
                   </div>

                   <div className="space-y-3">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">DESKRIPSI (OPSIONAL)</label>
                      <input 
                        className="w-full p-5 bg-slate-50 border-2 border-transparent rounded-[1.5rem] text-xs font-bold outline-none focus:border-indigo-600 focus:bg-white transition shadow-sm"
                        placeholder="Keterangan singkat..."
                        value={businessFormData.description}
                        onChange={e => setBusinessFormData({...businessFormData, description: e.target.value})}
                      />
                   </div>
                   
                   <button onClick={handleSaveBusinessUnit} className="w-full py-5 bg-indigo-900 text-white rounded-[2rem] font-black uppercase tracking-[0.2em] hover:bg-indigo-600 transition text-[10px] shadow-xl mt-4">
                        Simpan Unit Bisnis
                   </button>
               </div>
            </div>
          </div>
      )}

      {/* Modal: Form Category */}
      {showCategoryModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/90 backdrop-blur-md p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-[3.5rem] w-full max-w-md p-10 shadow-2xl border border-white/20 animate-in zoom-in duration-300">
               <div className="flex justify-between items-center mb-8">
                 <div>
                    <h3 className="text-2xl font-black text-slate-800 leading-tight italic uppercase tracking-tighter">Tambah Kategori</h3>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">
                        {categoryFormData.parentId ? 'SUB CATEGORY' : 'MAIN CATEGORY'} - {categoryFormData.type === TransactionType.IN ? 'INCOME' : 'EXPENSE'}
                    </p>
                 </div>
                 <button onClick={() => setShowCategoryModal(false)} className="p-4 bg-slate-100 rounded-2xl text-slate-400 hover:text-rose-500 transition">✕</button>
               </div>
               
               <div className="space-y-6">
                   <div className="space-y-3">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">NAMA KATEGORI</label>
                      <input 
                        className="w-full p-5 bg-slate-50 border-2 border-transparent rounded-[1.5rem] text-xs font-bold outline-none focus:border-blue-600 focus:bg-white transition shadow-sm"
                        placeholder="Contoh: Listrik, Gaji, Bonus..."
                        value={categoryFormData.name}
                        onChange={e => setCategoryFormData({...categoryFormData, name: e.target.value})}
                        autoFocus
                      />
                   </div>
                   
                   <button onClick={handleAddCategory} className="w-full py-5 bg-slate-900 text-white rounded-[2rem] font-black uppercase tracking-[0.2em] hover:bg-blue-600 transition text-[10px] shadow-xl mt-4">
                        Simpan Kategori
                   </button>
               </div>
            </div>
          </div>
      )}

      {/* Image Preview Modal */}
      {previewImage && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/95 backdrop-blur-xl p-8 animate-in fade-in duration-200" onClick={() => setPreviewImage(null)}>
           <div className="max-w-4xl w-full max-h-full flex flex-col items-center">
              <img src={previewImage} className="max-w-full max-h-[85vh] object-contain rounded-[3rem] shadow-2xl border-8 border-white/10" alt="Bukti Pembayaran" />
              <button onClick={() => setPreviewImage(null)} className="mt-8 px-12 py-4 bg-white text-slate-900 rounded-[1.5rem] font-black uppercase tracking-widest shadow-2xl hover:bg-blue-600 hover:text-white transition">TUTUP PREVIEW</button>
           </div>
        </div>
      )}
    </div>
  );
};

export default FinanceModule;
