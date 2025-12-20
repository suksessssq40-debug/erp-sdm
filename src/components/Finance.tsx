
import React, { useState, useMemo } from 'react';
import { Transaction, TransactionType, UserRole, FinancialAccount } from '../types';
import { formatCurrency } from '../utils';
import { FINANCIAL_ACCOUNTS } from '../constants';
import { Plus, TrendingUp, TrendingDown, Landmark, PieChart, FileSpreadsheet, Wallet, Filter, Search, Image as ImageIcon, BookOpen, ChevronRight, FileText, Calendar, Trash2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, AreaChart, Area } from 'recharts';
import { useToast } from './Toast';

interface FinanceProps {
  transactions: Transaction[];
  onAddTransaction: (t: Transaction) => void;
  toast: ReturnType<typeof useToast>;
  uploadFile?: (file: File) => Promise<string>;
}

const FinanceModule: React.FC<FinanceProps> = ({ transactions, onAddTransaction, toast, uploadFile }) => {
  const [activeTab, setActiveTab] = useState<'MUTASI' | 'BUKU_BESAR' | 'LAPORAN'>('MUTASI');
  const [showAdd, setShowAdd] = useState(false);
  const [filterAccount, setFilterAccount] = useState<FinancialAccount | 'ALL'>('ALL');
  const [ledgerAccount, setLedgerAccount] = useState<FinancialAccount>(FINANCIAL_ACCOUNTS[0]);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    amount: 0,
    type: TransactionType.IN,
    category: '',
    description: '',
    account: FINANCIAL_ACCOUNTS[0] as FinancialAccount,
    imageUrl: ''
  });

  const getAccountBalance = (accName: FinancialAccount | 'ALL') => {
    return transactions
      .filter(t => accName === 'ALL' || t.account === accName)
      .reduce((acc, curr) => curr.type === TransactionType.IN ? acc + curr.amount : acc - curr.amount, 0);
  };

  const income = transactions.filter(t => t.type === TransactionType.IN).reduce((acc, curr) => acc + curr.amount, 0);
  const expense = transactions.filter(t => t.type === TransactionType.OUT).reduce((acc, curr) => acc + curr.amount, 0);
  const totalBalance = income - expense;

  const filteredTransactions = transactions
    .filter(t => filterAccount === 'ALL' || t.account === filterAccount)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Ledger calculation with running balance
  const ledgerEntries = useMemo(() => {
    const accountTransactions = transactions
      .filter(t => t.account === ledgerAccount)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    let runningBalance = 0;
    return accountTransactions.map(t => {
      if (t.type === TransactionType.IN) {
        runningBalance += t.amount;
      } else {
        runningBalance -= t.amount;
      }
      return { ...t, runningBalance };
    }).reverse(); // Display newest first in the table
  }, [transactions, ledgerAccount]);

  const handleAdd = async () => {
    if (formData.amount <= 0) {
      toast.warning("Nominal transaksi harus lebih dari 0.");
      return;
    }
    if (!formData.description.trim()) {
      toast.warning("Harap isi deskripsi transaksi.");
      return;
    }
    try {
      const t: Transaction = {
        id: Math.random().toString(36).substr(2, 9),
        date: new Date().toISOString().split('T')[0],
        ...formData
      };
      await onAddTransaction(t);
      setShowAdd(false);
      setFormData({ amount: 0, type: TransactionType.IN, category: '', description: '', account: FINANCIAL_ACCOUNTS[0], imageUrl: '' });
      toast.success(`Transaksi ${formData.type === TransactionType.IN ? 'pemasukan' : 'pengeluaran'} sebesar ${formatCurrency(formData.amount)} berhasil dicatat.`);
    } catch (err: any) {
      toast.error(err?.message || 'Gagal menambahkan transaksi. Periksa koneksi dan coba lagi.');
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
          setFormData({ ...formData, imageUrl: url });
          toast.success("Bukti berhasil diupload!");
        } catch(err) {
          toast.error("Gagal upload gambar.");
        }
      } else {
        // Fallback for offline dev or missing prop
        const reader = new FileReader();
        reader.onloadend = () => {
          setFormData({ ...formData, imageUrl: reader.result as string });
        };
        reader.readAsDataURL(file);
      }
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Account Highlights */}
      <div className="flex overflow-x-auto pb-4 gap-4 snap-x custom-scrollbar">
        {FINANCIAL_ACCOUNTS.map(acc => {
          const bal = getAccountBalance(acc);
          return (
            <div 
              key={acc} 
              onClick={() => {
                setFilterAccount(acc === filterAccount ? 'ALL' : acc);
                setLedgerAccount(acc);
              }}
              className={`flex-shrink-0 w-64 snap-start p-6 rounded-[2.5rem] border-2 cursor-pointer transition-all duration-300 ${acc === filterAccount ? 'bg-slate-900 border-slate-900 text-white shadow-2xl shadow-slate-200' : 'bg-white border-slate-100 hover:border-blue-200 hover:shadow-lg shadow-sm text-slate-800'}`}
            >
              <div className="flex justify-between items-start mb-4">
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${acc === filterAccount ? 'bg-white/10' : 'bg-blue-50 text-blue-600'}`}>
                  <Landmark size={20} />
                </div>
                {acc === filterAccount && <div className="text-[9px] font-black uppercase tracking-widest bg-blue-600 px-2 py-1 rounded-lg text-white">SELECTED</div>}
              </div>
              <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${acc === filterAccount ? 'text-slate-500' : 'text-slate-400'}`}>{acc}</p>
              <h4 className="text-xl font-black tracking-tight leading-none">{formatCurrency(bal)}</h4>
            </div>
          );
        })}
      </div>

      <div className="flex flex-col md:flex-row gap-4 justify-between items-end border-b-2 border-slate-100">
        <div className="flex space-x-2">
          <button onClick={() => setActiveTab('MUTASI')} className={`pb-4 px-6 text-[11px] font-black uppercase tracking-widest transition-all ${activeTab === 'MUTASI' ? 'text-slate-900 border-b-4 border-slate-900' : 'text-slate-400 hover:text-slate-600'}`}>MUTASI JURNAL</button>
          <button onClick={() => setActiveTab('BUKU_BESAR')} className={`pb-4 px-6 text-[11px] font-black uppercase tracking-widest transition-all ${activeTab === 'BUKU_BESAR' ? 'text-slate-900 border-b-4 border-slate-900' : 'text-slate-400 hover:text-slate-600'}`}>BUKU BESAR</button>
          <button onClick={() => setActiveTab('LAPORAN')} className={`pb-4 px-6 text-[11px] font-black uppercase tracking-widest transition-all ${activeTab === 'LAPORAN' ? 'text-slate-900 border-b-4 border-slate-900' : 'text-slate-400 hover:text-slate-600'}`}>LAPORAN KEUANGAN</button>
        </div>
        <div className="flex items-center space-x-3 mb-4">
          <div className="bg-slate-900 text-white px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center shadow-xl shadow-slate-100 italic">
            <Wallet size={14} className="mr-2 text-blue-400" /> TOTAL ASSETS: <span className="ml-2">{formatCurrency(totalBalance)}</span>
          </div>
          <button onClick={() => setShowAdd(true)} className="bg-blue-600 text-white px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center hover:bg-blue-700 transition shadow-2xl shadow-blue-100">
            <Plus size={16} className="mr-2" /> ENTRY TRANSAKSI
          </button>
        </div>
      </div>

      {activeTab === 'MUTASI' && (
        <div className="bg-white rounded-[3rem] shadow-xl border border-slate-100 overflow-hidden animate-in fade-in duration-500">
          <div className="p-10 border-b flex flex-col md:flex-row justify-between items-center gap-6 bg-slate-50/30">
            <div>
              <h4 className="text-2xl font-black text-slate-800 italic uppercase tracking-tighter">Jurnal Mutasi</h4>
              <p className="text-[10px] text-slate-400 uppercase font-black tracking-[0.3em] mt-1">LOG TRANSAKSI KRONOLOGIS SDM</p>
            </div>
            <div className="flex gap-3 w-full md:w-auto">
               <div className="relative flex-1 md:w-72">
                 <Search size={18} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300" />
                 <input className="w-full pl-12 pr-6 py-4 bg-white border-2 border-slate-50 rounded-[1.5rem] text-xs font-bold focus:border-blue-600 outline-none transition shadow-sm" placeholder="Cari keterangan / vendor..." />
               </div>
               <button onClick={() => setFilterAccount('ALL')} className="p-4 bg-white border-2 border-slate-50 rounded-[1.5rem] text-slate-400 hover:text-blue-600 transition shadow-sm">
                 <Filter size={20} />
               </button>
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
                  <th className="px-10 py-6 text-right">NOMINAL</th>
                  <th className="px-10 py-6 text-center">BUKTI</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredTransactions.map(t => (
                  <tr key={t.id} className="hover:bg-blue-50/30 transition-colors group">
                    <td className="px-10 py-7 text-[10px] font-black text-slate-400 uppercase tracking-widest">{new Date(t.date).toLocaleDateString('id-ID', {day: '2-digit', month: 'short', year: 'numeric'})}</td>
                    <td className="px-10 py-7">
                      <div className="flex items-center space-x-3">
                        <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center group-hover:bg-blue-600 transition shadow-sm">
                           <Landmark size={14} />
                        </div>
                        <span className="text-[10px] font-black text-slate-700 uppercase">{t.account}</span>
                      </div>
                    </td>
                    <td className="px-10 py-7 text-xs font-bold text-slate-600 italic">"{t.description}"</td>
                    <td className="px-10 py-7">
                      <span className="bg-white border border-slate-100 text-slate-500 px-3 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-[0.15em]">{t.category || 'GENERAL'}</span>
                    </td>
                    <td className={`px-10 py-7 text-sm font-black text-right ${t.type === TransactionType.IN ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {t.type === TransactionType.IN ? '+' : '-'}{formatCurrency(t.amount)}
                    </td>
                    <td className="px-10 py-7 text-center">
                      {t.imageUrl ? (
                        <button onClick={() => setPreviewImage(t.imageUrl!)} className="p-3 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-600 hover:text-white transition shadow-sm">
                           <ImageIcon size={14} />
                        </button>
                      ) : (
                        <span className="text-slate-200"><ImageIcon size={14} /></span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'BUKU_BESAR' && (
        <div className="space-y-6 animate-in slide-in-from-bottom-6 duration-500">
           <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              <div className="lg:col-span-1 space-y-4">
                 <div className="bg-slate-900 p-8 rounded-[3rem] text-white shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/20 blur-3xl rounded-full"></div>
                    <BookOpen size={32} className="text-blue-400 mb-6" />
                    <h4 className="text-2xl font-black italic uppercase tracking-tighter mb-2 leading-none">Buku Besar</h4>
                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">PILIH REKENING AKUN</p>
                    <div className="space-y-2 mt-8">
                       {FINANCIAL_ACCOUNTS.map(acc => (
                         <button 
                           key={acc} 
                           onClick={() => setLedgerAccount(acc)}
                           className={`w-full p-4 rounded-2xl text-[10px] font-black text-left uppercase transition-all flex justify-between items-center ${ledgerAccount === acc ? 'bg-blue-600 text-white shadow-xl' : 'bg-white/5 text-slate-400 hover:bg-white/10'}`}
                         >
                            {acc}
                            {ledgerAccount === acc && <ChevronRight size={14} />}
                         </button>
                       ))}
                    </div>
                 </div>
              </div>

              <div className="lg:col-span-3 bg-white rounded-[3rem] shadow-xl border border-slate-100 overflow-hidden flex flex-col">
                 <div className="p-10 border-b flex justify-between items-center bg-slate-50/30">
                    <div>
                       <h4 className="text-xl font-black text-slate-800 uppercase italic leading-none">{ledgerAccount} <span className="text-slate-400">LEDGER</span></h4>
                       <p className="text-[10px] font-black text-slate-400 mt-2 uppercase tracking-widest">Running Balance & Transaction History</p>
                    </div>
                    <div className="text-right">
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">SALDO AKHIR</p>
                       <p className="text-2xl font-black text-slate-900 tracking-tighter">{formatCurrency(getAccountBalance(ledgerAccount))}</p>
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
                             <th className="px-10 py-5 text-right bg-slate-50/80">BALANCE</th>
                          </tr>
                       </thead>
                       <tbody className="divide-y divide-slate-50">
                          {ledgerEntries.map((entry, idx) => (
                            <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                               <td className="px-10 py-5 text-[9px] font-black text-slate-400">{new Date(entry.date).toLocaleDateString('id-ID')}</td>
                               <td className="px-10 py-5 text-xs font-bold text-slate-700">{entry.description}</td>
                               <td className="px-10 py-5 text-right font-black text-emerald-600 text-sm">
                                  {entry.type === TransactionType.IN ? formatCurrency(entry.amount) : '-'}
                               </td>
                               <td className="px-10 py-5 text-right font-black text-rose-600 text-sm">
                                  {entry.type === TransactionType.OUT ? formatCurrency(entry.amount) : '-'}
                               </td>
                               <td className="px-10 py-5 text-right font-black text-slate-900 bg-slate-50/30 text-sm">
                                  {formatCurrency(entry.runningBalance)}
                               </td>
                            </tr>
                          ))}
                          {ledgerEntries.length === 0 && (
                            <tr>
                               <td colSpan={5} className="px-10 py-20 text-center text-slate-400 text-xs font-black uppercase tracking-widest">BELUM ADA TRANSAKSI PADA AKUN INI</td>
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
                    <h4 className="text-2xl font-black text-slate-800 italic uppercase leading-none">Laba Rugi <br/><span className="text-[10px] font-black text-slate-400 tracking-[0.3em] not-italic">INCOME STATEMENT</span></h4>
                 </div>
              </div>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={[
                    { name: 'Pemasukan', amount: income },
                    { name: 'Pengeluaran', amount: expense },
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
                    <p className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.25em] mb-2">GROSS REVENUE</p>
                    <h5 className="text-2xl font-black text-emerald-800 tracking-tighter">{formatCurrency(income)}</h5>
                 </div>
                 <div className="bg-rose-50/50 p-8 rounded-[2.5rem] border border-rose-100 shadow-sm">
                    <p className="text-[10px] font-black text-rose-600 uppercase tracking-[0.25em] mb-2">TOTAL OPEX</p>
                    <h5 className="text-2xl font-black text-rose-800 tracking-tighter">{formatCurrency(expense)}</h5>
                 </div>
              </div>
           </div>

           <div className="bg-slate-900 p-12 rounded-[3.5rem] shadow-2xl text-white space-y-12 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-48 h-48 bg-blue-600/10 blur-3xl rounded-full -mr-24 -mt-24"></div>
              <div className="flex items-center">
                 <div className="w-12 h-12 bg-blue-500 text-white rounded-2xl flex items-center justify-center mr-5 shadow-xl shadow-blue-500/20"><FileSpreadsheet size={24} /></div>
                 <h4 className="text-2xl font-black italic uppercase leading-none">Neraca Keuangan <br/><span className="text-[10px] font-black text-slate-500 tracking-[0.3em] not-italic">CONSOLIDATED ASSETS</span></h4>
              </div>
              <div className="space-y-6">
                <div className="space-y-3">
                  {FINANCIAL_ACCOUNTS.map(acc => (
                    <div key={acc} className="flex justify-between items-center p-5 bg-white/5 border border-white/5 rounded-[1.5rem] hover:bg-white/10 transition group cursor-default">
                      <div className="flex items-center">
                        <div className="w-2 h-2 rounded-full bg-blue-500 mr-4 group-hover:scale-150 transition"></div>
                        <span className="text-xs font-black uppercase text-slate-400">{acc}</span>
                      </div>
                      <span className="text-sm font-black tracking-tight">{formatCurrency(getAccountBalance(acc))}</span>
                    </div>
                  ))}
                  <div className="flex justify-between items-center p-8 bg-blue-600 rounded-[2.5rem] mt-10 shadow-2xl shadow-blue-500/30 border-2 border-white/10">
                     <div>
                        <span className="text-[10px] font-black uppercase tracking-[0.4em] text-blue-200">TOTAL EQUITY & ASSETS</span>
                        <h5 className="text-3xl font-black tracking-tighter mt-1">{formatCurrency(totalBalance)}</h5>
                     </div>
                     <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center"><TrendingUp size={32} /></div>
                  </div>
                </div>
              </div>
           </div>
        </div>
      )}

      {/* Transaction Modal with Optional Image Upload */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/90 backdrop-blur-md p-4">
           <div className="bg-white rounded-[3.5rem] w-full max-w-2xl p-12 shadow-2xl border border-white/20 animate-in zoom-in duration-300 overflow-y-auto max-h-[90vh]">
             <div className="flex justify-between items-center mb-10">
               <div>
                  <h3 className="text-3xl font-black text-slate-800 leading-tight italic uppercase tracking-tighter">Input Transaksi SDM</h3>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">ENTRY DATA PEMBUKUAN RESMI</p>
               </div>
               <button onClick={() => setShowAdd(false)} className="p-4 bg-slate-100 rounded-2xl text-slate-400 hover:text-rose-500 transition">✕</button>
             </div>
             
             <div className="space-y-8">
               <div className="flex bg-slate-50 p-2 rounded-[1.5rem] border border-slate-100">
                  <button 
                    onClick={() => setFormData({...formData, type: TransactionType.IN})}
                    className={`flex-1 py-4 text-xs font-black uppercase tracking-widest rounded-2xl transition-all ${formData.type === TransactionType.IN ? 'bg-slate-900 shadow-xl text-emerald-400' : 'text-slate-400'}`}
                  >DANA MASUK (IN)</button>
                  <button 
                    onClick={() => setFormData({...formData, type: TransactionType.OUT})}
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
                      onChange={e => setFormData({...formData, account: e.target.value as FinancialAccount})}
                    >
                      {FINANCIAL_ACCOUNTS.map(a => <option key={a} value={a}>{a.toUpperCase()}</option>)}
                    </select>
                 </div>
                 <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">KATEGORI AKUNTANSI</label>
                    <select 
                      className="w-full p-5 bg-slate-50 border-2 border-transparent rounded-[1.5rem] text-xs font-black uppercase tracking-widest outline-none focus:border-blue-600 focus:bg-white transition shadow-sm"
                      value={formData.category}
                      onChange={e => setFormData({...formData, category: e.target.value})}
                    >
                      <option value="">Pilih Kategori</option>
                      <option value="PROJECT">PROJECT CLIENT</option>
                      <option value="OPERATIONAL">BIAYA OPERASIONAL</option>
                      <option value="SALARY">PAYROLL / GAJI</option>
                      <option value="MARKETING">ADVERTISING & MARKETING</option>
                      <option value="EQUIPMENT">CAPEX / PERALATAN</option>
                      <option value="TAX">PAJAK PERUSAHAAN</option>
                    </select>
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

               {/* Optional Image Proof */}
               <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">LAMPIRAN BUKTI PEMBAYARAN (OPSIONAL)</label>
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
                 <button onClick={handleAdd} className="flex-1 py-5 bg-slate-900 text-white rounded-[2rem] font-black uppercase tracking-[0.2em] hover:bg-blue-600 transition text-[10px] shadow-2xl shadow-slate-200">VALIDASI & SIMPAN TRANSAKSI</button>
               </div>
             </div>
           </div>
        </div>
      )}

      {/* Image Preview Modal */}
      {previewImage && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/95 backdrop-blur-xl p-8" onClick={() => setPreviewImage(null)}>
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
