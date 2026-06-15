'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useAppStore } from '@/context/StoreContext';
import { UserRole, Attendance as AttendanceType } from '@/types';
import { useRouter } from 'next/navigation';
import {
  Calendar, Download, Search, ChevronLeft, ChevronDown, ChevronRight,
  Loader2, AlertTriangle, User as UserIcon, MapPin, ArrowRightSquare,
  BarChart3, List, Users
} from 'lucide-react';

// --- Types ---
interface ReportUser {
  userId: string;
  nama: string;
  jabatan: string;
  role: string;
  hadir: number;
  izin: number;
  absen: number;
  terlambat: number;
  tanggalHadir: string[];
  tanggalIzin: string[];
  totalWorkdays: number;
}

interface ReportData {
  totalWorkdays: number;
  startDate: string;
  endDate: string;
  users: ReportUser[];
}

// --- Helpers ---
function formatDateIndonesian(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' });
}

function escapeCSV(val: string): string {
  if (/^[=+\-@]/.test(val)) return "'" + val;
  return val;
}

function getDefaultDateRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const y = start.getFullYear();
  const m = String(start.getMonth() + 1).padStart(2, '0');
  const d = String(start.getDate()).padStart(2, '0');
  const ey = now.getFullYear();
  const em = String(now.getMonth() + 1).padStart(2, '0');
  const ed = String(now.getDate()).padStart(2, '0');
  return { start: `${y}-${m}-${d}`, end: `${ey}-${em}-${ed}` };
}

// --- Component ---
export default function AttendanceReportPage() {
  const store = useAppStore();
  const router = useRouter();
  const defaultRange = getDefaultDateRange();

  const [startDate, setStartDate] = useState(defaultRange.start);
  const [endDate, setEndDate] = useState(defaultRange.end);
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRecord, setSelectedRecord] = useState<AttendanceType | null>(null);
  const [activeTab, setActiveTab] = useState<'summary' | 'detail'>('summary');

  // Security & access check
  const isStaffOnly = store.currentUser?.role === UserRole.STAFF && !store.currentUser?.isKaizenMaster;

  const fetchReport = useCallback(async (start: string, end: string) => {
    if (!store.fetchAttendanceReport) {
      throw new Error('fetchAttendanceReport tidak tersedia');
    }
    return store.fetchAttendanceReport(start, end);
  }, [store.fetchAttendanceReport]);

  const loadReport = useCallback(async () => {
    if (!startDate || !endDate) {
      setError('Mohon isi tanggal mulai dan tanggal akhir.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      // Load both summary report and raw attendance data
      const [reportData] = await Promise.all([
        fetchReport(startDate, endDate),
        store.fetchAttendance ? store.fetchAttendance() : Promise.resolve()
      ]);
      setReport(reportData);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Gagal memuat laporan.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, fetchReport, store.fetchAttendance]);

  // Auto-load on mount
  useEffect(() => {
    if (store.currentUser) {
      loadReport();
    }
  }, []);

  if (!store.currentUser) {
    if (typeof window !== 'undefined') router.replace('/login');
    return null;
  }

  const filteredUsers = (report?.users || []).filter(u => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return u.nama.toLowerCase().includes(q) || u.jabatan.toLowerCase().includes(q);
  });

  // Detail attendance list filtered by date range + search + role
  const filteredAttendance = useMemo(() => {
    let data = [...(store.attendance || [])];

    // Role-based filtering
    if (isStaffOnly) {
      data = data.filter(d => d.userId === store.currentUser?.id);
    } else {
      // Exclude OWNER/SUPERADMIN and inactive users from detail list
      const excludeUserIds = store.users
        .filter(u => u.role === 'OWNER' || u.role === 'SUPERADMIN' || u.isActive === false)
        .map(u => u.id);
      if (excludeUserIds.length > 0) {
        data = data.filter(d => !excludeUserIds.includes(d.userId));
      }
    }

    // Date range
    if (startDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      data = data.filter(d => new Date(d.date).getTime() >= start.getTime());
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      data = data.filter(d => new Date(d.date).getTime() <= end.getTime());
    }

    // User search
    if (!isStaffOnly && searchQuery) {
      const lowerQuery = searchQuery.toLowerCase();
      data = data.filter(d => {
        const u = store.users.find(u => u.id === d.userId);
        return u?.name?.toLowerCase().includes(lowerQuery);
      });
    }

    // Sort descending by date/createdAt
    return data.sort((a, b) => {
      const timeA = a.createdAt ? Number(a.createdAt) : new Date(a.date).getTime();
      const timeB = b.createdAt ? Number(b.createdAt) : new Date(b.date).getTime();
      return timeB - timeA;
    });
  }, [store.attendance, startDate, endDate, searchQuery, store.users, store.currentUser, isStaffOnly]);

  const handleExportCSV = () => {
    if (!report?.users.length) return;
    const headers = ['Nama', 'Jabatan', 'Role', 'Hadir', 'Izin', 'Terlambat', 'Absen', 'Total Hari Kerja', 'Persentase Kehadiran'];
    const rows = report.users.map(u => {
      const pct = u.totalWorkdays > 0 ? Math.round((u.hadir / u.totalWorkdays) * 100) : 0;
      return [
        escapeCSV(u.nama),
        escapeCSV(u.jabatan),
        escapeCSV(u.role),
        u.hadir,
        u.izin,
        u.terlambat,
        u.absen,
        u.totalWorkdays,
        `${pct}%`
      ];
    });
    const csvContent = [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `laporan_absensi_${startDate}_sd_${endDate}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Export detailed attendance CSV
  const handleExportDetailCSV = () => {
    if (!filteredAttendance.length) return;
    const headers = ['Tanggal', 'Nama', 'Shift', 'Jam Masuk', 'Jam Pulang', 'Status', 'Alasan Terlambat'];
    const rows = filteredAttendance.map(d => {
      const u = store.users.find(u => u.id === d.userId);
      const s = store.shifts.find(sh => sh.id === d.shiftId);
      return [
        d.date,
        u?.name || 'Unknown',
        s?.name || store.currentTenant?.workStrategy || 'FIXED',
        d.timeIn,
        d.timeOut || '-',
        d.isLate ? 'TERLAMBAT' : 'TEPAT WAKTU',
        d.lateReason || '-'
      ];
    });
    const csvContent = [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `detail_absensi_${startDate}_sd_${endDate}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-10 space-y-6 pb-20">
      {/* Back Button */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-2 text-slate-400 hover:text-slate-600 transition text-[10px] font-black uppercase tracking-widest"
      >
        <ChevronLeft size={16} /> Kembali
      </button>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight">
            {isStaffOnly ? 'Riwayat Absensi Saya' : 'Laporan Absensi'}
          </h1>
          <p className="text-slate-500 font-bold text-xs uppercase tracking-widest mt-1">
            {isStaffOnly ? 'Pantau catatan kehadiran pribadi anda' : 'Ringkasan & detail kehadiran seluruh tim'}
          </p>
        </div>
        <button
          onClick={activeTab === 'summary' ? handleExportCSV : handleExportDetailCSV}
          disabled={activeTab === 'summary' ? !report?.users.length : !filteredAttendance.length}
          className="bg-emerald-600 text-white px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-emerald-700 shadow-lg shadow-emerald-200 transition flex items-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed self-start"
        >
          <Download size={16} /> {activeTab === 'summary' ? 'Export Ringkasan' : 'Export Detail'} (CSV)
        </button>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white p-2 rounded-2xl shadow-sm border border-slate-100 inline-flex gap-1">
        <button
          onClick={() => setActiveTab('summary')}
          className={`flex items-center gap-2 px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all duration-200 ${
            activeTab === 'summary'
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-200'
              : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
          }`}
        >
          <BarChart3 size={16} />
          Ringkasan
        </button>
        <button
          onClick={() => setActiveTab('detail')}
          className={`flex items-center gap-2 px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all duration-200 ${
            activeTab === 'detail'
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-200'
              : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
          }`}
        >
          <List size={16} />
          Detail Absensi
        </button>
      </div>

      {/* Date Filter Bar */}
      <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Dari Tanggal</label>
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="bg-slate-50 border-2 border-transparent focus:border-blue-500 rounded-2xl py-3 px-4 text-xs font-bold outline-none transition w-full"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sampai Tanggal</label>
            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="bg-slate-50 border-2 border-transparent focus:border-blue-500 rounded-2xl py-3 px-4 text-xs font-bold outline-none transition w-full"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={loadReport}
              disabled={loading}
              className="bg-blue-600 text-white px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-blue-700 shadow-lg shadow-blue-200 transition flex items-center gap-2 disabled:opacity-50"
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Calendar size={14} />}
              {loading ? 'Memuat...' : 'Tampilkan'}
            </button>
          </div>
          {!isStaffOnly && (
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                className="w-full bg-slate-50 border-2 border-transparent focus:border-blue-500 rounded-2xl py-3 pl-11 pr-4 text-xs font-bold outline-none transition"
                placeholder="Cari nama karyawan..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
          )}
        </div>
        {report && (
          <p className="text-[10px] font-bold text-slate-400 mt-4 text-center">
            Periode: {formatDateIndonesian(report.startDate)} — {formatDateIndonesian(report.endDate)} &nbsp;|&nbsp; Total Hari Kerja: {report.totalWorkdays} hari
          </p>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 p-4 rounded-2xl flex items-center gap-3 text-xs font-bold">
          <AlertTriangle size={16} />
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 p-20 flex flex-col items-center justify-center text-slate-400 gap-4">
          <Loader2 size={48} className="animate-spin opacity-30" />
          <p className="text-xs font-black uppercase tracking-widest">Memuat laporan...</p>
        </div>
      )}

      {/* ========================================= */}
      {/* SECTION 1: RINGKASAN PER-USER (SUMMARY)   */}
      {/* ========================================= */}
      {activeTab === 'summary' && (
        <>
      {/* Summary Cards */}
      {!loading && report && filteredUsers.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 text-center">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Total Karyawan</p>
            <p className="text-2xl font-black text-slate-700 mt-1">{filteredUsers.length}</p>
          </div>
          <div className="bg-white rounded-2xl border border-emerald-100 shadow-sm p-5 text-center">
            <p className="text-[9px] font-black text-emerald-500 uppercase tracking-widest">Total Hadir</p>
            <p className="text-2xl font-black text-emerald-600 mt-1">
              {filteredUsers.reduce((s, u) => s + u.hadir, 0)}
            </p>
          </div>
          <div className="bg-white rounded-2xl border border-amber-100 shadow-sm p-5 text-center">
            <p className="text-[9px] font-black text-amber-500 uppercase tracking-widest">Total Izin</p>
            <p className="text-2xl font-black text-amber-600 mt-1">
              {filteredUsers.reduce((s, u) => s + u.izin, 0)}
            </p>
          </div>
          <div className="bg-white rounded-2xl border border-orange-100 shadow-sm p-5 text-center">
            <p className="text-[9px] font-black text-orange-500 uppercase tracking-widest">Total Terlambat</p>
            <p className="text-2xl font-black text-orange-600 mt-1">
              {filteredUsers.reduce((s, u) => s + (u.terlambat || 0), 0)}
            </p>
          </div>
          <div className="bg-white rounded-2xl border border-rose-100 shadow-sm p-5 text-center">
            <p className="text-[9px] font-black text-rose-500 uppercase tracking-widest">Total Absen</p>
            <p className="text-2xl font-black text-rose-600 mt-1">
              {filteredUsers.reduce((s, u) => s + u.absen, 0)}
            </p>
          </div>
        </div>
      )}

      {/* Summary Table (per-user) */}
      {!loading && report && (
        <div className="bg-white rounded-[2.5rem] shadow-xl border border-slate-100 overflow-hidden">
          <div className="px-6 pt-5 pb-3 border-b border-slate-100">
            <h3 className="text-sm font-black text-slate-700 uppercase tracking-widest">Ringkasan Per Karyawan</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-400 text-[10px] font-black uppercase tracking-widest border-b border-slate-100">
                  <th className="p-5 w-10"></th>
                  <th className="p-5">Nama</th>
                  <th className="p-5 hidden md:table-cell">Jabatan</th>
                  <th className="p-5 text-center">Hadir</th>
                  <th className="p-5 text-center">Izin</th>
                  <th className="p-5 text-center">Terlambat</th>
                  <th className="p-5 text-center">Absen</th>
                  <th className="p-5 text-center hidden md:table-cell">%</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 text-xs font-bold text-slate-600">
                {filteredUsers.length > 0 ? (
                  filteredUsers.map(u => {
                    const isExpanded = expandedUser === u.userId;
                    const pct = u.totalWorkdays > 0 ? Math.round((u.hadir / u.totalWorkdays) * 100) : 0;
                    const pctColor = pct >= 80 ? 'text-emerald-600 bg-emerald-50' : pct >= 60 ? 'text-amber-600 bg-amber-50' : 'text-rose-600 bg-rose-50';
                    return (
                      <React.Fragment key={u.userId}>
                        <tr
                          onClick={() => setExpandedUser(isExpanded ? null : u.userId)}
                          className="hover:bg-blue-50/50 cursor-pointer transition-colors group"
                        >
                          <td className="p-5">
                            <div className="text-slate-400 group-hover:text-blue-600 transition">
                              {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                            </div>
                          </td>
                          <td className="p-5">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 font-black uppercase text-[10px] overflow-hidden border border-white shadow-sm">
                                <UserIcon size={14} />
                              </div>
                              <div>
                                <span className="group-hover:text-blue-600 transition font-bold">{u.nama}</span>
                                <span className="block text-[9px] text-slate-400 font-normal md:hidden">{u.jabatan}</span>
                              </div>
                            </div>
                          </td>
                          <td className="p-5 hidden md:table-cell text-slate-500">{u.jabatan}</td>
                          <td className="p-5 text-center"><span className="px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest bg-emerald-100 text-emerald-600">{u.hadir}</span></td>
                          <td className="p-5 text-center"><span className="px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest bg-amber-100 text-amber-600">{u.izin}</span></td>
                          <td className="p-5 text-center"><span className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest ${u.terlambat > 0 ? 'bg-orange-100 text-orange-600' : 'bg-slate-100 text-slate-400'}`}>{u.terlambat || 0}</span></td>
                          <td className="p-5 text-center"><span className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest ${u.absen > 0 ? 'bg-rose-100 text-rose-600' : 'bg-slate-100 text-slate-400'}`}>{u.absen}</span></td>
                          <td className="p-5 text-center hidden md:table-cell"><span className={`px-3 py-1.5 rounded-lg text-[10px] font-black ${pctColor}`}>{pct}%</span></td>
                        </tr>
                        {isExpanded && (
                          <tr key={`${u.userId}-detail`}>
                            <td colSpan={8} className="p-0 bg-slate-50/50">
                              <div className="px-6 py-5 grid grid-cols-1 md:grid-cols-3 gap-5 animate-in fade-in duration-200">
                                <div>
                                  <h4 className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-emerald-500" /> Hadir ({u.hadir} hari)
                                  </h4>
                                  {u.tanggalHadir.length > 0 ? (
                                    <div className="flex flex-wrap gap-1.5">
                                      {u.tanggalHadir.map(d => (
                                        <span key={d} className="px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-lg text-[10px] font-mono font-bold border border-emerald-100">{formatDateIndonesian(d)}</span>
                                      ))}
                                    </div>
                                  ) : (<p className="text-[10px] text-slate-400 italic">Tidak ada data hadir</p>)}
                                </div>
                                <div>
                                  <h4 className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-amber-500" /> Izin ({u.izin} hari)
                                  </h4>
                                  {u.tanggalIzin.length > 0 ? (
                                    <div className="flex flex-wrap gap-1.5">
                                      {u.tanggalIzin.map(d => (
                                        <span key={d} className="px-2.5 py-1 bg-amber-50 text-amber-700 rounded-lg text-[10px] font-mono font-bold border border-amber-100">{formatDateIndonesian(d)}</span>
                                      ))}
                                    </div>
                                  ) : (<p className="text-[10px] text-slate-400 italic">Tidak ada data izin</p>)}
                                </div>
                                <div className="bg-white rounded-2xl border border-slate-100 p-4 space-y-3">
                                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ringkasan {u.nama}</h4>
                                  <div className="grid grid-cols-2 gap-2">
                                    <div className="bg-emerald-50 rounded-xl p-3 text-center"><p className="text-lg font-black text-emerald-600">{pct}%</p><p className="text-[8px] font-black text-emerald-400 uppercase">Kehadiran</p></div>
                                    <div className="bg-slate-50 rounded-xl p-3 text-center"><p className="text-lg font-black text-slate-600">{u.totalWorkdays}</p><p className="text-[8px] font-black text-slate-400 uppercase">Hari Kerja</p></div>
                                    <div className="bg-orange-50 rounded-xl p-3 text-center"><p className="text-lg font-black text-orange-600">{u.terlambat || 0}</p><p className="text-[8px] font-black text-orange-400 uppercase">Terlambat</p></div>
                                    <div className="bg-rose-50 rounded-xl p-3 text-center"><p className="text-lg font-black text-rose-600">{u.absen}</p><p className="text-[8px] font-black text-rose-400 uppercase">Tanpa Ket.</p></div>
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                ) : (
                  <tr><td colSpan={8} className="p-20 text-center text-slate-400"><div className="flex flex-col items-center gap-3"><Calendar size={48} className="opacity-20" /><p className="text-xs font-bold">{searchQuery ? 'Tidak ada karyawan yang cocok.' : 'Tidak ada data absensi pada periode ini.'}</p></div></td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
        </>
      )}

      {/* ========================================= */}
      {/* SECTION 2: DETAIL LIST ABSENSI (ORIGINAL) */}
      {/* ========================================= */}
      {activeTab === 'detail' && (
        <>
      {!loading && (
        <>
          <div className="pt-4">
            <h2 className="text-xl font-black text-slate-800 tracking-tight">Detail Absensi</h2>
            <p className="text-slate-500 font-bold text-[10px] uppercase tracking-widest mt-1">
              Klik baris untuk melihat foto absensi, lokasi & detail lainnya
            </p>
          </div>

          <div className="bg-white rounded-[2.5rem] shadow-xl border border-slate-100 overflow-hidden min-h-[300px]">
            <div className="overflow-x-auto">
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
                  {filteredAttendance.length > 0 ? (
                    filteredAttendance.map(record => {
                      const user = store.users.find(u => u.id === record.userId);
                      let dateDisplay = 'Unknown';
                      try {
                        const d = new Date(record.date);
                        if (!isNaN(d.getTime())) {
                          dateDisplay = d.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' });
                        } else {
                          dateDisplay = String(record.date).split(',')[0];
                        }
                      } catch {}
                      return (
                        <tr
                          key={record.id}
                          onClick={() => setSelectedRecord(record)}
                          className="hover:bg-blue-50/50 cursor-pointer transition-colors group"
                        >
                          <td className="p-6 font-mono">{dateDisplay}</td>
                          <td className="p-6">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 font-black uppercase text-[10px] overflow-hidden border border-white shadow-sm">
                                {user?.avatarUrl ? (
                                  <img src={user.avatarUrl} alt={user.name || 'User'} className="w-full h-full object-cover" />
                                ) : ((user?.name || user?.username || '?').charAt(0))}
                              </div>
                              <span className="group-hover:text-blue-600 transition">{user?.name || 'Unknown'}</span>
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
                      <td colSpan={7} className="p-20 text-center text-slate-400 flex flex-col items-center justify-center">
                        <Calendar size={48} className="mb-4 opacity-20" />
                        <p>Tidak ada data absensi ditemukan pada rentang ini.</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
        </>
      )}

      {/* ========================================= */}
      {/* DETAIL PHOTO MODAL (ORIGINAL - PRESERVED) */}
      {/* ========================================= */}
      {selectedRecord && (
        <div onClick={() => setSelectedRecord(null)} className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-md p-4 animate-in fade-in duration-300">
          <div
            onClick={e => e.stopPropagation()}
            className="bg-white/90 backdrop-blur-xl w-full max-w-5xl rounded-[2.5rem] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300 flex flex-col md:flex-row max-h-[90vh] border border-white/20"
          >
            {/* LEFT: PHOTO EVIDENCE */}
            <div className="md:w-5/12 bg-slate-950 p-6 md:p-8 flex flex-col gap-6 overflow-y-auto">
              <div className="flex items-center justify-between md:hidden pb-4 border-b border-white/10">
                <h3 className="text-white font-black text-xs uppercase tracking-widest">Detail Absensi</h3>
                <button onClick={() => setSelectedRecord(null)} className="text-white/50 hover:text-white">
                  <ChevronLeft size={24} />
                </button>
              </div>

              <div className={`grid gap-4 ${selectedRecord.checkOutSelfieUrl ? 'grid-cols-2 md:grid-cols-1' : 'grid-cols-1'}`}>
                {/* Check In Photo */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-emerald-400">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[10px] font-black uppercase tracking-[0.2em]">CHECK IN</span>
                  </div>
                  <div className="aspect-[3/4] rounded-[1.5rem] overflow-hidden border-2 border-white/10 relative group shadow-2xl bg-slate-800 flex items-center justify-center">
                    {selectedRecord.selfieUrl ? (
                      <img
                        src={selectedRecord.selfieUrl}
                        alt="Check In"
                        className="w-full h-full object-cover transition duration-700 group-hover:scale-110 opacity-90 group-hover:opacity-100 cursor-zoom-in"
                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                        onClick={() => window.open(selectedRecord.selfieUrl, '_blank')}
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center text-slate-500">
                        <UserIcon size={32} className="opacity-50 mb-2" />
                        <span className="text-[10px] font-bold uppercase">Tidak ada foto</span>
                      </div>
                    )}
                    <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-4 pointer-events-none">
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
                    <div className="aspect-[3/4] rounded-[1.5rem] overflow-hidden border-2 border-white/10 relative group shadow-2xl bg-slate-800 flex items-center justify-center">
                      <img
                        src={selectedRecord.checkOutSelfieUrl}
                        alt="Check Out"
                        className="w-full h-full object-cover transition duration-700 group-hover:scale-110 opacity-90 group-hover:opacity-100 cursor-zoom-in"
                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                        onClick={() => window.open(selectedRecord.checkOutSelfieUrl, '_blank')}
                        loading="lazy"
                      />
                      <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-4 pointer-events-none">
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
              <button
                onClick={() => setSelectedRecord(null)}
                className="hidden md:flex absolute top-6 right-6 w-10 h-10 bg-slate-100 hover:bg-rose-100 hover:text-rose-600 rounded-full items-center justify-center transition"
              >
                <ChevronLeft className="rotate-180" size={20} />
              </button>

              <div className="flex-1 overflow-y-auto pr-2 space-y-8">
                {/* User Header */}
                <div className="border-b border-slate-100 pb-6">
                  <div className="flex items-center gap-4 mb-2">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-black text-lg shadow-lg shadow-blue-200">
                      {store.users.find(u => u.id === selectedRecord.userId)?.name?.charAt(0) || '?'}
                    </div>
                    <div>
                      <h3 className="text-2xl font-black text-slate-800 tracking-tight leading-none">
                        {store.users.find(u => u.id === selectedRecord.userId)?.name || 'Unknown'}
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

                {/* Shift Context */}
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

                {/* Location */}
                <div className="space-y-3">
                  <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <MapPin size={12} /> TITIK LOKASI
                  </h5>
                  <div className="p-1 rounded-[2rem] border border-slate-200 bg-slate-50">
                    <div className="bg-white rounded-[1.7rem] p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                      <div className="flex items-center gap-3 text-slate-600">
                        <div className="p-2 bg-slate-100 rounded-full"><MapPin size={16} /></div>
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
                {selectedRecord.isLate && selectedRecord.lateReason && (
                  <div className="p-5 bg-rose-50 rounded-[2rem] border border-rose-100">
                    <div className="flex items-center gap-2 text-rose-600 mb-2">
                      <AlertTriangle size={16} />
                      <span className="text-[10px] font-black uppercase tracking-widest">ALASAN KETERLAMBATAN</span>
                    </div>
                    <p className="text-sm font-medium text-rose-800 italic leading-relaxed">
                      &ldquo;{selectedRecord.lateReason}&rdquo;
                    </p>
                  </div>
                )}
              </div>

              <div className="pt-6 border-t border-slate-100 mt-auto">
                <p className="text-[10px] text-center text-slate-400">
                  Data ini diverifikasi oleh sistem pada {new Date(selectedRecord.date).toLocaleDateString()}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && !report && !error && (
        <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 p-20 flex flex-col items-center justify-center text-slate-400 gap-4">
          <Calendar size={48} className="opacity-20" />
          <p className="text-xs font-black uppercase tracking-widest">Pilih rentang tanggal dan klik Tampilkan</p>
        </div>
      )}
    </div>
  );
}
