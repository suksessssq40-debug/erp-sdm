import React from 'react';
import { useAppStore } from '../context/StoreContext';
import { Wallet, TrendingUp, TrendingDown, CreditCard } from 'lucide-react';
import { useRouter } from 'next/navigation';

export const FinanceDashboard = () => {
  const { currentUser, transactions, financialAccounts } = useAppStore();
  const router = useRouter();

  // Financial Stats
  const totalBalance = financialAccounts.reduce((sum, acc) => {
      // Calculate balance from transactions per account (Simplified for now)
      // Ideally backend sends pre-calculated balance or store does it. 
      // Assuming store doesn't track balance in account object yet, we sum transactions? 
      // No, for dashboard speed, use current mock or sum if small.
      // Let's sum transactions for now.
      const accTrans = transactions.filter(t => t.account === acc.name || t.accountId === acc.id);
      const income = accTrans.filter(t => t.type === 'IN').reduce((s, t) => s + t.amount, 0);
      const expense = accTrans.filter(t => t.type === 'OUT').reduce((s, t) => s + t.amount, 0);
      return sum + (income - expense);
  }, 0);

  const todayStr = new Date().toISOString().split('T')[0];
  const todayTrans = transactions.filter(t => t.date.startsWith(todayStr));
  const todayIn = todayTrans.filter(t => t.type === 'IN').reduce((s, t) => s + t.amount, 0);
  const todayOut = todayTrans.filter(t => t.type === 'OUT').reduce((s, t) => s + t.amount, 0);

  const formatIDR = (n: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
       <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Total Balance */}
          <div className="md:col-span-3 bg-gradient-to-r from-slate-900 to-slate-800 p-8 rounded-[2.5rem] text-white shadow-2xl relative overflow-hidden">
             <div className="absolute right-0 top-0 w-96 h-96 bg-white/5 rounded-full blur-3xl -translate-y-20 translate-x-20"></div>
             <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
                 <div>
                    <h2 className="text-slate-400 font-bold text-sm uppercase tracking-widest mb-2 flex items-center gap-2">
                        <Wallet size={16} /> Total Saldo Perusahaan
                    </h2>
                    <div className="text-4xl md:text-5xl font-black tracking-tight">
                        {formatIDR(totalBalance)}
                    </div>
                </div>
                <button onClick={() => router.push(`/${currentUser?.role.toLowerCase()}/finance`)} className="px-6 py-3 bg-white/10 backdrop-blur-md rounded-xl font-bold text-sm hover:bg-white/20 transition">
                    Lihat Detail Keuangan
                </button>
             </div>
          </div>

          {/* Income Today */}
          <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm relative overflow-hidden">
             <div className="flex items-center gap-3 mb-4 text-emerald-600">
                <div className="p-2 bg-emerald-50 rounded-lg"><TrendingUp size={20} /></div>
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">PEMASUKAN HARI INI</span>
             </div>
             <div className="text-2xl font-black text-slate-800">{formatIDR(todayIn)}</div>
          </div>

          {/* Expense Today */}
          <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm relative overflow-hidden">
             <div className="flex items-center gap-3 mb-4 text-rose-600">
                <div className="p-2 bg-rose-50 rounded-lg"><TrendingDown size={20} /></div>
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">PENGELUARAN HARI INI</span>
             </div>
             <div className="text-2xl font-black text-slate-800">{formatIDR(todayOut)}</div>
          </div>

          {/* Recent Trans */}
          <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm relative overflow-hidden">
             <div className="flex items-center gap-3 mb-4 text-blue-600">
                <div className="p-2 bg-blue-50 rounded-lg"><CreditCard size={20} /></div>
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">TRANSAKSI TERAKHIR</span>
             </div>
             <div className="space-y-4">
                 {transactions.slice(0, 3).map(t => (
                     <div key={t.id} className="flex justify-between items-center text-sm">
                         <div className="font-bold text-slate-700 truncate w-32">{t.description}</div>
                         <div className={`font-black ${t.type === 'IN' ? 'text-emerald-600' : 'text-rose-600'}`}>
                             {t.type === 'IN' ? '+' : '-'}{formatIDR(t.amount)}
                         </div>
                     </div>
                 ))}
             </div>
          </div>
       </div>
    </div>
  );
};
