import React, { useMemo } from 'react';
import { Transaction, FinancialAccountDef, TransactionType, ChartOfAccount } from '../../types';
import { formatCurrency } from '../../utils';
import { BookOpen, ChevronRight, Receipt, AlertCircle } from 'lucide-react';
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
    const categorizedAccounts = useMemo(() => {
        const groups: Record<string, any[]> = {
            'KAS & REKENING BANK': [],
            'HARTA / ASSET': [],
            'PENDAPATAN': [],
            'BEBAN & BIAYA': [],
            'MODAL & KEWAJIBAN': []
        };

        // 1. Bank Accounts
        financialAccounts.forEach(acc => {
            groups['KAS & REKENING BANK'].push({
                id: acc.id,
                name: acc.name,
                code: '1000',
                type: 'BANK / KAS'
            });
        });

        // 2. COAs
        coaList.forEach(coa => {
            const item = {
                id: coa.id,
                name: `${coa.code} - ${coa.name}`,
                code: coa.code,
                type: coa.type
            };
            if (coa.type === 'ASSET') groups['HARTA / ASSET'].push(item);
            else if (coa.type === 'REVENUE' || coa.type === 'INCOME') groups['PENDAPATAN'].push(item);
            else if (coa.type === 'EXPENSE') groups['BEBAN & BIAYA'].push(item);
            else groups['MODAL & KEWAJIBAN'].push(item);
        });

        // Apply Search Filter and Remove Empty Groups
        const result: Record<string, any[]> = {};
        Object.keys(groups).forEach(key => {
            const filtered = groups[key].filter(a =>
                !searchTerm ||
                a.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                a.code.includes(searchTerm)
            );
            if (filtered.length > 0) result[key] = filtered;
        });

        return result;
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
                    <div className="bg-slate-900 p-8 rounded-[3.5rem] text-white shadow-2xl relative overflow-hidden flex flex-col h-[750px] border border-white/5">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 blur-3xl rounded-full"></div>
                        <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-indigo-500/10 blur-3xl rounded-full"></div>

                        <BookOpen size={32} className="text-blue-400 mb-6 shrink-0" />
                        <h4 className="text-2xl font-black italic uppercase tracking-tighter mb-2 leading-none shrink-0">Buku Besar</h4>
                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-4 shrink-0">NAVIGASI AKUN</p>

                        {/* SEARCH BOX */}
                        <div className="relative mb-6 shrink-0">
                            <input
                                type="text"
                                placeholder="Cari nama atau kode..."
                                className="w-full bg-white/10 border border-white/10 rounded-2xl px-5 py-3 text-xs font-bold outline-none focus:border-blue-500 focus:bg-white/20 transition placeholder:text-slate-600"
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                        </div>

                        <div className="space-y-6 flex-1 overflow-y-auto custom-scrollbar pr-2 pb-6">
                            {Object.keys(categorizedAccounts).map(groupName => (
                                <div key={groupName} className="space-y-2">
                                    <h5 className="text-[8px] font-black text-slate-500 uppercase tracking-[0.2em] ml-2 mb-3">{groupName}</h5>
                                    {categorizedAccounts[groupName].map(acc => (
                                        <button
                                            key={acc.id}
                                            onClick={() => onAccountChange(acc.name)}
                                            className={`w-full p-4 rounded-2xl text-[10px] font-black text-left uppercase transition-all flex justify-between items-center group ${selectedAccount === acc.name ? 'bg-blue-600 text-white shadow-xl shadow-blue-900/40 translate-x-1' : 'bg-white/5 text-slate-400 hover:bg-white/10'}`}
                                        >
                                            <div className="flex flex-col">
                                                <span className={`${selectedAccount === acc.name ? 'text-white' : 'group-hover:text-blue-400'} transition-colors`}>{acc.name}</span>
                                                <span className={`text-[7px] opacity-40 font-medium ${selectedAccount === acc.name ? 'text-white' : 'text-slate-500'}`}>{acc.type}</span>
                                            </div>
                                            {selectedAccount === acc.name && <ChevronRight size={14} className="shrink-0 ml-2" />}
                                        </button>
                                    ))}
                                </div>
                            ))}
                            {Object.keys(categorizedAccounts).length === 0 && (
                                <div className="text-center py-20 animate-pulse">
                                    <p className="text-[10px] text-slate-600 italic">Akun tidak ditemukan</p>
                                </div>
                            )}
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
                            <div className="relative group">
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 flex items-center justify-end gap-1">
                                    SALDO AWAL
                                    <AlertCircle size={10} className="text-slate-300 cursor-help" />
                                </p>
                                <div className="absolute right-0 bottom-full mb-2 w-48 bg-slate-800 text-white text-[9px] p-3 rounded-xl opacity-0 group-hover:opacity-100 transition pointer-events-none z-30 shadow-xl font-medium leading-relaxed">
                                    Dihitung dari total masuk (IN) dikurangi keluar (OUT) dari seluruh transaksi <span className="text-blue-400 font-bold">sebelum tanggal {new Date(startDate).toLocaleDateString('id-ID')}</span>.
                                </div>
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
