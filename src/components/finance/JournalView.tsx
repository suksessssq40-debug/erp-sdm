import React, { useState } from 'react';
import { Transaction, TransactionType, BusinessUnit } from '../../types';
import { formatCurrency } from '../../utils';
import { Search, Landmark, Edit, Trash2, ImageIcon, Receipt } from 'lucide-react';
import { EmptyState } from '../EmptyState';

interface JournalViewProps {
    transactions: Transaction[];
    businessUnits: BusinessUnit[];

    onEdit: (t: Transaction) => void;
    onDelete: (t: Transaction) => void;

    // Pagination & Status Filter
    statusFilter: string;
    onStatusChange: (s: string) => void;
    currentPage: number;
    totalPages: number;
    onPageChange: (p: number) => void;
}

export const JournalView: React.FC<JournalViewProps> = ({
    transactions, businessUnits, onEdit, onDelete,
    statusFilter, onStatusChange, currentPage, totalPages, onPageChange
}) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [previewImage, setPreviewImage] = useState<string | null>(null);

    const filteredTransactions = transactions.filter(t =>
        !searchTerm || t.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.category.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="flex flex-col gap-6 w-full">
            <div className="bg-white rounded-[3rem] shadow-xl border border-slate-100 overflow-hidden animate-in fade-in duration-500">
                <div className="p-10 border-b flex flex-col md:flex-row justify-between items-center gap-6 bg-slate-50/30">
                    <div className="flex justify-between items-center w-full">
                        <div>
                            <h4 className="text-2xl font-black text-slate-800 italic uppercase tracking-tighter">Jurnal Transaksi</h4>
                            <p className="text-[10px] text-slate-400 uppercase font-black tracking-[0.3em] mt-1">LOG TRANSAKSI KRONOLOGIS</p>
                        </div>
                        <div className="flex flex-col md:flex-row gap-2">
                            <select
                                value={statusFilter}
                                onChange={(e) => onStatusChange(e.target.value)}
                                className="bg-white border-2 border-slate-100 text-[10px] font-black uppercase text-slate-600 px-4 py-3 rounded-2xl outline-none focus:border-blue-600 transition shadow-sm cursor-pointer"
                            >
                                <option value="ALL">SEMUA STATUS</option>
                                <option value="PAID">LUNAS</option>
                                <option value="UNPAID">BELUM LUNAS (DP)</option>
                            </select>
                            <div className="hidden md:flex items-center bg-blue-50 px-5 py-3 rounded-2xl text-[9px] font-black uppercase text-blue-600 tracking-widest gap-2 border border-blue-100 shadow-sm">
                                <Receipt size={12} /> {transactions.length} Records
                            </div>
                        </div>
                    </div>
                    <div className="flex gap-3 w-full md:w-auto">
                        <div className="relative flex-1 md:w-72">
                            <Search size={18} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300" />
                            <input
                                className="w-full pl-12 pr-6 py-4 bg-white border-2 border-slate-50 rounded-[1.5rem] text-xs font-bold focus:border-blue-600 outline-none transition shadow-sm"
                                placeholder="Cari keterangan..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>
                </div>

                {filteredTransactions.length === 0 ? (
                    <EmptyState
                        icon={Receipt}
                        title="Tidak Ada Transaksi"
                        description={searchTerm ? `Tidak ditemukan transaksi dengan kata kunci "${searchTerm}"` : "Belum ada data transaksi tercatat untuk periode ini."}
                    />
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="bg-slate-50/50 text-slate-400 text-[9px] font-black uppercase tracking-[0.2em] border-b border-slate-100">
                                    <th className="px-10 py-6">TANGGAL</th>
                                    <th className="px-10 py-6">ACCOUNT</th>
                                    <th className="px-10 py-6">DESKRIPSI</th>
                                    <th className="px-10 py-6">KATEGORI</th>
                                    <th className="px-10 py-6 text-center">STATUS</th>
                                    <th className="px-10 py-6 text-right">NOMINAL</th>
                                    <th className="px-10 py-6 text-center">AKSI</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {filteredTransactions.map(t => (
                                    <tr key={t.id} className="hover:bg-blue-50/30 transition-colors group">
                                        <td className="px-10 py-7 text-[10px] font-black text-slate-400 uppercase tracking-widest">{new Date(t.date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })}</td>
                                        <td className="px-10 py-7">
                                            <div className="flex items-center space-x-3">
                                                <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center">
                                                    <Landmark size={12} />
                                                </div>
                                                <span className="text-[10px] font-black text-slate-700 uppercase">{t.account}</span>
                                            </div>
                                        </td>
                                        <td className="px-10 py-7 text-xs font-bold text-slate-600 italic">
                                            "{t.description}"
                                            {t.contactName && <div className="text-[9px] text-slate-400 not-italic mt-1">Ref: {t.contactName}</div>}
                                            {t.businessUnitId && (
                                                <div className="mt-1">
                                                    <span className="bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded text-[7px] font-black uppercase tracking-wider">
                                                        {businessUnits.find(u => u.id === t.businessUnitId)?.name || 'UNKNOWN'}
                                                    </span>
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-10 py-7">
                                            <span className="bg-white border border-slate-100 text-slate-500 px-3 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-[0.15em]">{t.category || 'GENERAL'}</span>
                                        </td>
                                        <td className="px-10 py-7 text-center">
                                            {t.status === 'UNPAID' || t.status === 'PENDING' ? (
                                                <span className="bg-rose-100 text-rose-600 px-3 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-widest border border-rose-200">
                                                    BELUM LUNAS
                                                </span>
                                            ) : (
                                                <span className="text-[8px] font-black uppercase tracking-widest text-emerald-500">
                                                    LUNAS
                                                </span>
                                            )}
                                        </td>
                                        <td className={`px-10 py-7 text-sm font-black text-right ${t.type === TransactionType.IN ? 'text-emerald-600' : 'text-rose-600'}`}>
                                            {t.type === TransactionType.IN ? '+' : '-'}{formatCurrency(t.amount)}
                                        </td>
                                        <td className="px-10 py-7 text-center">
                                            <div className="flex items-center justify-center gap-2">
                                                {/* SETTLEMENT BUTTON FOR UNPAID */}
                                                {(t.status === 'UNPAID' || t.status === 'PENDING') && (
                                                    <button
                                                        onClick={() => onEdit(t)}
                                                        className="px-3 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition shadow-lg shadow-emerald-200 flex items-center gap-2 animate-pulse"
                                                        title="Klik untuk Melunasi"
                                                    >
                                                        <span className="text-[8px] font-black uppercase tracking-widest">LUNASI</span>
                                                    </button>
                                                )}

                                                {t.imageUrl && (
                                                    <button onClick={() => setPreviewImage(t.imageUrl!)} className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-600 hover:text-white transition">
                                                        <ImageIcon size={14} />
                                                    </button>
                                                )}

                                                <button onClick={() => onEdit(t)} className="p-2 bg-amber-50 text-amber-600 rounded-lg hover:bg-amber-500 hover:text-white transition">
                                                    <Edit size={14} />
                                                </button>

                                                <button onClick={() => onDelete(t)} className="p-2 bg-rose-50 text-rose-600 rounded-lg hover:bg-rose-500 hover:text-white transition">
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* PAGINATION CONTROLS */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        Halaman {currentPage} dari {totalPages}
                    </p>
                    <div className="flex gap-2">
                        <button
                            onClick={() => onPageChange(Math.max(1, currentPage - 1))}
                            disabled={currentPage === 1}
                            className="px-6 py-4 bg-slate-50 text-slate-900 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-900 hover:text-white transition disabled:opacity-30 disabled:hover:bg-slate-50 disabled:hover:text-slate-900 shadow-sm"
                        >
                            Sebelumnya
                        </button>
                        <button
                            onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
                            disabled={currentPage === totalPages}
                            className="px-6 py-4 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-700 transition disabled:opacity-30 shadow-lg"
                        >
                            Selanjutnya
                        </button>
                    </div>
                </div>
            )}

            {/* Image Preview Overlay */}
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
