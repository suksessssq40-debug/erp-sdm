import React, { useMemo, useState, useEffect } from 'react';
import { Transaction, FinancialAccountDef, TransactionType } from '../../types';
import { formatCurrency } from '../../utils';
import { BookOpen, ChevronRight, TrendingUp, TrendingDown, RefreshCw } from 'lucide-react';

interface LedgerViewProps {
  transactions: Transaction[];
  financialAccounts: FinancialAccountDef[];
  MONTHS: string[];
  selectedMonth: number;
  selectedYear: number;
  defaultAccount?: string;
}

export const LedgerView: React.FC<LedgerViewProps> = ({
  transactions, financialAccounts, MONTHS, selectedMonth, selectedYear, defaultAccount
}) => {
  const [ledgerAccount, setLedgerAccount] = useState<string>(defaultAccount || '');

  useEffect(() => {
      if(!ledgerAccount && financialAccounts.length > 0) {
          setLedgerAccount(financialAccounts[0].name);
      }
  }, [financialAccounts, ledgerAccount]);

  const ledgerEntries = useMemo(() => {
    // Filter by Account AND sort chronological
    const accountTransactions = transactions
      .filter(t => t.account === ledgerAccount)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()); 

    let runningBalance = 0; 
    
    // Map with running balance: BUT display is reversed usually?
    // User wants Chronological usually for Ledger. But current UI showed .reverse(). 
    // Let's stick to current logic: Calculate cronological, then reverse for display (Newest First)
    
    return accountTransactions.map(t => {
      if (t.type === TransactionType.IN) runningBalance += t.amount;
      else runningBalance -= t.amount;
      return { ...t, runningBalance };
    }).reverse(); 
  }, [transactions, ledgerAccount]);

  // Current Balance (Top entry after reverse)
  const currentBalance = ledgerEntries.length > 0 ? ledgerEntries[0].runningBalance : 0;

  return (
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
                    <h2 className={`text-4xl font-black tracking-tighter ${currentBalance >= 0 ? 'text-slate-800' : 'text-rose-500'}`}>
                        {formatCurrency(currentBalance)}
                    </h2>
                </div>
                </div>
                
                <div className="flex-1 overflow-x-auto">
                <table className="w-full text-left">
                    <thead>
                    <tr className="bg-slate-50 text-slate-400 text-[9px] font-black uppercase tracking-[0.2em]">
                        <th className="px-8 py-4">Ref ID</th>
                        <th className="px-8 py-4">TANGGAL</th>
                        <th className="px-8 py-4">KETERANGAN</th>
                        <th className="px-8 py-4 text-right">DEBIT (IN)</th>
                        <th className="px-8 py-4 text-right">KREDIT (OUT)</th>
                        <th className="px-8 py-4 text-right">SALDO</th>
                    </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                    {ledgerEntries.length === 0 && (
                        <tr><td colSpan={6} className="text-center py-20 text-slate-400 text-xs font-black uppercase italic">Tidak ada mutasi pada periode ini</td></tr>
                    )}
                    {ledgerEntries.map((t) => (
                        <tr key={t.id} className="hover:bg-blue-50/50 transition duration-300">
                        <td className="px-8 py-6 text-[10px] font-mono text-slate-300">#{t.id.substr(0, 6)}</td>
                        <td className="px-8 py-6 text-[10px] font-black text-slate-500 uppercase tracking-widest">{new Date(t.date).toLocaleDateString('id-ID')}</td>
                        <td className="px-8 py-6">
                            <span className="text-xs font-bold text-slate-700 block max-w-xs">{t.description}</span>
                            <span className="text-[9px] font-bold text-slate-300 uppercase tracking-wide">{t.category}</span>
                        </td>
                        <td className="px-8 py-6 text-right">
                            {t.type === TransactionType.IN ? (
                                <span className="text-emerald-500 font-bold bg-emerald-50 px-3 py-1 rounded-lg text-xs">+{formatCurrency(t.amount)}</span>
                            ) : <span className="text-slate-200">-</span>}
                        </td>
                        <td className="px-8 py-6 text-right">
                            {t.type === TransactionType.OUT ? (
                                <span className="text-rose-500 font-bold bg-rose-50 px-3 py-1 rounded-lg text-xs">-{formatCurrency(t.amount)}</span>
                            ) : <span className="text-slate-200">-</span>}
                        </td>
                        <td className="px-8 py-6 text-right font-black text-slate-700 text-sm">
                            {formatCurrency(t.runningBalance)}
                        </td>
                        </tr>
                    ))}
                    </tbody>
                </table>
                </div>
            </div>
        </div>
    </div>
  );
};
