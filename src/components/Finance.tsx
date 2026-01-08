
import React, { useState, useEffect, useMemo } from 'react';
import { Transaction, TransactionType, FinancialAccountDef, TransactionCategory, BusinessUnit, CompanyProfile } from '../types';
import { formatCurrency } from '../utils';
import { Wallet, Calendar, RefreshCw, Plus, Landmark, Edit, ArrowRight, Download, FileText, FileSpreadsheet } from 'lucide-react';
import { useToast } from './Toast';
import { generateFinancePDF } from '../utils/pdfGenerator';
import { generateFinanceExcel } from '../utils/excelGenerator';

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
  transactions: Transaction[]; // Fallback
  financialAccounts: FinancialAccountDef[];
  categories: TransactionCategory[];
  companyProfile: CompanyProfile; // NEW: For Report Header
  
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
  financialAccounts, 
  categories,
  companyProfile,
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
  const [showExportMenu, setShowExportMenu] = useState(false);
  
  // --- FILTERS (DATE RANGE) ---
  const [filterStartDate, setFilterStartDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]; // Start of Month
  });
  const [filterEndDate, setFilterEndDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]; // End of Month
  });
  
  const [filterAccount, setFilterAccount] = useState<string>('ALL'); // For "MUTASI" Tab
  const [filterBusinessUnit, setFilterBusinessUnit] = useState<string>('ALL');
  
  // Data State
  const [localTransactions, setLocalTransactions] = useState<Transaction[]>([]);
  const [summary, setSummary] = useState<{
    accountBalances: Record<string, number>;
    totalAssets: number;
    monthStats: { income: number; expense: number };
  } | null>(null);

  // --- LEDGER SPECIFIC STATE ---
  const [ledgerAccount, setLedgerAccount] = useState<string>('');
  const [ledgerData, setLedgerData] = useState<{ transactions: Transaction[], openingBalance: number }>({ transactions: [], openingBalance: 0 });
  
  // Initialize Ledger Account
  useEffect(() => {
      if (!ledgerAccount && financialAccounts.length > 0) {
          setLedgerAccount(financialAccounts[0].name);
      }
  }, [financialAccounts, ledgerAccount]);


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

  // --- DATA FETCHING (MAIN) ---
  const fetchData = async () => {
    setIsLoading(true);
    const token = typeof window !== 'undefined' ? localStorage.getItem('sdm_erp_auth_token') : null;
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    try {
      // 1. Fetch Summary
      let sumUrl = '/api/finance/summary';
      if (filterBusinessUnit && filterBusinessUnit !== 'ALL') sumUrl += `?businessUnitId=${filterBusinessUnit}`;
      
      const resSum = await fetch(sumUrl, { headers });
      if (resSum.ok) setSummary(await resSum.json());

      // 2. Fetch Transactions (By Date Range)
      let transUrl = `/api/transactions?startDate=${filterStartDate}&endDate=${filterEndDate}&limit=2000`;
      const resTrans = await fetch(transUrl, { headers });
      if (resTrans.ok) {
        setLocalTransactions(await resTrans.json());
      }
    } catch (e) {
      console.error(e);
      toast.error('Gagal memuat data keuangan');
    } finally {
      setIsLoading(false);
    }
  };

  // --- DATA FETCHING (LEDGER ONLY) ---
  const fetchLedger = async () => {
      if (!ledgerAccount) return;
      const token = typeof window !== 'undefined' ? localStorage.getItem('sdm_erp_auth_token') : null;
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      try {
          setIsLoading(true);
          let url = `/api/finance/ledger?startDate=${filterStartDate}&endDate=${filterEndDate}&accountName=${encodeURIComponent(ledgerAccount)}`;
          if (filterBusinessUnit && filterBusinessUnit !== 'ALL') url += `&businessUnitId=${filterBusinessUnit}`;
          
          const res = await fetch(url, { headers });
          if (res.ok) {
              setLedgerData(await res.json());
          }
      } catch (e) {
          toast.error("Gagal memuat buku besar");
      } finally {
          setIsLoading(false);
      }
  }

  // --- EFFECTS ---
  
  // 1. Main Data (Mutasi & Summary) triggers on Filter Change
  useEffect(() => {
      fetchData();
  }, [filterStartDate, filterEndDate, filterBusinessUnit]);

  // 2. Ledger Data triggers when Tab is Ledger OR Ledger Account/Filters change
  useEffect(() => {
      if (activeTab === 'BUKU_BESAR') {
          fetchLedger();
      }
  }, [activeTab, ledgerAccount, filterStartDate, filterEndDate, filterBusinessUnit]);


  // --- DERIVED DATA ---
  const filteredMutasi = useMemo(() => {
    return localTransactions
      .filter(t => filterAccount === 'ALL' || t.account === filterAccount)
      .filter(t => filterBusinessUnit === 'ALL' || t.businessUnitId === filterBusinessUnit) 
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [localTransactions, filterAccount, filterBusinessUnit]);

  // Helper for Month Name Display (if needed in titles)
  const getPeriodLabel = () => {
      const s = new Date(filterStartDate);
      const e = new Date(filterEndDate);
      return `${s.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })} s/d ${e.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}`;
  };
  
  const MONTHS_LABEL = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

  // --- EXPORT HANDLER ---
  const handleExport = (type: 'pdf' | 'excel') => {
      if (activeTab === 'BUKU_BESAR') {
           // Calculate Ledger with Running Balance
           let balance = ledgerData.openingBalance;
           const rows = ledgerData.transactions.map(t => {
                if (t.type === TransactionType.IN) balance += t.amount;
                else balance -= t.amount;
                return [
                    new Date(t.date).toLocaleDateString('id-ID'),
                    t.account?.substring(0, 15) || '-', // Show Account brief
                    t.description,
                    t.type === 'IN' ? formatCurrency(t.amount) : '-',
                    t.type === 'OUT' ? formatCurrency(t.amount) : '-',
                    formatCurrency(balance)
                ];
           });
           
           const title = `BUKU BESAR - ${ledgerAccount}`;
           const columns = ['TANGGAL', 'AKUN', 'DESKRIPSI', 'DEBIT', 'KREDIT', 'SALDO'];
           
           if (type === 'pdf') {
               const summary = [
                   { label: 'Saldo Awal', value: formatCurrency(ledgerData.openingBalance) },
                   { label: 'Saldo Akhir', value: formatCurrency(balance) }
               ];
               generateFinancePDF(title, `Periode: ${getPeriodLabel()}`, companyProfile, rows, columns, summary);
           } else {
               generateFinanceExcel(title, rows, columns);
           }
           toast.success("Sedang mendownload laporan...");

      } else if (activeTab === 'MUTASI') {
           const rows = filteredMutasi.map(t => [
               new Date(t.date).toLocaleDateString('id-ID'),
               t.account,
               t.category,
               t.description,
               businessUnits.find(u => u.id === t.businessUnitId)?.name || '-',
               t.type === 'IN' ? formatCurrency(t.amount) : '-',
               t.type === 'OUT' ? formatCurrency(t.amount) : '-'
           ]);

           const title = `JURNAL TRANSAKSI`;
           const columns = ['TANGGAL', 'AKUN', 'KATEGORI', 'DESKRIPSI', 'UNIT', 'PEMASUKAN', 'PENGELUARAN'];
           
           if (type === 'pdf') {
             generateFinancePDF(title, `Periode: ${getPeriodLabel()}`, companyProfile, rows, columns);
           } else {
             generateFinanceExcel(title, rows, columns);
           }
           toast.success("Sedang mendownload laporan...");

      } else {
          toast.info("Fitur export belum tersedia untuk tab ini. Silakan ke tab Mutasi atau Buku Besar.");
      }
      setShowExportMenu(false);
  };


  // --- HANDLERS (CRUD) ---
  const handleOpenTransaction = (isEditing: boolean, t?: Transaction) => {
      const defaultData: Transaction = {
        id: '',
        date: new Date().toISOString().split('T')[0],
        amount: 0,
        type: TransactionType.IN,
        category: '',
        description: '',
        account: financialAccounts[0]?.name || '',
        businessUnitId: businessUnits[0]?.id || '',
        imageUrl: ''
      };
      setTransactionModal({ isOpen: true, isEditing, data: t || defaultData });
  };

  const handleSaveTransaction = async (data: Transaction) => {
      try {
          if (transactionModal.isEditing) {
              await onUpdateTransaction(data);
              toast.success('Transaksi diperbarui');
          } else {
              await onAddTransaction(data);
              toast.success('Transaksi disimpan');
          }
          fetchData(); // Refresh Main
          if (activeTab === 'BUKU_BESAR') fetchLedger(); // Refresh Ledger if active
      } catch(e) { toast.error("Gagal simpan"); }
  };

  const handleDeleteTransaction = async (t: Transaction) => {
      if (confirm(`Hapus transaksi: ${t.description}?`)) {
          await onDeleteTransaction(t.id, `${formatCurrency(t.amount)} - ${t.description}`);
          toast.success('Dihapus');
          fetchData();
          if (activeTab === 'BUKU_BESAR') fetchLedger();
      }
  };

  // (Other handlers simplified for brevity, assume same logic)
  const handleOpenAccount = (isEditing: boolean, acc?: FinancialAccountDef) => setAccountModal({ isOpen: true, isEditing, data: acc || { name: '', bankName: '', accountNumber: '', description: '', isActive: true } });
  const handleSaveAccount = async (data: FinancialAccountDef) => {
      if (accountModal.isEditing && onUpdateAccount) await onUpdateAccount(data);
      else if (onAddAccount) await onAddAccount(data);
      toast.success("Berhasil simpan rekening");
      fetchData();
  }
  const handleDeleteAccount = async (id: string) => { if(onDeleteAccount) await onDeleteAccount(id); }

  const handleOpenCategory = (type: TransactionType, parentId?: string|null) => setCategoryModal({isOpen: true, data: {name:'', type, parentId}});
  const handleSaveCategory = async (data: TransactionCategory) => { if(onAddCategory) await onAddCategory(data); toast.success("Kategori ditambah"); }
  const handleDeleteCategory = async (id: string, name: string) => { if(onDeleteCategory) if(confirm(`Hapus ${name}?`)) await onDeleteCategory(id); }

  const handleOpenBusiness = (u?: BusinessUnit) => setBusinessModal({isOpen: true, data: u || {name:'', description:'', isActive: true}});
  const handleSaveBusiness = async (d: BusinessUnit) => {
     if(d.id && onUpdateBusinessUnit) await onUpdateBusinessUnit(d);
     else if(onAddBusinessUnit) await onAddBusinessUnit(d);
     toast.success("Unit Bisnis disimpan");
  }
  const handleDeleteBusiness = async (id:string, name:string) => { if(onDeleteBusinessUnit && confirm(`Hapus ${name}?`)) await onDeleteBusinessUnit(id); }


  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      
      {/* --- HEADER & FILTERS --- */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 gap-6">
         <div>
            <h2 className="text-2xl font-black text-slate-800 italic uppercase">Finance Dashboard</h2>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">PERIODE: {getPeriodLabel()}</p>
         </div>
         
         <div className="flex flex-col md:flex-row items-center gap-3 bg-slate-50 p-2 rounded-[1.5rem] border border-slate-100 w-full xl:w-auto relative">
            <div className="flex items-center gap-2 px-2 w-full md:w-auto">
                <Calendar size={16} className="text-slate-400" />
                <input 
                    type="date"
                    value={filterStartDate}
                    onChange={(e) => setFilterStartDate(e.target.value)}
                    className="bg-transparent text-xs font-bold text-slate-700 outline-none p-2 w-full md:w-32 hover:bg-slate-100 rounded-lg transition"
                />
                <ArrowRight size={12} className="text-slate-300 flex-shrink-0" />
                <input 
                    type="date"
                    value={filterEndDate}
                    onChange={(e) => setFilterEndDate(e.target.value)}
                    className="bg-transparent text-xs font-bold text-slate-700 outline-none p-2 w-full md:w-32 hover:bg-slate-100 rounded-lg transition"
                />
            </div>
            
            <div className="h-8 w-px bg-slate-200 hidden md:block"></div>

             <select 
              value={filterBusinessUnit} 
              onChange={(e) => setFilterBusinessUnit(e.target.value)}
              className="bg-blue-50 text-blue-700 text-xs font-black uppercase rounded-xl border-none outline-none p-3 tracking-wide w-full md:w-auto"
            >
              <option value="ALL">SEMUA UNIT</option>
              {businessUnits.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
            
            <button onClick={() => { fetchData(); if(activeTab==='BUKU_BESAR') fetchLedger(); }} className="p-3 bg-blue-100 text-blue-600 rounded-xl hover:bg-blue-200 transition shadow-sm">
              <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
            </button>

            {/* EXPORT BUTTON */}
            <div className="relative">
                <button 
                  onClick={() => setShowExportMenu(!showExportMenu)} 
                  className="p-3 bg-slate-900 text-white rounded-xl hover:bg-slate-700 transition shadow-lg flex items-center gap-2"
                  title="Export Laporan"
                >
                    <Download size={16} />
                </button>
                {showExportMenu && (
                    <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowExportMenu(false)}></div>
                    <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-2xl shadow-xl border border-slate-100 z-20 p-2 animate-in slide-in-from-top-2">
                        <button onClick={() => handleExport('pdf')} className="w-full text-left px-4 py-3 rounded-xl hover:bg-rose-50 text-rose-600 font-bold text-xs flex items-center gap-2 transition">
                            <FileText size={16} /> Export PDF (Resmi)
                        </button>
                        <button onClick={() => handleExport('excel')} className="w-full text-left px-4 py-3 rounded-xl hover:bg-emerald-50 text-emerald-600 font-bold text-xs flex items-center gap-2 transition">
                            <FileSpreadsheet size={16} /> Export Excel (Data)
                        </button>
                    </div>
                    </>
                )}
            </div>
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
                // Also set Ledger Account for convenience if user switches tab
                if(activeTab !== 'BUKU_BESAR') setLedgerAccount(acc.name);
              }}
              className={`relative flex-shrink-0 w-64 snap-start p-6 rounded-[2.5rem] border-2 cursor-pointer transition-all duration-300 group ${isSelected ? 'bg-slate-900 border-slate-900 text-white shadow-2xl shadow-slate-200' : 'bg-white border-slate-100 hover:border-blue-200 hover:shadow-lg shadow-sm text-slate-800'}`}
            >
              <div className="flex justify-between items-start mb-4">
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${isSelected ? 'bg-white/10' : 'bg-blue-50 text-blue-600'}`}>
                  <Landmark size={20} />
                </div>
                {isSelected && <div className="text-[9px] font-black uppercase tracking-widest bg-blue-600 px-2 py-1 rounded-lg text-white">SELECTED</div>}
              </div>
              <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${isSelected ? 'text-slate-500' : 'text-slate-400'}`}>{acc.bankName} - {acc.name}</p>
              <h4 className="text-xl font-black tracking-tight leading-none">{formatCurrency(bal)}</h4>
              
              {onUpdateAccount && (
                  <button 
                     onClick={(e) => { e.stopPropagation(); handleOpenAccount(true, acc); }}
                     className="absolute top-4 right-4 p-2 bg-white/10 rounded-full hover:bg-white/20 transition opacity-0 group-hover:opacity-100"
                  >
                      <Edit size={12} className={isSelected ? 'text-white' : 'text-slate-500'} />
                  </button>
              )}
            </div>
          );
        })}
        {onAddAccount && (
            <button onClick={() => handleOpenAccount(false)} className="flex-shrink-0 w-24 snap-start p-6 rounded-[2.5rem] border-2 border-dashed border-slate-200 flex flex-col items-center justify-center gap-2 hover:bg-slate-50 hover:border-blue-300 transition text-slate-300 hover:text-blue-500">
                <Plus size={24} /><span className="text-[9px] font-black uppercase text-center">Add Akun</span>
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
            <Wallet size={14} className="mr-2 text-blue-400" /> TOTAL: <span className="ml-2">{formatCurrency(summary?.totalAssets || 0)}</span>
          </div>
          <button onClick={() => handleOpenTransaction(false)} className="bg-blue-600 text-white px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center hover:bg-blue-700 transition shadow-2xl shadow-blue-100">
            <Plus size={16} className="mr-2" /> BUAT TRANSAKSI
          </button>
        </div>
      </div>

      {/* --- CONTENT --- */}
      {activeTab === 'MUTASI' && (
          <JournalView 
             transactions={filteredMutasi}
             businessUnits={businessUnits}
             onEdit={(t) => handleOpenTransaction(true, t)}
             onDelete={handleDeleteTransaction}
          />
      )}

      {activeTab === 'BUKU_BESAR' && (
          <LedgerView 
             transactions={ledgerData.transactions}
             openingBalance={ledgerData.openingBalance}
             financialAccounts={financialAccounts}
             selectedAccount={ledgerAccount}
             onAccountChange={setLedgerAccount}
             startDate={filterStartDate}
             endDate={filterEndDate}
          />
      )}

      {activeTab === 'LAPORAN' && (
          <ReportView 
             transactions={filteredMutasi} // Uses general transaction pool (Respects Unit Filter)
             summary={summary}
             MONTHS={MONTHS_LABEL}
          />
      )}

      {activeTab === 'KATEGORI' && (
          <CategoryManager 
             categories={categories}
             onAddCategoryClick={handleOpenCategory}
             onDeleteCategory={handleDeleteCategory}
             importCategories={importCategories}
             toast={toast}
          />
      )}

      {activeTab === 'KBPOS' && (
          <BusinessUnitManager 
             businessUnits={businessUnits}
             onAddClick={() => handleOpenBusiness()}
             onEditClick={handleOpenBusiness}
             onDeleteClick={handleDeleteBusiness}
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
