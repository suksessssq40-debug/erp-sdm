import React, { useMemo } from 'react';
import { Transaction, FinancialAccountDef, TransactionType } from '../../types';
import { formatCurrency } from '../../utils';
import { BookOpen, ChevronRight, Receipt } from 'lucide-react';
import { EmptyState } from '../EmptyState';

interface LedgerViewProps {
  transactions: Transaction[]; // Should be Chronological ASC
  openingBalance: number;
  financialAccounts: FinancialAccountDef[];
  selectedAccount: string;
  onAccountChange: (accName: string) => void;
  startDate: string;
  endDate: string;
}

export const LedgerView: React.FC<LedgerViewProps> = ({
  transactions, openingBalance, financialAccounts, selectedAccount, onAccountChange, startDate, endDate
}) => {

  // Calculate Running Balance on the fly
  const ledgerEntries = useMemo(() => {
    let balance = openingBalance;
    return transactions.map(t => {
        if (t.type === TransactionType.IN) balance += t.amount;
        else balance -= t.amount;
        return { ...t, runningBalance: balance };
    });
    // We keep it Chronological (ASC) for Ledger Flow
  }, [transactions, openingBalance]);

  const closingBalance = ledgerEntries.length > 0 ? ledgerEntries[ledgerEntries.length - 1].runningBalance : openingBalance;

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
                            onClick={() => onAccountChange(acc.name)}
                            className={`w-full p-4 rounded-2xl text-[10px] font-black text-left uppercase transition-all flex justify-between items-center ${selectedAccount === acc.name ? 'bg-blue-600 text-white shadow-xl' : 'bg-white/5 text-slate-400 hover:bg-white/10'}`}
                            >
                                {acc.name}
                                {selectedAccount === acc.name && <ChevronRight size={14} />}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="lg:col-span-3 bg-white rounded-[3rem] shadow-xl border border-slate-100 overflow-hidden flex flex-col">
                <div className="p-10 border-b flex justify-between items-center bg-slate-50/30">
                <div>
                    <h4 className="text-xl font-black text-slate-800 uppercase italic leading-none">{selectedAccount} <span className="text-slate-400">LEDGER</span></h4>
                    <p className="text-[10px] font-black text-slate-400 mt-2 uppercase tracking-widest">
                        {new Date(startDate).toLocaleDateString('id-ID')} - {new Date(endDate).toLocaleDateString('id-ID')}
                    </p>
                </div>
                <div className="flex gap-8 text-right">
                    <div>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">SALDO AWAL</p>
                        <h2 className="text-2xl font-black text-slate-600 tracking-tighter">
                            {formatCurrency(openingBalance)}
                        </h2>
                    </div>
                    <div>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 text-emerald-600">SALDO AKHIR</p>
                        <h2 className={`text-4xl font-black tracking-tighter ${closingBalance >= 0 ? 'text-emerald-900' : 'text-rose-500'}`}>
                            {formatCurrency(closingBalance)}
                        </h2>
                    </div>
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
                        <tr>
                          <td colSpan={6} className="py-12">
                            <div className="flex justify-center">
                                <EmptyState 
                                    icon={Receipt} 
                                    title="Tidak Ada Mutasi" 
                                    description="Belum ada transaksi tercatat pada akun ini untuk periode yang dipilih." 
                                />
                            </div>
                          </td>
                        </tr>
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
