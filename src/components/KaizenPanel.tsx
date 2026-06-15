'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Target, AlertTriangle, ShieldCheck, History, MinusCircle, RefreshCw, X } from 'lucide-react';
import { User, UserRole, KaizenDeduction } from '@/types';
import { useToast } from './Toast';

interface KaizenUser {
  id: string;
  name: string;
  role: string;
  isKaizenMaster: boolean;
  kaizenPoints: number;
  kaizenPointsResetAt: string | null;
  isOwner: boolean;
}

interface KaizenPanelProps {
  currentUser: User | null;
  toast: ReturnType<typeof useToast>;
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';

export default function KaizenPanel({ currentUser, toast }: KaizenPanelProps) {
  const [users, setUsers] = useState<KaizenUser[]>([]);
  const [deductions, setDeductions] = useState<KaizenDeduction[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDeductModal, setShowDeductModal] = useState(false);
  const [deducting, setDeducting] = useState(false);

  // Deduct form state
  const [selectedUserId, setSelectedUserId] = useState('');
  const [category, setCategory] = useState<'RINGAN' | 'SEDANG' | 'BERAT'>('RINGAN');
  const [amount, setAmount] = useState(10);
  const [reason, setReason] = useState('');
  const [violationDate, setViolationDate] = useState(new Date().toISOString().split('T')[0]);

  const getHeaders = (): Record<string, string> => {
    const h: Record<string, string> = { 'Content-Type': 'application/json' };
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('sdm_erp_auth_token');
      if (token) h['Authorization'] = `Bearer ${token}`;
    }
    return h;
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/kaizen/history`, { headers: getHeaders() });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Gagal memuat data');
      }
      const data = await res.json();
      setUsers(data.users || []);
      setDeductions(data.deductions || []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal memuat data Kaizen';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleDeduct = async () => {
    if (!selectedUserId) {
      toast.warning('Pilih user terlebih dahulu');
      return;
    }
    if (amount < 1 || amount > 100) {
      toast.warning('Jumlah poin harus antara 1-100');
      return;
    }
    if (!reason.trim()) {
      toast.warning('Alasan pemotongan wajib diisi');
      return;
    }

    setDeducting(true);
    try {
      const res = await fetch(`${API_BASE}/api/kaizen/deduct`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          userId: selectedUserId,
          category,
          amount,
          reason: reason.trim(),
          violationDate
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal memotong poin');

      const todayStr = new Date().toISOString().split('T')[0];
      const dateNote = violationDate !== todayStr ? ` (pelanggaran: ${new Date(violationDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })})` : '';
      toast.success(`Berhasil memotong ${amount} poin (${category}) dari ${users.find(u => u.id === selectedUserId)?.name || 'user'}${dateNote}`);
      setShowDeductModal(false);
      resetForm();
      fetchData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal memotong poin';
      toast.error(msg);
    } finally {
      setDeducting(false);
    }
  };

  const handleReset = async (userId: string, userName: string) => {
    if (!window.confirm(`Reset poin ${userName} ke 100?`)) return;

    try {
      const res = await fetch(`${API_BASE}/api/kaizen/reset`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ userId })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal reset poin');

      toast.success(`Poin ${userName} berhasil direset ke 100`);
      fetchData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal reset poin';
      toast.error(msg);
    }
  };

  const resetForm = () => {
    setSelectedUserId('');
    setCategory('RINGAN');
    setAmount(10);
    setReason('');
    setViolationDate(new Date().toISOString().split('T')[0]);
  };

  const getCategoryColor = (cat: string) => {
    switch (cat) {
      case 'RINGAN': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'SEDANG': return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'BERAT': return 'bg-red-100 text-red-700 border-red-200';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const getPointsColor = (points: number) => {
    if (points >= 80) return 'text-emerald-600 bg-emerald-50';
    if (points >= 50) return 'text-amber-600 bg-amber-50';
    if (points >= 20) return 'text-orange-600 bg-orange-50';
    return 'text-red-600 bg-red-50';
  };

  // Filter out owners for the deduct selection
  const deductibleUsers = users.filter(u => !u.isOwner);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-500 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      {/* Header */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6">
        <div>
          <h3 className="text-3xl font-black text-slate-800 tracking-tight leading-none italic uppercase flex items-center gap-3">
            <Target className="text-purple-600" size={32} />
            Kaizen Master Panel
          </h3>
          <p className="text-xs font-black text-slate-400 uppercase tracking-[0.3em] mt-3">
            Sistem Poin Pelanggaran & Monitoring Tim
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={fetchData}
            className="bg-slate-100 text-slate-600 p-4 rounded-xl hover:bg-slate-200 transition border border-slate-200 shadow-sm"
            title="Refresh Data"
          >
            <RefreshCw size={20} />
          </button>
          <button
            onClick={() => { resetForm(); setShowDeductModal(true); }}
            className="bg-purple-600 text-white px-8 py-4 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-3 shadow-xl hover:bg-purple-700 transition shrink-0"
          >
            <MinusCircle size={18} /> Potong Poin
          </button>
        </div>
      </div>

      {/* User Points Grid */}
      <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-6 py-5 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
            Daftar Poin Anggota ({users.length} user)
          </h4>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50/50 border-b border-slate-100">
              <tr>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Anggota</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Role</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Status</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Poin</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Reset Terakhir</th>
                <th className="px-6 py-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-white font-black text-sm shadow-lg ${
                        u.role === 'OWNER' ? 'bg-purple-600' :
                        u.role === 'MANAGER' ? 'bg-amber-500' :
                        u.role === 'FINANCE' ? 'bg-emerald-500' : 'bg-blue-600'
                      }`}>
                        {u.name.charAt(0)}
                      </div>
                      <div>
                        <p className="font-bold text-slate-800 text-sm">{u.name}</p>
                        {u.isKaizenMaster && (
                          <span className="text-[9px] font-black text-purple-600 uppercase tracking-widest flex items-center gap-1">
                            <Target size={10} /> Kaizen Master
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
                      u.role === 'OWNER' ? 'bg-purple-100 text-purple-700' :
                      u.role === 'MANAGER' ? 'bg-amber-100 text-amber-700' :
                      u.role === 'FINANCE' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'
                    }`}>{u.role}</span>
                  </td>
                  <td className="px-6 py-4">
                    {u.isOwner ? (
                      <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-purple-50 text-purple-600 border border-purple-200">
                        <ShieldCheck size={12} /> Kebal
                      </span>
                    ) : u.kaizenPoints <= 20 ? (
                      <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-red-50 text-red-600 border border-red-200">
                        <AlertTriangle size={12} /> Kritis
                      </span>
                    ) : (
                      <span className="px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-emerald-50 text-emerald-600 border border-emerald-200">
                        Aktif
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-4 py-2 rounded-xl text-sm font-black ${getPointsColor(u.kaizenPoints)}`}>
                      {u.kaizenPoints}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-[10px] font-bold text-slate-400">
                      {u.kaizenPointsResetAt
                        ? new Date(u.kaizenPointsResetAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
                        : 'Belum pernah'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    {currentUser?.role === UserRole.OWNER && !u.isOwner && (
                      <button
                        onClick={() => handleReset(u.id, u.name)}
                        className="px-3 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white transition border border-emerald-200"
                        title="Reset poin ke 100"
                      >
                        <RefreshCw size={12} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {users.length === 0 && (
            <div className="p-12 text-center text-slate-300 font-bold uppercase tracking-widest text-xs">
              Belum ada anggota terdaftar
            </div>
          )}
        </div>
      </div>

      {/* Deduction History */}
      <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-6 py-5 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
          <History size={16} className="text-slate-400" />
          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
            Riwayat Pemotongan Poin ({deductions.length} catatan)
          </h4>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50/50 border-b border-slate-100">
              <tr>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Waktu</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">User</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Kategori</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Poin</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Alasan</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Oleh</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {deductions.slice(0, 50).map((d) => (
                <tr key={d.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <span className="text-[10px] font-bold text-slate-500">
                      {new Date(d.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="font-bold text-slate-800 text-sm">{d.userName || 'Unknown'}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${getCategoryColor(d.category)}`}>
                      {d.category}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm font-black text-red-600">-{d.amount}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-xs text-slate-600 max-w-xs truncate block">{d.reason || '-'}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-[10px] font-bold text-slate-500">{d.deductedByName || 'Unknown'}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {deductions.length === 0 && (
            <div className="p-12 text-center text-slate-300 font-bold uppercase tracking-widest text-xs">
              Belum ada riwayat pemotongan poin
            </div>
          )}
        </div>
      </div>

      {/* Deduct Modal */}
      {showDeductModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-[3rem] p-10 w-full max-w-lg space-y-8 shadow-2xl border border-white/20 animate-in zoom-in-95 duration-300">
            <div className="flex justify-between items-center">
              <h3 className="text-2xl font-black text-slate-800 leading-tight uppercase tracking-tighter italic flex items-center gap-3">
                <MinusCircle className="text-purple-600" size={28} />
                Potong Poin
              </h3>
              <button
                onClick={() => { setShowDeductModal(false); resetForm(); }}
                className="bg-slate-100 p-3 rounded-2xl hover:bg-rose-100 hover:text-rose-500 transition"
              >
                <X size={24} />
              </button>
            </div>

            <div className="space-y-6">
              {/* Select User */}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Pilih User</label>
                <select
                  className="w-full p-4 bg-slate-50 border-2 border-transparent focus:border-purple-600 focus:bg-white rounded-2xl outline-none font-black text-xs uppercase tracking-widest transition shadow-sm"
                  value={selectedUserId}
                  onChange={e => setSelectedUserId(e.target.value)}
                >
                  <option value="">-- Pilih User --</option>
                  {deductibleUsers.map(u => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.role}) - Poin: {u.kaizenPoints}
                    </option>
                  ))}
                </select>
                {deductibleUsers.length === 0 && (
                  <p className="text-[9px] text-amber-600 ml-2 italic font-bold">Tidak ada user yang bisa dipotong (semua OWNER).</p>
                )}
              </div>

              {/* Category */}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Kategori Pelanggaran</label>
                <div className="grid grid-cols-3 gap-3">
                  {(['RINGAN', 'SEDANG', 'BERAT'] as const).map(cat => (
                    <button
                      key={cat}
                      onClick={() => setCategory(cat)}
                      className={`p-4 rounded-2xl text-[10px] font-black uppercase tracking-widest border-2 transition ${
                        category === cat
                          ? cat === 'RINGAN' ? 'bg-yellow-50 border-yellow-400 text-yellow-700'
                            : cat === 'SEDANG' ? 'bg-orange-50 border-orange-400 text-orange-700'
                            : 'bg-red-50 border-red-400 text-red-700'
                          : 'bg-slate-50 border-slate-200 text-slate-400 hover:border-slate-300'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Amount */}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  Jumlah Poin (1-100): <span className="text-purple-600 text-sm">{amount}</span>
                </label>
                <input
                  type="range"
                  min="1"
                  max="100"
                  value={amount}
                  onChange={e => setAmount(Number(e.target.value))}
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-purple-600"
                />
                <div className="flex justify-between text-[9px] text-slate-400 font-bold">
                  <span>1</span>
                  <span>50</span>
                  <span>100</span>
                </div>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={amount}
                  onChange={e => setAmount(Math.min(100, Math.max(1, Number(e.target.value))))}
                  className="w-full p-4 bg-slate-50 border-2 border-transparent focus:border-purple-600 focus:bg-white rounded-2xl outline-none font-black text-center text-2xl transition shadow-sm mt-2"
                />
              </div>

              {/* Reason */}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Alasan Pemotongan</label>
                <textarea
                  className="w-full p-4 bg-slate-50 border-2 border-transparent focus:border-purple-600 focus:bg-white rounded-2xl outline-none font-bold transition shadow-sm resize-none"
                  rows={3}
                  placeholder="Jelaskan alasan pemotongan poin..."
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                />
              </div>

              {/* Violation Date */}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tanggal Pelanggaran</label>
                <input
                  type="date"
                  max={new Date().toISOString().split('T')[0]}
                  value={violationDate}
                  onChange={e => setViolationDate(e.target.value)}
                  className="w-full p-4 bg-slate-50 border-2 border-transparent focus:border-purple-600 focus:bg-white rounded-2xl outline-none font-black text-xs uppercase tracking-widest transition shadow-sm"
                />
                <p className="text-[9px] text-slate-400 ml-2 italic font-bold">Default: hari ini. Bisa diubah untuk backdate pelanggaran.</p>
              </div>
            </div>

            <div className="flex gap-4 pt-6 border-t border-slate-50">
              <button
                onClick={() => { setShowDeductModal(false); resetForm(); }}
                className="flex-1 py-4 text-slate-400 font-black uppercase tracking-widest hover:bg-slate-100 rounded-2xl transition text-xs"
              >
                Batal
              </button>
              <button
                onClick={handleDeduct}
                disabled={deducting || !selectedUserId}
                className="flex-1 bg-purple-600 text-white p-4 rounded-2xl font-black uppercase tracking-widest hover:bg-purple-700 transition shadow-xl shadow-purple-200 text-xs disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2"
              >
                {deducting ? 'MEMPROSES...' : <><MinusCircle size={16} /> Potong Poin</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
