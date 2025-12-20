'use client';

import React, { useState, useMemo } from 'react';
import { useAppStore } from '../../../../src/context/StoreContext';
import { UserRole, Attendance } from '../../../../src/types';
import { useRouter } from 'next/navigation';
import { 
    Calendar, Download, Search, MapPin, Clock, ArrowRightSquare, 
    ChevronLeft, User, AlertTriangle
} from 'lucide-react';

export default function AttendanceReportPage() {
    const store = useAppStore();
    const router = useRouter();
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [searchUser, setSearchUser] = useState('');
    const [selectedRecord, setSelectedRecord] = useState<Attendance | null>(null);

    // Security Check
    if (store.currentUser?.role !== UserRole.OWNER && store.currentUser?.role !== UserRole.FINANCE) {
        if (typeof window !== 'undefined') router.replace('/login');
        return null;
    }

    // Filter Logic
    const filteredData = useMemo(() => {
        let data = [...(store.attendance || [])];

        // 1. Date Range
        if (startDate) {
            const start = new Date(startDate);
            start.setHours(0,0,0,0);
            data = data.filter(d => new Date(d.date).getTime() >= start.getTime());
        }
        if (endDate) {
            const end = new Date(endDate);
            end.setHours(23,59,59,999);
            data = data.filter(d => new Date(d.date).getTime() <= end.getTime());
        }

        // 2. User Search
        if (searchUser) {
            const lowerQuery = searchUser.toLowerCase();
            data = data.filter(d => {
                const u = store.users.find(u => u.id === d.userId);
                return u?.name.toLowerCase().includes(lowerQuery);
            });
        }

        // Sort descending by date
        return data.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [store.attendance, startDate, endDate, searchUser, store.users]);

    // Export Logic
    const handleExport = () => {
        const headers = ['Tanggal', 'User ID', 'Nama', 'Jam Masuk', 'Jam Pulang', 'Status', 'Alasan Terlambat'];
        const rows = filteredData.map(d => {
            const u = store.users.find(u => u.id === d.userId);
            return [
                d.date,
                d.userId,
                u?.name || 'Unknown',
                d.timeIn,
                d.timeOut || '-',
                d.isLate ? 'TERLAMBAT' : 'TEPAT WAKTU',
                d.lateReason || '-'
            ];
        });

        const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `attendance_report_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="min-h-screen bg-slate-50 p-6 md:p-10 space-y-8 pb-20">
            {/* Header */}
            <div className="flex flex-col gap-4">
                <button 
                  onClick={() => router.back()} 
                  className="self-start flex items-center gap-2 text-slate-400 hover:text-slate-600 transition text-[10px] font-black uppercase tracking-widest"
                >
                    <ChevronLeft size={16} /> Kembali
                </button>
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-black text-slate-800 tracking-tight">Laporan Detail Absensi</h1>
                        <p className="text-slate-500 font-bold text-xs uppercase tracking-widest mt-2">
                           Pantau kehadiran tim secara lengkap
                        </p>
                    </div>
                    <button 
                        onClick={handleExport}
                        className="bg-emerald-600 text-white px-6 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-emerald-700 shadow-xl shadow-emerald-200 transition flex items-center gap-3"
                    >
                        <Download size={18} /> Export Data (CSV)
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 grid grid-cols-1 md:grid-cols-4 gap-4">
                 <div className="relative md:col-span-2">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input 
                        className="w-full bg-slate-50 border-2 border-transparent focus:border-blue-500 rounded-2xl py-3 pl-12 pr-4 text-xs font-bold outline-none transition"
                        placeholder="Cari nama karyawan..."
                        value={searchUser}
                        onChange={e => setSearchUser(e.target.value)}
                    />
                 </div>
                 <div className="flex items-center gap-2 bg-slate-50 px-4 py-2 rounded-2xl border border-slate-100">
                     <span className="text-[10px] font-black text-slate-400">DARI</span>
                     <input 
                        type="date" 
                        className="bg-transparent text-xs font-bold outline-none text-slate-600 w-full"
                        value={startDate}
                        onChange={e => setStartDate(e.target.value)}
                     />
                 </div>
                 <div className="flex items-center gap-2 bg-slate-50 px-4 py-2 rounded-2xl border border-slate-100">
                     <span className="text-[10px] font-black text-slate-400">SAMPAI</span>
                     <input 
                        type="date" 
                        className="bg-transparent text-xs font-bold outline-none text-slate-600 w-full"
                        value={endDate}
                        onChange={e => setEndDate(e.target.value)}
                     />
                 </div>
            </div>

            {/* Table Area */}
            <div className="bg-white rounded-[2.5rem] shadow-xl border border-slate-100 overflow-hidden min-h-[500px]">
                <div className="overflow-x-auto remove-scrollbar">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 text-slate-400 text-[10px] font-black uppercase tracking-widest border-b border-slate-100">
                                <th className="p-6">Tanggal</th>
                                <th className="p-6">Nama Pegawai</th>
                                <th className="p-6">Jam Masuk</th>
                                <th className="p-6">Jam Pulang</th>
                                <th className="p-6 text-center">Status</th>
                                <th className="p-6 text-center">Detail</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 text-xs font-bold text-slate-600">
                            {filteredData.length > 0 ? (
                                filteredData.map(record => {
                                    const user = store.users.find(u => u.id === record.userId);
                                    return (
                                        <tr 
                                            key={record.id} 
                                            onClick={() => setSelectedRecord(record)}
                                            className="hover:bg-blue-50/50 cursor-pointer transition-colors group"
                                        >
                                            <td className="p-6 font-mono">{new Date(record.date).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' })}</td>
                                            <td className="p-6">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 font-black uppercase">
                                                        {user?.name.charAt(0)}
                                                    </div>
                                                    <span className="group-hover:text-blue-600 transition">{user?.name}</span>
                                                </div>
                                            </td>
                                            <td className="p-6 text-emerald-600">{record.timeIn}</td>
                                            <td className="p-6 text-rose-600">{record.timeOut || '-'}</td>
                                            <td className="p-6 text-center">
                                                <span className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest ${record.isLate ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-600'}`}>
                                                    {record.isLate ? 'TERLAMBAT' : 'TEPAT WAKTU'}
                                                </span>
                                            </td>
                                            <td className="p-6 text-center">
                                                <button className="p-2 rounded-full bg-slate-100 text-slate-400 group-hover:bg-blue-600 group-hover:text-white transition shadow-sm">
                                                    <ArrowRightSquare size={16} />
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })
                            ) : (
                                <tr>
                                    <td colSpan={6} className="p-20 text-center text-slate-400 flex flex-col items-center justify-center">
                                        <Calendar size={48} className="mb-4 opacity-20" />
                                        <p>Tidak ada data absensi ditemukan pada rentang ini.</p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* DETAIL MODAL */}
            {selectedRecord && (
                <div onClick={() => setSelectedRecord(null)} className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/90 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div onClick={e => e.stopPropagation()} className="bg-white w-full max-w-4xl rounded-[3rem] overflow-hidden shadow-2xl animate-in zoom-in duration-300 flex flex-col md:flex-row max-h-[90vh]">
                        {/* Left: Photos */}
                        <div className="md:w-1/2 bg-slate-900 p-8 flex flex-col justify-center space-y-6">
                            <div className="space-y-4">
                                <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">FOTO MASUK (CHECK-IN)</h4>
                                <div className="aspect-[4/5] bg-slate-800 rounded-[2rem] overflow-hidden border-4 border-slate-700 shadow-xl relative group">
                                    <img src={selectedRecord.selfieUrl} alt="Check In Selfie" className="w-full h-full object-cover transition duration-700 group-hover:scale-110" />
                                    <div className="absolute top-4 left-4 bg-emerald-500 text-white px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest shadow-lg">
                                        {selectedRecord.timeIn}
                                    </div>
                                </div>
                            </div>
                            {selectedRecord.checkOutSelfieUrl && (
                                <div className="space-y-4">
                                    <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">FOTO PULANG (CHECK-OUT)</h4>
                                    <div className="aspect-[4/5] bg-slate-800 rounded-[2rem] overflow-hidden border-4 border-slate-700 shadow-xl relative group">
                                        <img src={selectedRecord.checkOutSelfieUrl} alt="Check Out Selfie" className="w-full h-full object-cover transition duration-700 group-hover:scale-110" />
                                        <div className="absolute top-4 left-4 bg-rose-500 text-white px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest shadow-lg">
                                            {selectedRecord.timeOut}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                         {/* Right: Info */}
                         <div className="md:w-1/2 p-8 md:p-12 overflow-y-auto custom-scrollbar space-y-8">
                             <div>
                                 <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tight mb-1">
                                    {store.users.find(u => u.id === selectedRecord.userId)?.name}
                                 </h3>
                                 <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">
                                     {new Date(selectedRecord.date).toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                                 </p>
                             </div>

                             <div className="space-y-6">
                                 <div className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100 space-y-4">
                                     <div className="flex items-start gap-4">
                                         <Clock className="mt-1 text-blue-500" />
                                         <div>
                                             <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">DURASI KERJA</h5>
                                             <p className="text-sm font-black text-slate-700">
                                                 {selectedRecord.timeOut ? 'Selesai Bekerja' : 'Sedang Bekerja'}
                                             </p>
                                             <p className="text-xs text-slate-500 mt-1">
                                                 In: {selectedRecord.timeIn} — Out: {selectedRecord.timeOut || '?'}
                                             </p>
                                         </div>
                                     </div>
                                 </div>

                                 <div className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100 space-y-4">
                                     <div className="flex items-start gap-4">
                                         <MapPin className="mt-1 text-rose-500" />
                                         <div className="w-full">
                                             <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">LOKASI CHECK-IN</h5>
                                             <div className="bg-white p-3 rounded-xl border border-slate-200 font-mono text-[10px] text-slate-500 break-all mb-2">
                                                 {selectedRecord.location.lat}, {selectedRecord.location.lng}
                                             </div>
                                             <a 
                                                href={`https://www.google.com/maps/search/?api=1&query=${selectedRecord.location.lat},${selectedRecord.location.lng}`} 
                                                target="_blank"
                                                className="block w-full text-center py-3 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 transition shadow-lg shadow-blue-200"
                                             >
                                                 LIHAT DI GOOGLE MAPS
                                             </a>
                                         </div>
                                     </div>
                                 </div>

                                 {selectedRecord.isLate && (
                                     <div className="p-6 bg-rose-50 rounded-[2rem] border border-rose-100 space-y-2">
                                         <div className="flex items-center gap-2 text-rose-600">
                                             <AlertTriangle size={18} />
                                             <span className="text-xs font-black uppercase tracking-widest">CATATAN KETERLAMBATAN</span>
                                         </div>
                                         <p className="text-sm font-bold text-rose-800 italic">"{selectedRecord.lateReason}"</p>
                                     </div>
                                 )}
                             </div>
                             
                             <button onClick={() => setSelectedRecord(null)} className="w-full py-5 text-slate-400 font-black uppercase text-xs tracking-[0.2em] hover:bg-slate-50 rounded-2xl transition">
                                 TUTUP DETAIL
                             </button>
                         </div>
                    </div>
                </div>
            )}
        </div>
    );
}
