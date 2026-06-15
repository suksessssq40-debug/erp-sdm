'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { User, UserRole } from '@/types';
import {
  Calendar, Download, ChevronDown, ChevronRight, Search,
  Loader2, AlertTriangle, User as UserIcon
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

interface AttendanceReportProps {
  currentUser: User;
  fetchAttendanceReport: (startDate: string, endDate: string) => Promise<ReportData>;
  users?: User[]; // optional: for resolving names if needed
}

// --- Helpers ---

function formatDateIndonesian(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' });
}

/**
 * Escape CSV injection — prefix cells starting with =, +, -, @ with single quote
 */
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

export const AttendanceReport: React.FC<AttendanceReportProps> = ({
  currentUser,
  fetchAttendanceReport,
}) => {
  const defaultRange = getDefaultDateRange();
  const [startDate, setStartDate] = useState(defaultRange.start);
  const [endDate, setEndDate] = useState(defaultRange.end);
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const isAdmin = [UserRole.OWNER, UserRole.MANAGER, UserRole.FINANCE].includes(currentUser.role) || !!currentUser.isKaizenMaster;

  const loadReport = useCallback(async () => {
    if (!startDate || !endDate) {
      setError('Mohon isi tanggal mulai dan tanggal akhir.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const data = await fetchAttendanceReport(startDate, endDate);
      setReport(data);
    } catch (e: any) {
      setError(e.message || 'Gagal memuat laporan.');
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, fetchAttendanceReport]);

  useEffect(() => {
    loadReport();
  }, []); // Load on mount only; manual refresh via button

  const filteredUsers = (report?.users || []).filter(u => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return u.nama.toLowerCase().includes(q) || u.jabatan.toLowerCase().includes(q);
  });

  const handleExportCSV = () => {
    if (!report?.users.length) return;
    const headers = ['Nama', 'Jabatan', 'Hadir', 'Izin', 'Absen', 'Total Hari Kerja', 'Tanggal Hadir', 'Tanggal Izin'];
    const rows = report.users.map(u => [
      escapeCSV(u.nama),
      escapeCSV(u.jabatan),
      u.hadir,
      u.izin,
      u.absen,
      u.totalWorkdays,
      u.tanggalHadir.join('; '),
      u.tanggalIzin.join('; '),
    ]);
    const csvContent = [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' }); // BOM for Excel
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `laporan_absensi_${startDate}_sd_${endDate}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight">Laporan Absensi</h2>
          <p className="text-slate-500 font-bold text-xs uppercase tracking-widest mt-1">
            Ringkasan kehadiran karyawan per periode
          </p>
        </div>
        <button
          onClick={handleExportCSV}
          disabled={!report?.users.length}
          className="bg-emerald-600 text-white px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-emerald-700 shadow-lg shadow-emerald-200 transition flex items-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed self-start"
        >
          <Download size={16} /> Export CSV
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
          {isAdmin && (
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                className="w-full bg-slate-50 border-2 border-transparent focus:border-blue-500 rounded-2xl py-3 pl-11 pr-4 text-xs font-bold outline-none transition"
                placeholder="Cari nama..."
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

      {/* Table */}
      {!loading && report && (
        <div className="bg-white rounded-[2.5rem] shadow-xl border border-slate-100 overflow-hidden">
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
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 text-xs font-bold text-slate-600">
                {filteredUsers.length > 0 ? (
                  filteredUsers.map(u => {
                    const isExpanded = expandedUser === u.userId;
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
                          <td className="p-5 text-center">
                            <span className="px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest bg-emerald-100 text-emerald-600">
                              {u.hadir}
                            </span>
                          </td>
                          <td className="p-5 text-center">
                            <span className="px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest bg-amber-100 text-amber-600">
                              {u.izin}
                            </span>
                          </td>
                          <td className="p-5 text-center">
                            <span className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest ${u.terlambat > 0 ? 'bg-orange-100 text-orange-600' : 'bg-slate-100 text-slate-400'}`}>
                              {u.terlambat || 0}
                            </span>
                          </td>
                          <td className="p-5 text-center">
                            <span className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest ${u.absen > 0 ? 'bg-rose-100 text-rose-600' : 'bg-slate-100 text-slate-400'}`}>
                              {u.absen}
                            </span>
                          </td>
                        </tr>

                        {/* Expandable Detail Row */}
                        {isExpanded && (
                          <tr key={`${u.userId}-detail`}>
                            <td colSpan={7} className="p-0 bg-slate-50/50">
                              <div className="px-6 py-4 grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in duration-200">
                                {/* Hadir Column */}
                                <div>
                                  <h4 className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                                    Hadir ({u.hadir} hari)
                                  </h4>
                                  {u.tanggalHadir.length > 0 ? (
                                    <div className="flex flex-wrap gap-1.5">
                                      {u.tanggalHadir.map(d => (
                                        <span key={d} className="px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-lg text-[10px] font-mono font-bold border border-emerald-100">
                                          {formatDateIndonesian(d)}
                                        </span>
                                      ))}
                                    </div>
                                  ) : (
                                    <p className="text-[10px] text-slate-400 italic">Tidak ada data hadir</p>
                                  )}
                                </div>

                                {/* Izin Column */}
                                <div>
                                  <h4 className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                                    Izin ({u.izin} hari)
                                  </h4>
                                  {u.tanggalIzin.length > 0 ? (
                                    <div className="flex flex-wrap gap-1.5">
                                      {u.tanggalIzin.map(d => (
                                        <span key={d} className="px-2.5 py-1 bg-amber-50 text-amber-700 rounded-lg text-[10px] font-mono font-bold border border-amber-100">
                                          {formatDateIndonesian(d)}
                                        </span>
                                      ))}
                                    </div>
                                  ) : (
                                    <p className="text-[10px] text-slate-400 italic">Tidak ada data izin</p>
                                  )}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={6} className="p-20 text-center text-slate-400">
                      <div className="flex flex-col items-center gap-3">
                        <Calendar size={48} className="opacity-20" />
                        <p className="text-xs font-bold">
                          {searchQuery ? 'Tidak ada karyawan yang cocok dengan pencarian.' : 'Tidak ada data absensi pada periode ini.'}
                        </p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Summary Footer */}
          {filteredUsers.length > 0 && (
            <div className="border-t border-slate-100 bg-slate-50/50 p-4 grid grid-cols-2 md:grid-cols-5 gap-3 text-center">
              <div>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Total Karyawan</p>
                <p className="text-lg font-black text-slate-700">{filteredUsers.length}</p>
              </div>
              <div>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Total Hadir</p>
                <p className="text-lg font-black text-emerald-600">
                  {filteredUsers.reduce((s, u) => s + u.hadir, 0)}
                </p>
              </div>
              <div>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Total Izin</p>
                <p className="text-lg font-black text-amber-600">
                  {filteredUsers.reduce((s, u) => s + u.izin, 0)}
                </p>
              </div>
              <div>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Total Terlambat</p>
                <p className="text-lg font-black text-orange-600">
                  {filteredUsers.reduce((s, u) => s + (u.terlambat || 0), 0)}
                </p>
              </div>
              <div>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Total Absen</p>
                <p className="text-lg font-black text-rose-600">
                  {filteredUsers.reduce((s, u) => s + u.absen, 0)}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Empty state when not loading and no report yet */}
      {!loading && !report && !error && (
        <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 p-20 flex flex-col items-center justify-center text-slate-400 gap-4">
          <Calendar size={48} className="opacity-20" />
          <p className="text-xs font-black uppercase tracking-widest">Pilih rentang tanggal dan klik Tampilkan</p>
        </div>
      )}
    </div>
  );
};

export default AttendanceReport;
