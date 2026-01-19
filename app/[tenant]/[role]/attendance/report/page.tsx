'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useAppStore } from '@/context/StoreContext';
import { UserRole, Attendance, Shift, Tenant } from '@/types';
import { useRouter } from 'next/navigation';
import { 
    Calendar, Download, Search, MapPin, Clock, ArrowRightSquare, 
    ChevronLeft, User, AlertTriangle, Layers
} from 'lucide-react';

export default function AttendanceReportPage() {
    const store = useAppStore();
    const router = useRouter();
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [searchUser, setSearchUser] = useState('');
    const [selectedRecord, setSelectedRecord] = useState<Attendance | null>(null);

    // Initial Security Check (Allow All Authenticated Users)
    useEffect(() => {
        if (store.currentUser) {
            store.fetchAttendance();
            if (!store.users || store.users.length === 0) {
                // store.fetchUsers(); // Removed as it doesn't exist, users come from bootstrap
            }
        }
    }, [store.currentUser]);

    if (!store.currentUser) {
        if (typeof window !== 'undefined') router.replace('/login');
        return null;
    }

    const isStaff = store.currentUser.role === UserRole.STAFF;

    // Filter Logic
    const filteredData = useMemo(() => {
        let data = [...(store.attendance || [])];

        // 0. Role Based Filtering (For Staff)
        if (isStaff) {
             data = data.filter(d => d.userId === store.currentUser?.id);
        }

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

        // 2. User Search (Only for Non-Staff)
        if (!isStaff && searchUser) {
            const lowerQuery = searchUser.toLowerCase();
            data = data.filter(d => {
                const u = store.users.find(u => u.id === d.userId);
                return u?.name?.toLowerCase().includes(lowerQuery);
            });
        }

        // Sort descending: Use createdAt if available (more reliable), otherwise fallback to date string
        return data.sort((a, b) => {
            // Prioritize createdAt timestamp (BigInt/Number)
            const timeA = a.createdAt ? Number(a.createdAt) : new Date(a.date).getTime();
            const timeB = b.createdAt ? Number(b.createdAt) : new Date(b.date).getTime();
            return timeB - timeA;
        });
    }, [store.attendance, startDate, endDate, searchUser, store.users, store.currentUser, isStaff]);

    // Export Logic
    const handleExport = () => {
        const headers = ['Tanggal', 'User ID', 'Nama', 'Strategi', 'Shift', 'Jam Masuk', 'Jam Pulang', 'Status', 'Alasan Terlambat'];
        const rows = filteredData.map(d => {
            const u = store.users.find(u => u.id === d.userId);
            const s = store.shifts.find(sh => sh.id === d.shiftId);
            return [
                d.date,
                d.userId,
                u?.name || 'Unknown',
                store.currentTenant?.workStrategy || 'FIXED',
                s?.name || '-',
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
                        <h1 className="text-3xl font-black text-slate-800 tracking-tight">
                            {isStaff ? 'Riwayat Absensi Saya' : 'Laporan Detail Absensi'}
                        </h1>
                        <p className="text-slate-500 font-bold text-xs uppercase tracking-widest mt-2">
                           {isStaff ? 'Pantau catatan kehadiran pribadi anda' : 'Pantau kehadiran seluruh tim secara lengkap'}
                        </p>
                    </div>
                    <button 
                        onClick={handleExport}
                        className="bg-emerald-600 text-white px-6 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-emerald-700 shadow-xl shadow-emerald-200 transition flex items-center gap-3 w-full md:w-auto justify-center"
                    >
                        <Download size={18} /> Export Data (CSV)
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className={`bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 grid grid-cols-1 ${!isStaff ? 'md:grid-cols-4' : 'md:grid-cols-2'} gap-4`}>
                 {!isStaff && (
                     <div className="relative md:col-span-2">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input 
                            className="w-full bg-slate-50 border-2 border-transparent focus:border-blue-500 rounded-2xl py-3 pl-12 pr-4 text-xs font-bold outline-none transition"
                            placeholder="Cari nama karyawan..."
                            value={searchUser}
                            onChange={e => setSearchUser(e.target.value)}
                        />
                     </div>
                 )}
                 <div className="flex items-center gap-2 bg-slate-50 px-4 py-2 rounded-2xl border border-slate-100">
                     <span className="text-[10px] font-black text-slate-400 shrink-0">DARI</span>
                     <input 
                        type="date" 
                        className="bg-transparent text-xs font-bold outline-none text-slate-600 w-full"
                        value={startDate}
                        onChange={e => setStartDate(e.target.value)}
                     />
                 </div>
                 <div className="flex items-center gap-2 bg-slate-50 px-4 py-2 rounded-2xl border border-slate-100">
                     <span className="text-[10px] font-black text-slate-400 shrink-0">SAMPAI</span>
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
                                <th className="p-6">Shift / Mode</th>
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
                                    
                                    // Safe date parsing to prevent crash
                                    let dateDisplay = 'Unknown';
                                    try {
                                        const d = new Date(record.date);
                                        if (!isNaN(d.getTime())) {
                                            dateDisplay = d.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' });
                                        } else {
                                            dateDisplay = String(record.date).split(',')[0]; // Simple fallback
                                        }
                                    } catch(e) {}

                                    return (
                                        <tr 
                                            key={record.id} 
                                            onClick={() => setSelectedRecord(record)}
                                            className="hover:bg-blue-50/50 cursor-pointer transition-colors group"
                                        >
                                            <td className="p-6 font-mono">{dateDisplay}</td>
                                            <td className="p-6">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 font-black uppercase overflow-hidden border border-white shadow-sm">
                                                        {user?.avatarUrl ? (
                                                            <img src={user.avatarUrl} alt={user.name || 'User'} className="w-full h-full object-cover" />
                                                        ) : (
                                                            (user?.name || user?.username || '?').charAt(0)
                                                        )}
                                                    </div>
                                                    <span className="group-hover:text-blue-600 transition">{user?.name || 'Unknown User'}</span>
                                                </div>
                                            </td>
                                            <td className="p-6">
                                                <div className="flex flex-col gap-1">
                                                    <span className="text-[10px] uppercase font-black text-slate-400 tracking-tight">
                                                        {store.shifts.find(s => s.id === record.shiftId)?.name || store.currentTenant?.workStrategy || 'FIXED'}
                                                    </span>
                                                    {record.shiftId && (
                                                        <span className="text-[9px] font-mono text-slate-400">
                                                            ({store.shifts.find(s => s.id === record.shiftId)?.startTime} - {store.shifts.find(s => s.id === record.shiftId)?.endTime})
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="p-6 text-emerald-600">{record.timeIn || '--:--'}</td>
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

            {/* RESPONSIVE DETAIL MODAL */}
            {selectedRecord && (
                <div onClick={() => setSelectedRecord(null)} className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4 animate-in fade-in duration-300">
                    <div 
                        onClick={e => e.stopPropagation()} 
                        className="bg-white/90 backdrop-blur-xl w-full max-w-5xl rounded-[2.5rem] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300 flex flex-col md:flex-row max-h-[90vh] border border-white/20"
                    >
                        {/* LEFT: VISUAL EVIDENCE (Scrollable if needed on mobile) */}
                        <div className="md:w-5/12 bg-slate-950 p-6 md:p-8 flex flex-col gap-6 overflow-y-auto custom-scrollbar">
                            <div className="flex items-center justify-between md:hidden pb-4 border-b border-white/10">
                                <h3 className="text-white font-black text-xs uppercase tracking-widest">Detail Absensi</h3>
                                <button onClick={() => setSelectedRecord(null)} className="text-white/50 hover:text-white">
                                    <ChevronLeft size={24} />
                                </button>
                            </div>

                            {/* Photo Grid Logic */}
                            <div className={`grid gap-4 ${selectedRecord.checkOutSelfieUrl ? 'grid-cols-2 md:grid-cols-1' : 'grid-cols-1'}`}>
                                {/* Check In Photo */}
                                <div className="space-y-3">
                                    <div className="flex items-center gap-2 text-emerald-400">
                                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                        <span className="text-[10px] font-black uppercase tracking-[0.2em]">CHECK IN</span>
                                    </div>
                                    <div className="aspect-[3/4] rounded-[1.5rem] overflow-hidden border-2 border-white/10 relative group shadow-2xl bg-slate-900">
                                        <img 
                                            src={selectedRecord.selfieUrl} 
                                            alt="Check In" 
                                            className="w-full h-full object-cover transition duration-700 group-hover:scale-110 opacity-90 group-hover:opacity-100" 
                                        />
                                        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent p-4">
                                            <p className="text-white font-mono text-xs font-bold">{selectedRecord.timeIn}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Check Out Photo */}
                                {selectedRecord.checkOutSelfieUrl && (
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-2 text-rose-400">
                                            <div className="w-2 h-2 rounded-full bg-rose-500" />
                                            <span className="text-[10px] font-black uppercase tracking-[0.2em]">CHECK OUT</span>
                                        </div>
                                        <div className="aspect-[3/4] rounded-[1.5rem] overflow-hidden border-2 border-white/10 relative group shadow-2xl bg-slate-900">
                                            <img 
                                                src={selectedRecord.checkOutSelfieUrl} 
                                                alt="Check Out" 
                                                className="w-full h-full object-cover transition duration-700 group-hover:scale-110 opacity-90 group-hover:opacity-100" 
                                            />
                                            <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent p-4">
                                                <p className="text-white font-mono text-xs font-bold">{selectedRecord.timeOut}</p>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {!selectedRecord.checkOutSelfieUrl && (
                                <div className="p-4 rounded-2xl bg-white/5 border border-white/10 text-center">
                                    <p className="text-slate-500 text-[10px] uppercase tracking-widest font-bold">Belum Check-Out</p>
                                </div>
                            )}
                        </div>

                         {/* RIGHT: DATA CONTEXT */}
                         <div className="md:w-7/12 p-6 md:p-10 flex flex-col h-full bg-white/50 backdrop-blur-sm relative">
                             {/* Desktop Close Button */}
                             <button 
                                onClick={() => setSelectedRecord(null)}
                                className="hidden md:flex absolute top-6 right-6 w-10 h-10 bg-slate-100 hover:bg-rose-100 hover:text-rose-600 rounded-full items-center justify-center transition"
                             >
                                 <ChevronLeft className="rotate-180" size={20} />
                             </button>

                             <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-8">
                                 {/* User Header */}
                                 <div className="border-b border-slate-100 pb-6">
                                     <div className="flex items-center gap-4 mb-2">
                                         <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-black text-lg shadow-lg shadow-blue-200">
                                             {store.users.find(u => u.id === selectedRecord.userId)?.name?.charAt(0) || '?'}
                                         </div>
                                         <div>
                                            <h3 className="text-2xl font-black text-slate-800 tracking-tight leading-none">
                                                {store.users.find(u => u.id === selectedRecord.userId)?.name || 'Unknown User'}
                                            </h3>
                                            <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px] mt-1">
                                                Staff ID: {selectedRecord.userId}
                                            </p>
                                         </div>
                                     </div>
                                     <div className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 rounded-lg text-slate-500 font-bold text-xs mt-2">
                                         <Calendar size={14} />
                                         {new Date(selectedRecord.date).toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                                     </div>
                                 </div>

                                 {/* Shift Context Card */}
                                 {selectedRecord.shiftId && (
                                     <div className="p-5 rounded-[2rem] bg-purple-50 border border-purple-100">
                                         <p className="text-[10px] font-black uppercase tracking-widest mb-1 text-purple-400">DETAIL SHIFT</p>
                                         <div className="flex items-center justify-between">
                                            <p className="text-lg font-black text-purple-600">
                                                {store.shifts.find(s => s.id === selectedRecord.shiftId)?.name}
                                            </p>
                                            <div className="text-right">
                                                <p className="text-[10px] font-black text-purple-400">JADWAL</p>
                                                <p className="text-xs font-mono font-bold text-purple-600">
                                                    {store.shifts.find(s => s.id === selectedRecord.shiftId)?.startTime} - {store.shifts.find(s => s.id === selectedRecord.shiftId)?.endTime}
                                                </p>
                                            </div>
                                         </div>
                                     </div>
                                 )}

                                 <div className="grid grid-cols-2 gap-4">
                                     <div className={`p-5 rounded-[2rem] border ${selectedRecord.isLate ? 'bg-rose-50 border-rose-100' : 'bg-emerald-50 border-emerald-100'}`}>
                                         <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${selectedRecord.isLate ? 'text-rose-400' : 'text-emerald-400'}`}>STATUS KEHADIRAN</p>
                                         <p className={`text-lg font-black ${selectedRecord.isLate ? 'text-rose-600' : 'text-emerald-600'}`}>
                                             {selectedRecord.isLate ? 'TERLAMBAT' : 'TEPAT WAKTU'}
                                         </p>
                                     </div>
                                     <div className="p-5 rounded-[2rem] bg-indigo-50 border border-indigo-100">
                                         <p className="text-[10px] font-black uppercase tracking-widest mb-1 text-indigo-400">TOTAL DURASI</p>
                                         <p className="text-lg font-black text-indigo-600">
                                             {(() => {
                                                 const tIn = selectedRecord.timeIn;
                                                 const tOut = selectedRecord.timeOut;
                                                 
                                                 if (!tIn || !tOut || tOut === '-') return '-';
                                                 
                                                 const parseMinutes = (timeStr: string) => {
                                                     if (!timeStr) return null;
                                                     const normalized = timeStr.toString().replace(/\./g, ':');
                                                     const clean = normalized.replace(/[^\d:]/g, '');
                                                     const parts = clean.split(':');
                                                     if (parts.length < 2) return null;
                                                     const h = parseInt(parts[0], 10);
                                                     const m = parseInt(parts[1], 10);
                                                     if (isNaN(h) || isNaN(m)) return null;
                                                     return h * 60 + m;
                                                 };

                                                 const startTotal = parseMinutes(tIn);
                                                 const endTotal = parseMinutes(tOut);

                                                 if (startTotal === null || endTotal === null) return '-';

                                                 let diff = endTotal - startTotal;
                                                 if (diff < 0) diff += 24 * 60; 

                                                 const hours = Math.floor(diff / 60);
                                                 const mins = diff % 60;
                                                 return `${hours}j ${mins}m`;
                                             })()}
                                         </p>
                                     </div>
                                 </div>

                                 {/* Location Intel */}
                                 <div className="space-y-3">
                                     <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                         <MapPin size={12} /> TITIK LOKASI
                                     </h5>
                                     <div className="p-1 rounded-[2rem] border border-slate-200 bg-slate-50">
                                        <div className="bg-white rounded-[1.7rem] p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                                            <div className="flex items-center gap-3 text-slate-600">
                                                <div className="p-2 bg-slate-100 rounded-full">
                                                    <MapPin size={16} />
                                                </div>
                                                <div>
                                                    <p className="text-[10px] font-mono text-slate-400">LATITUDE / LONGITUDE</p>
                                                    <p className="text-xs font-bold font-mono">{selectedRecord.location.lat.toFixed(6)}, {selectedRecord.location.lng.toFixed(6)}</p>
                                                </div>
                                            </div>
                                            <a 
                                                href={`https://www.google.com/maps/search/?api=1&query=${selectedRecord.location.lat},${selectedRecord.location.lng}`} 
                                                target="_blank"
                                                className="w-full sm:w-auto px-6 py-3 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 transition shadow-lg text-center"
                                            >
                                                Buka Peta
                                            </a>
                                        </div>
                                     </div>
                                 </div>

                                 {/* Late Reason */}
                                 {selectedRecord.isLate && (
                                     <div className="p-5 bg-rose-50 rounded-[2rem] border border-rose-100">
                                         <div className="flex items-center gap-2 text-rose-600 mb-2">
                                             <AlertTriangle size={16} />
                                             <span className="text-[10px] font-black uppercase tracking-widest">ALASAN KETERLAMBATAN</span>
                                         </div>
                                         <p className="text-sm font-medium text-rose-800 italic leading-relaxed">
                                             "{selectedRecord.lateReason}"
                                         </p>
                                     </div>
                                 )}
                             </div>
                             
                             {/* Footer Context */}
                             <div className="pt-6 border-t border-slate-100 mt-auto">
                                <p className="text-[10px] text-center text-slate-400">
                                    Data ini diverifikasi oleh sistem pada {new Date(selectedRecord.date).toLocaleDateString()}
                                </p>
                             </div>
                         </div>
                    </div>
                </div>
            )}
        </div>
    );
}
