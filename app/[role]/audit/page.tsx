'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useAppStore } from '../../../src/context/StoreContext';
import { UserRole, SystemLog, SystemActionType } from '../../../src/types';
import { useRouter } from 'next/navigation';
import { Search, Filter, ShieldAlert, ArrowDownUp, RefreshCw } from 'lucide-react';

export default function AuditTrailPage() {
  const store = useAppStore();
  const router = useRouter();

  useEffect(() => {
    store.fetchLogs();
  }, []);

  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');
  const [selectedAction, setSelectedAction] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortDesc, setSortDesc] = useState(true);

  // Security Check
  if (store.currentUser?.role !== UserRole.OWNER) {
    // Return empty or redirect immediately
    if (typeof window !== 'undefined') router.replace(`/${store.currentUser?.role.toLowerCase()}/kanban`);
    return null;
  }

  // Filter Logic
  const filteredLogs = useMemo(() => {
    let logs = [...store.logs];

    // 1. Search Query (Actor Name, Details, Target)
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      logs = logs.filter(log => 
          log.actorName.toLowerCase().includes(q) ||
          log.details.toLowerCase().includes(q) ||
          (log.target && log.target.toLowerCase().includes(q))
      );
    }

    // 2. Action Type Filter
    if (selectedAction !== 'ALL') {
      logs = logs.filter(log => log.actionType === selectedAction);
    }

    // 3. Date Range Filter
    if (dateStart) {
      const start = new Date(dateStart).getTime();
      logs = logs.filter(log => log.timestamp >= start);
    }
    if (dateEnd) {
      // End of day
      const end = new Date(dateEnd).setHours(23,59,59,999);
      logs = logs.filter(log => log.timestamp <= end);
    }

    // 4. Sorting
    logs.sort((a, b) => {
      return sortDesc 
        ? b.timestamp - a.timestamp 
        : a.timestamp - b.timestamp;
    });

    return logs;
  }, [store.logs, searchQuery, selectedAction, dateStart, dateEnd, sortDesc]);


  const formatTime = (ts: number) => {
    return new Date(ts).toLocaleString('id-ID', {
      day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
  };

  const getActionColor = (type: SystemActionType) => {
    if (type.startsWith('AUTH')) return 'text-purple-600 bg-purple-50 border-purple-200';
    if (type.startsWith('ATTENDANCE')) return 'text-blue-600 bg-blue-50 border-blue-200';
    if (type.startsWith('PROJECT')) return 'text-emerald-600 bg-emerald-50 border-emerald-200';
    if (type.startsWith('FINANCE')) return 'text-amber-600 bg-amber-50 border-amber-200';
    if (type.startsWith('REQUEST')) return 'text-cyan-600 bg-cyan-50 border-cyan-200';
    if (type.startsWith('USER')) return 'text-rose-600 bg-rose-50 border-rose-200';
    if (type.startsWith('SETTINGS')) return 'text-slate-600 bg-slate-50 border-slate-200';
    return 'text-gray-600 bg-gray-50 border-gray-200';
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-rose-50 rounded-full blur-3xl -z-10 translate-x-10 -translate-y-10"></div>
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2">
            <ShieldAlert className="text-rose-500" />
            AUDIT TRAIL SYSTEM
          </h1>
          <p className="text-slate-500 font-medium text-sm mt-1">
            Pantau seluruh aktivitas pengguna secara realtime dan transparan.
          </p>
        </div>
        <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-bold uppercase tracking-wider">
                Total Logs: {store.logs.length}
            </span>
        </div>
      </div>

      {/* Filters Toolbar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col lg:flex-row gap-4 items-center">
        
        {/* Search */}
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Cari User, Aktivitas, atau Target..." 
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium text-sm"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Date Range */}
        <div className="flex items-center gap-2 w-full lg:w-auto overflow-x-auto">
            <input 
                type="date" 
                className="px-3 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 focus:ring-2 focus:ring-blue-500 outline-none"
                value={dateStart}
                onChange={e => setDateStart(e.target.value)}
            />
            <span className="text-slate-300 font-bold">-</span>
            <input 
                type="date" 
                className="px-3 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 focus:ring-2 focus:ring-blue-500 outline-none"
                value={dateEnd}
                onChange={e => setDateEnd(e.target.value)}
            />
        </div>

        {/* Action Type Filter */}
        <select 
            className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-bold text-slate-600 focus:ring-2 focus:ring-blue-500 outline-none w-full lg:w-48"
            value={selectedAction}
            onChange={e => setSelectedAction(e.target.value)}
        >
            <option value="ALL">SEMUA AKTIVITAS</option>
            {Object.values(SystemActionType).map(type => (
                <option key={type} value={type}>{type}</option>
            ))}
        </select>

        {/* Sort Toggle */}
        <button 
            onClick={() => setSortDesc(!sortDesc)}
            className={`p-2 rounded-lg border transition-colors ${sortDesc ? 'bg-blue-50 border-blue-200 text-blue-600' : 'bg-white border-slate-200 text-slate-400'}`}
            title="Sort Date"
        >
            <ArrowDownUp size={20} />
        </button>
      </div>

      {/* Logs Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
                <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider text-xs font-black">
                        <th className="px-6 py-4 w-48">Waktu & Tanggal</th>
                        <th className="px-6 py-4 w-48">Aktor (User)</th>
                        <th className="px-6 py-4">Aktivitas</th>
                        <th className="px-6 py-4 w-64">Target / Objek</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {filteredLogs.length > 0 ? (
                        filteredLogs.map(log => (
                            <tr key={log.id} className="hover:bg-slate-50/50 transition-colors group">
                                <td className="px-6 py-4 font-mono text-slate-500 text-xs">
                                    {formatTime(log.timestamp)}
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex flex-col">
                                        <span className="font-bold text-slate-800">{log.actorName}</span>
                                        <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider group-hover:text-blue-500 transition-colors">
                                            {log.actorRole}
                                        </span>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex flex-col gap-1">
                                        <span className={`self-start px-2 py-0.5 rounded text-[10px] font-black uppercase border tracking-wider ${getActionColor(log.actionType)}`}>
                                            {log.actionType.replace(/_/g, ' ')}
                                        </span>
                                        <p className="text-slate-600 font-medium">
                                            {log.details}
                                        </p>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    {log.target ? (
                                        <span className="font-mono text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded">
                                            {log.target}
                                        </span>
                                    ) : (
                                        <span className="text-slate-300">-</span>
                                    )}
                                </td>
                            </tr>
                        ))
                    ) : (
                        <tr>
                            <td colSpan={4} className="px-6 py-12 text-center text-slate-400">
                                <div className="flex flex-col items-center justify-center gap-2">
                                    <Filter className="text-slate-200" size={48} />
                                    <p className="font-medium">Tidak ada log aktivitas yang ditemukan.</p>
                                    <p className="text-xs">Coba ubah filter tanggal atau pencarian Anda.</p>
                                </div>
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
        
        {/* Pagination Info Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-between items-center text-xs text-slate-500 font-medium">
            <span>Menampilkan {filteredLogs.length} dari {store.logs.length} total baris</span>
            <span>Diurutkan: {sortDesc ? 'Terbaru' : 'Terlama'}</span>
        </div>
      </div>
    </div>
  );
}
