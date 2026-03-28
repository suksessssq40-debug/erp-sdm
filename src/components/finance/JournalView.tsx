import React, { useState } from 'react';
import { Transaction, TransactionType, BusinessUnit, FinancialAccountDef } from '../../types';
import { formatCurrency } from '../../utils';
import { Search, Landmark, Edit, Trash2, ImageIcon, Receipt, ArrowRight } from 'lucide-react';
import { EmptyState } from '../EmptyState';

interface JournalViewProps {
    transactions: Transaction[];
    financialAccounts: FinancialAccountDef[];
    businessUnits: BusinessUnit[];

    onEdit: (t: Transaction) => void;
    onDelete: (t: Transaction) => void;

    // Pagination & Status Filter
    statusFilter: string;
    onStatusChange: (s: string) => void;
    searchTerm: string;
    onSearchChange: (s: string) => void;
    onSearchSubmit: () => void;
    currentPage: number;
    totalPages: number;
    totalRecords: number;
    onPageChange: (p: number) => void;
}

export const JournalView: React.FC<JournalViewProps> = ({
    transactions, financialAccounts = [], businessUnits, onEdit, onDelete,
    statusFilter, onStatusChange, searchTerm, onSearchChange, onSearchSubmit, currentPage, totalPages, totalRecords, onPageChange
}) => {
    const [previewImage, setPreviewImage] = useState<string | null>(null);

    const bankNames = financialAccounts.map(a => a.name.toLowerCase());

    return (
        <div className="flex flex-col gap-6 w-full">
            <div className="bg-white rounded-[3rem] shadow-xl border border-slate-100 overflow-hidden animate-in fade-in duration-500">
                <div className="p-10 border-b flex flex-col md:flex-row justify-between items-center gap-6 bg-slate-50/30">
                    <div className="flex justify-between items-center w-full">
                        <div>
                            <h4 className="text-2xl font-black text-slate-800 italic uppercase tracking-tighter">Buku Jurnal Umum</h4>
                            <p className="text-[10px] text-slate-400 uppercase font-black tracking-[0.3em] mt-1">CATATAN DEBIT & KREDIT KRONOLOGIS</p>
                        </div>
                        <div className="flex flex-col md:flex-row gap-2">
                            <div className="hidden md:flex items-center bg-blue-50 px-5 py-3 rounded-2xl text-[9px] font-black uppercase text-blue-600 tracking-widest gap-2 border border-blue-100 shadow-sm">
                                <Receipt size={12} /> {totalRecords} Jurnal
                            </div>
                        </div>
                    </div>
                    <div className="flex gap-3 w-full md:w-auto">
                        <div className="relative flex-1 md:w-72">
                            <Search size={18} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300" />
                            <input
                                className="w-full pl-12 pr-6 py-4 bg-white border-2 border-slate-50 rounded-[1.5rem] text-xs font-bold focus:border-blue-600 outline-none transition shadow-sm"
                                placeholder="Ketik lalu Tekan ENTER untuk mencari..."
                                value={searchTerm}
                                onChange={e => onSearchChange(e.target.value)}
                                onKeyDown={e => {
                                    if (e.key === 'Enter') {
                                        onSearchSubmit();
                                    }
                                }}
                            />
                        </div>
                    </div>
                </div>

                {transactions.length === 0 ? (
                    <EmptyState
                        icon={Receipt}
                        title="Jurnal Kosong"
                        description={searchTerm ? `Tidak ditemukan jurnal dengan kata kunci "${searchTerm}"` : "Belum ada data jurnal tercatat untuk periode ini."}
                    />
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50/50 text-slate-400 text-[9px] font-black uppercase tracking-[0.2em] border-b border-slate-100">
                                    <th className="px-8 py-6">TANGGAL</th>
                                    <th className="px-8 py-6">KETERANGAN / JURNAL</th>
                                    <th className="px-8 py-6">AKUN DEBIT (+)</th>
                                    <th className="px-8 py-6">AKUN KREDIT (-)</th>
                                    <th className="px-8 py-6 text-right">NOMINAL</th>
                                    <th className="px-8 py-6 text-center">AKSI</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {transactions.map(t => {
                                    const isDebit = t.type === TransactionType.IN;
                                    const debitAcc = isDebit ? t.account : t.category;
                                    const creditAcc = isDebit ? t.category : t.account;

                                    const isDebitBank = t.accountId || (debitAcc && bankNames.includes(debitAcc.toLowerCase()));
                                    const isCreditBank = t.accountId || (creditAcc && bankNames.includes(creditAcc.toLowerCase()));

                                    return (
                                        <tr key={t.id} className="hover:bg-blue-50/20 transition-colors group">
                                            <td className="px-8 py-6 align-top">
                                                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">
                                                    {new Date(t.date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                </div>
                                                {t.businessUnitId && (
                                                    <div className="mt-2 text-[7px] font-black bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded w-fit uppercase">
                                                        {businessUnits.find(u => u.id === t.businessUnitId)?.name || 'UNIT'}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-8 py-6 align-top">
                                                <div className="text-xs font-bold text-slate-700 leading-snug">
                                                    {t.description}
                                                </div>
                                                {t.contactName && (
                                                    <div className="flex items-center gap-1.5 mt-2 text-[9px] text-slate-400 font-bold uppercase tracking-wider">
                                                        <Receipt size={10} /> {t.contactName}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-8 py-6 align-top">
                                                <div className="flex flex-col gap-1">
                                                    <span className="text-[10px] font-black text-emerald-600 uppercase tracking-tight truncate max-w-[150px]" title={debitAcc}>
                                                        {debitAcc || '-'}
                                                    </span>
                                                    {!isDebitBank && <span className="text-[7px] font-black text-slate-300 italic uppercase">JURNAL UMUM</span>}
                                                </div>
                                            </td>
                                            <td className="px-8 py-6 align-top">
                                                <div className="flex flex-col gap-1">
                                                    <span className="text-[10px] font-black text-rose-600 uppercase tracking-tight truncate max-w-[150px]" title={creditAcc}>
                                                        {creditAcc || '-'}
                                                    </span>
                                                    {!isCreditBank && <span className="text-[7px] font-black text-slate-300 italic uppercase">JURNAL UMUM</span>}
                                                </div>
                                            </td>
                                            <td className="px-8 py-6 align-top text-right">
                                                <div className="text-sm font-black text-slate-900 tabular-nums">
                                                    {formatCurrency(t.amount)}
                                                </div>
                                            </td>
                                            <td className="px-8 py-6 text-center align-top">
                                                <div className="flex items-center justify-center gap-2">
                                                    {t.imageUrl && (
                                                        <button onClick={() => setPreviewImage(t.imageUrl!)} className="p-2.5 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-600 hover:text-white transition shadow-sm" title="Lihat Bukti">
                                                            <ImageIcon size={14} />
                                                        </button>
                                                    )}
                                                    <button onClick={() => onEdit(t)} className="p-2.5 bg-slate-900 text-white rounded-xl hover:bg-blue-600 transition shadow-lg" title="Edit Jurnal">
                                                        <Edit size={14} />
                                                    </button>
                                                    <button onClick={() => onDelete(t)} className="p-2.5 bg-rose-50 text-rose-600 rounded-xl hover:bg-rose-500 hover:text-white transition shadow-sm" title="Hapus">
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Pagination remains the same */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-4">Halaman {currentPage} dari {totalPages}</p>
                    <div className="flex gap-3">
                        <button onClick={() => onPageChange(Math.max(1, currentPage - 1))} disabled={currentPage === 1} className="px-8 py-4 bg-slate-50 text-slate-900 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-900 hover:text-white transition disabled:opacity-30 shadow-sm">Sebelumnya</button>
                        <button onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))} disabled={currentPage === totalPages} className="px-8 py-4 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 transition disabled:opacity-30 shadow-xl">Selanjutnya</button>
                    </div>
                </div>
            )}

            {previewImage && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/95 backdrop-blur-xl p-8 animate-in fade-in duration-200" onClick={() => setPreviewImage(null)}>
                    <div className="max-w-4xl w-full max-h-full flex flex-col items-center">
                        <img src={previewImage} className="max-w-full max-h-[85vh] object-contain rounded-[3rem] shadow-2xl border-8 border-white/10" alt="Bukti" />
                        <button onClick={() => setPreviewImage(null)} className="mt-8 px-12 py-4 bg-white text-slate-900 rounded-2xl font-black uppercase tracking-widest hover:bg-blue-600 hover:text-white transition">TUTUP</button>
                    </div>
                </div>
            )}
        </div>
    );
};
