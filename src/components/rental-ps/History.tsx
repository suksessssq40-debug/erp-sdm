
import React from 'react';
import { MapPin, Search, Calendar, Receipt, Eye, Pencil, Trash2 } from 'lucide-react';
import { RentalRecord } from './types';

interface HistoryProps {
    history: RentalRecord[];
    onSelect: (record: RentalRecord) => void;
    onEdit?: (record: RentalRecord) => void;
    onDelete?: (record: RentalRecord) => void;
}

export const History: React.FC<HistoryProps> = ({ history, onSelect, onEdit, onDelete }) => {
    return (
        <div className="bg-white rounded-[2.5rem] shadow-xl border border-slate-100 overflow-hidden animate-in fade-in duration-500">
            <div className="p-8 border-b border-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <h3 className="font-black uppercase tracking-widest text-slate-800 italic">Riwayat Rental Terbaru</h3>
                <div className="relative group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-500 transition-colors" size={16} />
                    <input
                        type="text"
                        placeholder="CARI NAMA / NOTA..."
                        className="pl-12 pr-6 py-3 bg-slate-50 border-none rounded-2xl text-[10px] font-black uppercase tracking-widest focus:ring-2 focus:ring-blue-500 w-full md:w-64"
                    />
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-left">
                    <thead>
                        <tr className="bg-slate-50">
                            <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Tanggal / Nota / Outlet</th>
                            <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Customer / Petugas</th>
                            <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Unit / Durasi</th>
                            <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Total</th>
                            <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Aksi</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 font-medium">
                        {history.map(row => (
                            <tr
                                key={row.id}
                                className="hover:bg-slate-50/80 transition-all group cursor-pointer"
                                onClick={() => onSelect(row)}
                            >
                                <td className="px-8 py-5">
                                    <p className="text-[10px] font-black text-slate-900 uppercase tracking-tight">{row.invoiceNumber}</p>
                                    <div className="flex items-center gap-2 mt-1">
                                        <p className="text-[9px] font-bold text-slate-400 flex items-center gap-1 uppercase">
                                            <Calendar size={10} /> {new Date(row.createdAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                                        </p>
                                        <span className="text-slate-200">|</span>
                                        <p className="text-[9px] font-black text-blue-500 uppercase flex items-center gap-1">
                                            <MapPin size={10} /> {row.outlet?.name || 'General'}
                                        </p>
                                    </div>
                                </td>
                                <td className="px-8 py-5">
                                    <p className="text-[11px] font-black text-slate-700 uppercase">{row.customerName}</p>
                                    <p className="text-[9px] font-bold text-slate-400 uppercase mt-0.5">{row.staffName || 'Spreadsheet'}</p>
                                </td>
                                <td className="px-8 py-5">
                                    <p className="text-[10px] font-black text-blue-600 uppercase flex items-center gap-2">
                                        {row.psType} <span className="text-slate-300">|</span> {row.duration} JAM
                                    </p>
                                </td>
                                <td className="px-8 py-5 text-right">
                                    <p className="text-[12px] font-black text-slate-900 italic">Rp {row.totalAmount.toLocaleString()}</p>
                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter mt-1">{row.paymentMethod}</p>
                                </td>
                                <td className="px-8 py-5">
                                    <div className="flex justify-center gap-2">
                                        <button
                                            onClick={(e) => { e.stopPropagation(); onSelect(row); }}
                                            className="p-2 bg-slate-100 text-slate-500 rounded-xl hover:bg-blue-600 hover:text-white transition-all shadow-sm"
                                            title="Lihat Detail"
                                        >
                                            <Eye size={14} />
                                        </button>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); onEdit?.(row); }}
                                            className="p-2 bg-slate-100 text-slate-500 rounded-xl hover:bg-amber-500 hover:text-white transition-all shadow-sm"
                                            title="Edit Transaksi"
                                        >
                                            <Pencil size={14} />
                                        </button>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); onDelete?.(row); }}
                                            className="p-2 bg-slate-100 text-rose-500 rounded-xl hover:bg-rose-500 hover:text-white transition-all shadow-sm"
                                            title="Hapus Transaksi"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {history.length === 0 && (
                            <tr>
                                <td colSpan={5} className="py-20 text-center">
                                    <div className="flex flex-col items-center gap-4 text-slate-300">
                                        <Receipt size={64} className="opacity-20" />
                                        <p className="text-[10px] font-black uppercase tracking-widest">Belum ada transaksi</p>
                                    </div>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
