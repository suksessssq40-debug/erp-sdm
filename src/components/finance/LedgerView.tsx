import React, { useMemo } from 'react';
import { Transaction, FinancialAccountDef, TransactionType } from '../../types';
import { formatCurrency } from '../../utils';
import { BookOpen, ChevronRight, Receipt } from 'lucide-react';
import { EmptyState } from '../EmptyState';

interface LedgerViewProps {
    transactions: Transaction[]; // Should be Chronological ASC
    openingBalance: number;
    financialAccounts: FinancialAccountDef[];
    coaList?: ChartOfAccount[]; // New
    selectedAccount: string;
    onAccountChange: (accName: string) => void;
    startDate: string;
    endDate: string;
}

export const LedgerView: React.FC<LedgerViewProps> = ({
    transactions, openingBalance, financialAccounts, coaList = [], selectedAccount, onAccountChange, startDate, endDate
}) => {
    const [searchTerm, setSearchTerm] = React.useState('');

    // Combine Bank Accounts and Manual COA for the sidebar
    const allAvailableAccounts = useMemo(() => {
        // 1. Bank Accounts (Already have virtual COA metadata in backend but let's be safe)
        const banks = financialAccounts.map(acc => ({
            id: acc.id,
            name: acc.name,
            code: '1000', // Group at top
            type: 'BANK / KAS'
        }));

        // 2. All other COAs
        const others = coaList.map(coa => ({
            id: coa.id,
            name: `${coa.code} - ${coa.name}`,
            code: coa.code,
            type: coa.type
        }));

        return [...banks, ...others].filter(a =>
            !searchTerm ||
            a.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            a.code.includes(searchTerm)
        );
    }, [financialAccounts, coaList, searchTerm]);

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
                    <div className="bg-slate-900 p-8 rounded-[3rem] text-white shadow-2xl relative overflow-hidden flex flex-col h-[700px]">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/20 blur-3xl rounded-full"></div>
                        <BookOpen size={32} className="text-blue-400 mb-6 shrink-0" />
                        <h4 className="text-2xl font-black italic uppercase tracking-tighter mb-2 leading-none shrink-0">Buku Besar</h4>
                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-4 shrink-0">PILIH AKUN / COA</p>

                        {/* SEARCH BOX */}
                        <div className="relative mb-4 shrink-0">
                            <input
                                type="text"
                                placeholder="Cari akun..."
                                className="w-full bg-white/10 border border-white/10 rounded-xl px-4 py-2 text-xs font-bold outline-none focus:border-blue-500 transition"
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                        </div>

                        <div className="space-y-2 flex-1 overflow-y-auto custom-scrollbar pr-2">
                            {allAvailableAccounts.map(acc => (
                                <button
                                    key={acc.id}
                                    onClick={() => onAccountChange(acc.name)}
                                    className={`w-full p-4 rounded-2xl text-[10px] font-black text-left uppercase transition-all flex justify-between items-center ${selectedAccount === acc.name ? 'bg-blue-600 text-white shadow-xl' : 'bg-white/5 text-slate-400 hover:bg-white/10'}`}
                                >
                                    <div className="flex flex-col">
                                        <span>{acc.name}</span>
                                        <span className={`text-[8px] opacity-50 font-medium ${selectedAccount === acc.name ? 'text-white' : 'text-blue-400'}`}>{acc.type}</span>
                                    </div>
                                    {selectedAccount === acc.name && <ChevronRight size={14} className="shrink-0 ml-2" />}
                                </button>
                            ))}
                            {allAvailableAccounts.length === 0 && <p className="text-[10px] text-slate-600 italic text-center py-10">Tidak ada akun ditemukan</p>}
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
