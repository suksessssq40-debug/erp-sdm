
import React from 'react';
import { MapPin, Search, Calendar, Receipt, Eye, Pencil, Trash2 } from 'lucide-react';
import { RentalRecord } from './types';

interface HistoryProps {
    history: RentalRecord[];
    onSelect: (record: RentalRecord) => void;
    onEdit?: (record: RentalRecord) => void;
    onDelete?: (record: RentalRecord) => void;
    onLoadMore?: () => void;
    hasMore?: boolean;
    isLoadingMore?: boolean;
    searchQuery: string;
    onSearchChange: (val: string) => void;
}

export const History: React.FC<HistoryProps> = ({
    history, onSelect, onEdit, onDelete,
    onLoadMore, hasMore, isLoadingMore,
    searchQuery, onSearchChange
}) => {

    // Logic Grouping by Date
    const groupedData = React.useMemo(() => {
        const groups: Record<string, RentalRecord[]> = {};
        const today = new Date().toLocaleDateString('id-ID');
        const yesterday = new Date(Date.now() - 86400000).toLocaleDateString('id-ID');

        history.forEach(item => {
            const dateStr = new Date(item.createdAt).toLocaleDateString('id-ID');
            let label = dateStr;
            if (dateStr === today) label = 'HARI INI';
            else if (dateStr === yesterday) label = 'KEMARIN';

            if (!groups[label]) groups[label] = [];
            groups[label].push(item);
        });
        return groups;
    }, [history]);

    return (
        <div className="space-y-6 animate-in fade-in duration-700">
            {/* SEARCH & TITLE AREA */}
            <div className="bg-white rounded-[2.5rem] shadow-xl border border-slate-100 p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h3 className="text-xl font-black uppercase tracking-tighter text-slate-800 italic">Riwayat Transaksi</h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Audit log & mutasi pendapatan</p>
                </div>
                <div className="relative group w-full md:w-80">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-500 transition-colors" size={18} />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => onSearchChange(e.target.value)}
                        placeholder="CARI NAMA, NOTA, UNIT..."
                        className="pl-12 pr-6 py-4 bg-slate-50 border-none rounded-2xl text-[11px] font-black uppercase tracking-widest focus:ring-2 focus:ring-blue-500 w-full shadow-inner"
                    />
                </div>
            </div>

            {/* GROUPED LIST */}
            <div className="space-y-8">
                {Object.keys(groupedData).length > 0 ? (
                    Object.entries(groupedData).map(([dateLabel, records]) => (
                        <div key={dateLabel} className="space-y-4">
                            <div className="flex items-center gap-4 px-4">
                                <span className="text-[11px] font-black text-slate-400 uppercase tracking-[0.3em] whitespace-nowrap">{dateLabel}</span>
                                <div className="h-px bg-slate-100 w-full" />
                            </div>

                            <div className="grid grid-cols-1 gap-4">
                                {records.map(row => (
                                    <div
                                        key={row.id}
                                        onClick={() => onSelect(row)}
                                        className="bg-white p-5 md:p-6 rounded-[2rem] shadow-sm border border-slate-50 hover:border-blue-200 hover:shadow-md transition-all cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4 md:gap-6 relative overflow-hidden group"
                                    >
                                        <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-slate-200 group-hover:bg-blue-500 transition-colors" />

                                        {/* TOP ACTIONS FOR MOBILE */}
                                        <div className="flex md:hidden absolute right-4 top-4 gap-1.5">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); onEdit?.(row); }}
                                                className="p-2 bg-slate-50 text-slate-400 rounded-xl hover:bg-amber-500 hover:text-white transition-all shadow-sm"
                                            >
                                                <Pencil size={12} />
                                            </button>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); onDelete?.(row); }}
                                                className="p-2 bg-slate-50 text-rose-400 rounded-xl hover:bg-rose-500 hover:text-white transition-all shadow-sm"
                                            >
                                                <Trash2 size={12} />
                                            </button>
                                        </div>

                                        <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-6 flex-1">
                                            {/* Nota & Time */}
                                            <div className="min-w-[120px]">
                                                <p className="text-[11px] font-black text-slate-900 uppercase tracking-tight">{row.invoiceNumber}</p>
                                                <p className="text-[10px] font-bold text-slate-400 mt-0.5 uppercase flex items-center gap-1">
                                                    <Calendar size={12} /> {new Date(row.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB
                                                </p>
                                            </div>

                                            {/* Customer & Residence */}
                                            <div className="min-w-[160px]">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <p className="text-[13px] font-black text-slate-700 uppercase tracking-tight">{row.customerName}</p>
                                                    {row.staffName === 'System Import' && (
                                                        <span className="bg-emerald-50 text-emerald-600 text-[7px] font-black px-1.5 py-0.5 rounded-full border border-emerald-100 uppercase tracking-tighter">🛒 IMPORT</span>
                                                    )}
                                                </div>
                                                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1">
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase">{row.staffName || 'Unknown'}</p>
                                                    <span className="hidden md:inline text-slate-200 text-xs">•</span>
                                                    <p className="text-[10px] font-black text-blue-500 uppercase flex items-center gap-1">
                                                        <MapPin size={10} /> {row.outlet?.name || 'General'}
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Unit & Duration */}
                                            <div className="flex md:block">
                                                <div className="inline-flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100/50">
                                                    <p className="text-[9px] font-black text-slate-600 uppercase">{row.psType}</p>
                                                    <span className="text-slate-300">|</span>
                                                    <p className="text-[9px] font-black text-blue-600 uppercase">{row.duration} JAM</p>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Amount & Actions (Desktop) */}
                                        <div className="flex items-center justify-between md:justify-end gap-6 border-t md:border-none pt-4 md:pt-0 mt-2 md:mt-0">
                                            <div className="text-left md:text-right">
                                                <p className="text-[16px] font-black text-slate-900 italic tracking-tighter">Rp {row.totalAmount.toLocaleString()}</p>
                                                <div className="flex md:justify-end mt-1">
                                                    {row.paymentMethod === 'CASH' && <span className="bg-emerald-50 text-emerald-600 text-[8px] font-black px-2 py-0.5 rounded-lg border border-emerald-100 uppercase">💵 TUNAI</span>}
                                                    {row.paymentMethod === 'TRANSFER' && <span className="bg-blue-50 text-blue-600 text-[8px] font-black px-2 py-0.5 rounded-lg border border-blue-100 uppercase">📱 TRANSFER</span>}
                                                    {row.paymentMethod === 'SPLIT' && <span className="bg-amber-50 text-amber-600 text-[8px] font-black px-2 py-0.5 rounded-lg border border-amber-100 uppercase">⚡ SPLIT</span>}
                                                </div>
                                            </div>

                                            <div className="hidden md:flex gap-2">
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); onEdit?.(row); }}
                                                    className="p-2.5 bg-slate-50 text-slate-400 rounded-2xl hover:bg-amber-500 hover:text-white transition-all shadow-sm"
                                                    title="Edit"
                                                >
                                                    <Pencil size={14} />
                                                </button>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); onDelete?.(row); }}
                                                    className="p-2.5 bg-slate-50 text-rose-400 rounded-2xl hover:bg-rose-500 hover:text-white transition-all shadow-sm"
                                                    title="Hapus"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="bg-white py-24 rounded-[3rem] shadow-xl border border-slate-50 flex flex-col items-center gap-6 text-slate-300">
                        <Receipt size={64} className="opacity-10" />
                        <div className="text-center">
                            <p className="text-[11px] font-black uppercase tracking-[0.4em]">Data Kosong</p>
                            <p className="text-[10px] font-bold opacity-50 uppercase mt-2">Tidak ada transaksi yang cocok</p>
                        </div>
                    </div>
                )}
            </div>

            {/* LOAD MORE */}
            {hasMore && (
                <div className="flex justify-center pt-4">
                    <button
                        onClick={onLoadMore}
                        disabled={isLoadingMore}
                        className="bg-white border-2 border-slate-100 text-slate-500 px-10 py-4 rounded-3xl font-black text-[11px] uppercase tracking-widest hover:border-blue-500 hover:text-blue-600 transition-all shadow-xl shadow-slate-200/50 disabled:opacity-50"
                    >
                        {isLoadingMore ? 'MEMUAT DATA...' : 'MUAT LEBIH BANYAK'}
                    </button>
                </div>
            )}
        </div>
    );
};
