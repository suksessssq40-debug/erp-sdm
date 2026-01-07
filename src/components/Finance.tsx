
import React, { useState, useEffect, useMemo } from 'react';
import { Transaction, TransactionType, FinancialAccountDef, TransactionCategory, BusinessUnit } from '../types';
import { formatCurrency } from '../utils';
import { Wallet, Calendar, RefreshCw, Plus, Landmark, Edit } from 'lucide-react';
import { useToast } from './Toast';

// Sub-components
import { TransactionModal } from './finance/TransactionModal';
import { AccountModal } from './finance/AccountModal';
import { CategoryModal } from './finance/CategoryModal';
import { BusinessUnitModal } from './finance/BusinessUnitModal';
import { JournalView } from './finance/JournalView';
import { LedgerView } from './finance/LedgerView';
import { ReportView } from './finance/ReportView';
import { CategoryManager } from './finance/CategoryManager';
import { BusinessUnitManager } from './finance/BusinessUnitManager';

interface FinanceProps {
  transactions: Transaction[]; // Fallback or Initial
  financialAccounts: FinancialAccountDef[];
  categories: TransactionCategory[];
  
  onAddTransaction: (t: Transaction) => Promise<void>;
  onUpdateTransaction: (t: Transaction) => Promise<void>;
  onDeleteTransaction: (id: string, detail: string) => Promise<void>;
  
  onAddAccount?: (acc: FinancialAccountDef) => Promise<void>;
  onUpdateAccount?: (acc: FinancialAccountDef) => Promise<void>;
  onDeleteAccount?: (id: string) => Promise<void>;

  onAddCategory?: (cat: TransactionCategory) => Promise<void>;
  onUpdateCategory?: (cat: TransactionCategory) => Promise<void>;
  onDeleteCategory?: (id: string) => Promise<void>;
  importCategories?: (cats: Partial<TransactionCategory>[]) => Promise<void>;

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
  const [isLoading, setIsLoading] = useState(false);
  
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

  // --- MODAL STATES ---
  const [transactionModal, setTransactionModal] = useState<{ isOpen: boolean; isEditing: boolean; data: Transaction | null }>({
    isOpen: false, isEditing: false, data: null
  });

  const [accountModal, setAccountModal] = useState<{ isOpen: boolean; isEditing: boolean; data: Partial<FinancialAccountDef> }>({
    isOpen: false, isEditing: false, data: {}
  });

  const [categoryModal, setCategoryModal] = useState<{ isOpen: boolean; data: Partial<TransactionCategory> }>({
    isOpen: false, data: {}
  });

  const [businessModal, setBusinessModal] = useState<{ isOpen: boolean; data: Partial<BusinessUnit> }>({
    isOpen: false, data: {}
  });

  // --- DATA FETCHING ---
  const fetchData = async () => {
    setIsLoading(true);
    const token = typeof window !== 'undefined' ? localStorage.getItem('sdm_erp_auth_token') : null;
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    try {
      // Fetch Summary (Respects Business Unit Filter)
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

      // Fetch Transactions (By Month/Year - Independent of filters initially)
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

  // --- DERIVED DATA ---
  const filteredTransactions = useMemo(() => {
    return localTransactions
      .filter(t => filterAccount === 'ALL' || t.account === filterAccount)
      .filter(t => filterBusinessUnit === 'ALL' || t.businessUnitId === filterBusinessUnit) 
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [localTransactions, filterAccount, filterBusinessUnit]);

  // Special Filter for Report: Respects BusinessUnit but IGNORES Account Filter (to match Summary Cards)
  const reportTransactions = useMemo(() => {
      return localTransactions
      .filter(t => filterBusinessUnit === 'ALL' || t.businessUnitId === filterBusinessUnit)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [localTransactions, filterBusinessUnit]);


  // --- HANDLERS: TRANSACTION ---
  const handleOpenTransaction = (isEditing: boolean, t?: Transaction) => {
      const defaultData: Transaction = {
        id: '',
        date: new Date().toISOString().split('T')[0],
        amount: 0,
        type: TransactionType.IN,
        category: '',
        description: '',
        account: financialAccounts[0]?.name || '',
        businessUnitId: businessUnits[0]?.id || '', // Default to first unit
        imageUrl: ''
      };

      setTransactionModal({
          isOpen: true,
          isEditing,
          data: t || defaultData
      });
  };

  const handleSaveTransaction = async (data: Transaction) => {
      try {
          if (transactionModal.isEditing) {
              await onUpdateTransaction(data);
              toast.success('Transaksi diperbarui');
          } else {
              await onAddTransaction(data);
              toast.success('Transaksi berhasil disimpan');
          }
          fetchData();
      } catch(e) {
          toast.error("Gagal menyimpan transaksi");
      }
  };

  const handleDeleteTransaction = async (t: Transaction) => {
      if (confirm(`Yakin ingin menghapus transaksi: ${t.description}?`)) {
          await onDeleteTransaction(t.id, `${formatCurrency(t.amount)} - ${t.description}`);
          toast.success('Transaksi dihapus');
          fetchData();
      }
  };

  // --- HANDLERS: ACCOUNT ---
  const handleOpenAccount = (isEditing: boolean, acc?: FinancialAccountDef) => {
      setAccountModal({
          isOpen: true,
          isEditing,
          data: acc || { name: '', bankName: '', accountNumber: '', description: '', isActive: true }
      });
  };

  const handleSaveAccount = async (data: FinancialAccountDef) => {
      try {
          if (accountModal.isEditing && onUpdateAccount) {
              await onUpdateAccount(data);
              toast.success("Rekening berhasil update");
          } else if (onAddAccount) {
              await onAddAccount(data);
              toast.success("Rekening berhasil dibuat");
          }
      } catch(e) {
         toast.error("Gagal simpan rekening");
      }
  };

  const handleDeleteAccount = async (id: string) => {
      try {
          if (onDeleteAccount) {
              await onDeleteAccount(id);
              toast.success("Rekening dihapus");
          }
      } catch(e) { toast.error("Gagal hapus rekening"); }
  }


  // --- HANDLERS: CATEGORY ---
  const handleOpenCategory = (type: TransactionType, parentId?: string | null) => {
    setCategoryModal({ isOpen: true, data: { name: '', type, parentId } });
  }

  const handleSaveCategory = async (data: TransactionCategory) => {
      try {
          if (onAddCategory) await onAddCategory(data);
          toast.success("Kategori ditambahkan");
      } catch(e) { toast.error("Gagal tambah kategori"); }
  }

  const handleDeleteCategoryHandler = async (id: string, name: string) => {
      if (confirm(`Hapus kategori "${name}"?`)) {
          if (onDeleteCategory) await onDeleteCategory(id);
      }
  }

  // --- HANDLERS: BUSINESS UNIT ---
  const handleOpenBusiness = (unit?: BusinessUnit) => {
      setBusinessModal({ isOpen: true, data: unit || { name: '', description: '', isActive: true } });
  }

  const handleSaveBusiness = async (data: BusinessUnit) => {
      try {
          if (data.id && onUpdateBusinessUnit) {
              await onUpdateBusinessUnit(data);
              toast.success("KB Pos diupdate");
          } else if (onAddBusinessUnit) {
              await onAddBusinessUnit(data);
              toast.success("KB Pos baru dibuat");
          }
      } catch(e) { toast.error("Gagal simpan KB Pos"); }
  }
  
  const handleDeleteBusinessHandler = async (id: string, name: string) => {
      if (confirm(`Hapus KB Pos "${name}"?`)) {
          if (onDeleteBusinessUnit) {
              await onDeleteBusinessUnit(id);
              toast.success("KB Pos dihapus");
          }
      }
  }


  const MONTHS = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      {/* --- HEADER --- */}
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

       {/* --- ACCOUNT HIGHLIGHTS --- */}
       <div className="flex overflow-x-auto pb-4 gap-4 snap-x custom-scrollbar">
        {financialAccounts.map(acc => {
          const bal = summary?.accountBalances[acc.name] || 0;
          const isSelected = filterAccount === acc.name;
          return (
            <div 
              key={acc.id} 
              onClick={() => {
                setFilterAccount(isSelected ? 'ALL' : acc.name);
                // Ledger account is handled internally by LedgerView, but we can sync?
                // The new LedgerView has its own selector.
              }}
              className={`relative flex-shrink-0 w-64 snap-start p-6 rounded-[2.5rem] border-2 cursor-pointer transition-all duration-300 group ${isSelected ? 'bg-slate-900 border-slate-900 text-white shadow-2xl shadow-slate-200' : 'bg-white border-slate-100 hover:border-blue-200 hover:shadow-lg shadow-sm text-slate-800'}`}
            >
              {onUpdateAccount && (
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleOpenAccount(true, acc); }}
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
                onClick={() => handleOpenAccount(false)}
                className="flex-shrink-0 w-24 snap-start p-6 rounded-[2.5rem] border-2 border-dashed border-slate-200 flex flex-col items-center justify-center gap-2 hover:bg-slate-50 hover:border-blue-300 transition text-slate-300 hover:text-blue-500"
            >
                <Plus size={24} />
                <span className="text-[9px] font-black uppercase text-center">Add Rekening</span>
            </button>
        )}
      </div>

       {/* --- TABS --- */}
       <div className="flex flex-col md:flex-row gap-4 justify-between items-end border-b-2 border-slate-100">
        <div className="flex space-x-2 overflow-x-auto pb-1 custom-scrollbar w-full md:w-auto">
          {['MUTASI', 'BUKU_BESAR', 'LAPORAN', 'KATEGORI', 'KBPOS'].map(tab => (
              <button 
                key={tab}
                onClick={() => setActiveTab(tab as any)} 
                className={`whitespace-nowrap pb-4 px-6 text-[11px] font-black uppercase tracking-widest transition-all ${activeTab === tab ? 'text-slate-900 border-b-4 border-slate-900' : 'text-slate-400 hover:text-slate-600'}`}
              >
                  {tab.replace('_', ' ')}
              </button>
          ))}
        </div>
        <div className="flex items-center space-x-3 mb-4 flex-shrink-0">
          <div className="bg-slate-900 text-white px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center shadow-xl shadow-slate-100 italic">
            <Wallet size={14} className="mr-2 text-blue-400" /> TOTAL ASSETS: <span className="ml-2">{formatCurrency(summary?.totalAssets || 0)}</span>
          </div>
          <button onClick={() => handleOpenTransaction(false)} className="bg-blue-600 text-white px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center hover:bg-blue-700 transition shadow-2xl shadow-blue-100">
            <Plus size={16} className="mr-2" /> ENTRY TRANSAKSI
          </button>
        </div>
      </div>

      {/* --- TAB CONTENT --- */}
      {activeTab === 'MUTASI' && (
          <JournalView 
             transactions={filteredTransactions}
             businessUnits={businessUnits}
             selectedMonth={selectedMonth}
             selectedYear={selectedYear}
             MONTHS={MONTHS}
             onEdit={(t) => handleOpenTransaction(true, t)}
             onDelete={handleDeleteTransaction}
          />
      )}

      {activeTab === 'BUKU_BESAR' && (
          <LedgerView 
             transactions={localTransactions} // Uses localTransactions (Global) + Internal Filter
             financialAccounts={financialAccounts}
             MONTHS={MONTHS}
             selectedMonth={selectedMonth}
             selectedYear={selectedYear}
             defaultAccount={financialAccounts[0]?.name}
          />
      )}

      {activeTab === 'LAPORAN' && (
          <ReportView 
             transactions={reportTransactions} // Special Filter: Respects Unit, Ignores Account
             summary={summary}
             MONTHS={MONTHS}
          />
      )}

      {activeTab === 'KATEGORI' && (
          <CategoryManager 
             categories={categories}
             onAddCategoryClick={handleOpenCategory}
             onDeleteCategory={handleDeleteCategoryHandler}
             importCategories={importCategories}
             toast={toast}
          />
      )}

      {activeTab === 'KBPOS' && (
          <BusinessUnitManager 
             businessUnits={businessUnits}
             onAddClick={() => handleOpenBusiness()}
             onEditClick={(u) => handleOpenBusiness(u)}
             onDeleteClick={handleDeleteBusinessHandler}
          />
      )}


      {/* --- MODALS --- */}
      {transactionModal.isOpen && transactionModal.data && (
          <TransactionModal 
            isOpen={transactionModal.isOpen}
            onClose={() => setTransactionModal({ ...transactionModal, isOpen: false })}
            isEditing={transactionModal.isEditing}
            initialData={transactionModal.data}
            financialAccounts={financialAccounts}
            categories={categories}
            businessUnits={businessUnits}
            onSave={handleSaveTransaction}
            onAddAccount={onAddAccount}
            onAddCategory={onAddCategory}
            uploadFile={uploadFile}
            toast={toast}
          />
      )}

      {accountModal.isOpen && (
          <AccountModal 
             isOpen={accountModal.isOpen}
             onClose={() => setAccountModal({...accountModal, isOpen: false})}
             isEditing={accountModal.isEditing}
             initialData={accountModal.data}
             onSave={handleSaveAccount}
             onDelete={handleDeleteAccount}
             toast={toast}
          />
      )}

      {categoryModal.isOpen && (
          <CategoryModal 
             isOpen={categoryModal.isOpen}
             onClose={() => setCategoryModal({...categoryModal, isOpen: false})}
             initialData={categoryModal.data}
             onSave={handleSaveCategory}
             toast={toast}
          />
      )}

      {businessModal.isOpen && (
          <BusinessUnitModal 
             isOpen={businessModal.isOpen}
             onClose={() => setBusinessModal({...businessModal, isOpen: false})}
             initialData={businessModal.data}
             onSave={handleSaveBusiness}
             toast={toast}
          />
      )}

    </div>
  );
};

export default FinanceModule;
