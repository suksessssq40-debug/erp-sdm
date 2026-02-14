import React, { useState, useEffect } from 'react';
import { User, DailyReport, UserRole } from '../types';
import { Plus, CheckCircle2, History, Link as LinkIcon, Image as ImageIcon, Send, Eye, X, Pencil, Trash2, Calendar } from 'lucide-react';
import { useToast } from './Toast';
import { useAppStore } from '../context/StoreContext';

interface DailyReportProps {
  currentUser: User;
  users: User[];
  reports: DailyReport[];
  onAddReport: (report: DailyReport) => Promise<void>;
  onUpdateReport: (report: DailyReport) => Promise<void>;
  onDeleteReport: (id: string) => Promise<void>;
  toast: ReturnType<typeof useToast>;
}

const DailyReportModule: React.FC<DailyReportProps> = ({ currentUser, users, reports, onAddReport, onUpdateReport, onDeleteReport, toast }) => {
  const store = useAppStore();

  const [showAdd, setShowAdd] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingReport, setEditingReport] = useState<DailyReport | null>(null);
  const [selectedReport, setSelectedReport] = useState<DailyReport | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string>('all');

  // SERVER-SIDE FILTER STATE (Auto Fetch)
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
  const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];

  const [filterStart, setFilterStart] = useState(firstDay);
  const [filterEnd, setFilterEnd] = useState(lastDay);

  // Auto-Fetch when Date Range Changes
  useEffect(() => {
    if (store.fetchDailyReports) {
      // debounce slightly to avoid double fetch on rapid mount, 
      // strictly usage of effect dependency ensures it runs on change
      const timer = setTimeout(() => {
        store.fetchDailyReports(filterStart, filterEnd);
      }, 500); // 500ms delay to allow typing/picking
      return () => clearTimeout(timer);
    }
  }, [filterStart, filterEnd]);

  // FORM STATE
  const [reportDate, setReportDate] = useState(new Date().toISOString().split('T')[0]); // Default Today
  const [activities, setActivities] = useState([{ task: '', quantity: 1, unit: '', link: '' }]);

  const handleAddActivity = () => setActivities([...activities, { task: '', quantity: 1, unit: '', link: '' }]);
  const handleRemoveActivity = (idx: number) => setActivities(activities.filter((_, i) => i !== idx));

  // Access Control & Other Logic...
  const submitReport = async () => {
    if (activities.some(a => !a.task)) {
      toast.warning("Harap isi semua tugas harian sebelum menyimpan laporan.");
      return;
    }

    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      const selectedDateStr = reportDate;
      const reportData: DailyReport = {
        id: editingReport ? editingReport.id : Math.random().toString(36).substr(2, 9),
        userId: currentUser.id,
        date: selectedDateStr,
        activities: activities.map(a => ({
          ...a,
          quantity: Number(a.quantity),
          unit: a.unit?.trim() || ''
        }))
      };

      if (editingReport) {
        await onUpdateReport(reportData);
        toast.success("Laporan berhasil diperbarui!");
      } else {
        await onAddReport(reportData);
        toast.success(`Laporan tanggal ${selectedDateStr} berhasil disimpan!`);
      }

      setShowAdd(false);
      setActivities([{ task: '', quantity: 1, unit: '', link: '' }]);
      setEditingReport(null);
      // Auto-refresh handled by useEffect or state update in onAddReport
    } catch (err: any) {
      toast.error(err?.message || 'Gagal menyimpan laporan harian.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const canViewAll = [UserRole.OWNER, UserRole.MANAGER, UserRole.FINANCE].includes(currentUser.role);
  const canReport = currentUser.role !== UserRole.OWNER;

  // Advanced Filtering
  const filteredByRole = canViewAll ? reports : reports.filter(r => r.userId === currentUser.id);

  const displayReports = [...filteredByRole]
    .filter(r => {
      const matchUser = selectedUserId === 'all' || r.userId === selectedUserId;
      const userObj = users.find(u => u.id === r.userId);
      const userName = userObj?.name.toLowerCase() || '';
      const activityMatch = r.activities.some(a => a.task.toLowerCase().includes(searchTerm.toLowerCase()));
      const nameMatch = userName.includes(searchTerm.toLowerCase());
      return matchUser && (nameMatch || activityMatch);
    })
    .sort((a, b) => {
      if (b.date !== a.date) return b.date.localeCompare(a.date);
      return b.id.localeCompare(a.id);
    });

  // Grouping Logic
  const groupedReports = displayReports.reduce((acc, report) => {
    const date = report.date;
    if (!acc[date]) acc[date] = [];
    acc[date].push(report);
    return acc;
  }, {} as Record<string, DailyReport[]>);

  const sortedDates = Object.keys(groupedReports).sort((a, b) => b.localeCompare(a));

  const prepareEdit = (report: DailyReport) => {
    setEditingReport(report);
    setReportDate(report.date);
    setActivities((report.activities || []).map(a => ({
      task: a.task || '',
      quantity: a.quantity || 1,
      unit: a.unit || '',
      link: a.link || ''
    })));
    setShowAdd(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Yakin ingin menghapus laporan ini?")) return;
    try {
      await onDeleteReport(id);
      toast.success("Laporan dihapus");
    } catch (e) {
      toast.error("Gagal menghapus");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex flex-col gap-2">
          <h3 className="text-xl font-bold text-slate-800">Laporan Harian</h3>
          <p className="text-sm text-slate-500 uppercase font-black tracking-widest">Update aktivitas tim Sukses Digital Media</p>

          {/* Server Side Date Filter (Auto Trigger) */}
          <div className="flex flex-wrap items-center gap-2 mt-2 bg-white p-2 rounded-xl border border-slate-200 w-fit shadow-sm animate-in fade-in">
            <div className="flex items-center gap-1 px-2 border-r border-slate-100">
              <span className="text-[10px] font-black uppercase text-slate-400">DARI</span>
              <input
                type="date"
                value={filterStart}
                onChange={e => setFilterStart(e.target.value)}
                className="bg-transparent text-xs font-bold text-slate-700 outline-none w-24 cursor-pointer"
              />
            </div>
            <div className="flex items-center gap-1 px-2">
              <span className="text-[10px] font-black uppercase text-slate-400">SAMPAI</span>
              <input
                type="date"
                value={filterEnd}
                onChange={e => setFilterEnd(e.target.value)}
                className="bg-transparent text-xs font-bold text-slate-700 outline-none w-24 cursor-pointer"
              />
            </div>
            {/* Auto-loading indicator */}
            <div className="px-2">
              <div className="h-2 w-2 bg-emerald-500 rounded-full animate-pulse" title="Live Sync Active"></div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 mt-4">
            <div className="relative group min-w-[200px]">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors">
                <Send size={14} className="rotate-[-45deg]" />
              </div>
              <input
                type="text"
                placeholder="Cari aktivitas atau nama..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-[11px] font-bold text-slate-700 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-50/50 transition-all shadow-sm"
              />
            </div>

            {canViewAll && (
              <select
                value={selectedUserId}
                onChange={e => setSelectedUserId(e.target.value)}
                className="px-4 py-3 bg-white border border-slate-200 rounded-2xl text-[11px] font-bold text-slate-700 outline-none focus:border-blue-500 transition-all shadow-sm cursor-pointer min-w-[150px]"
              >
                <option value="all">SEMUA ANGGOTA</option>
                {users.filter(u => u.role !== UserRole.OWNER).map(u => (
                  <option key={u.id} value={u.id}>{u.name.toUpperCase()}</option>
                ))}
              </select>
            )}

            <div className="bg-slate-100/50 px-4 py-3 rounded-2xl border border-slate-200/50">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none">
                Ditemukan: <span className="text-blue-600">{displayReports.length} Laporan</span>
              </p>
            </div>
          </div>
        </div>
        {canReport && (
          <button
            onClick={() => {
              setEditingReport(null);
              setReportDate(new Date().toISOString().split('T')[0]);
              setActivities([{ task: '', quantity: 1, unit: '', link: '' }]);
              setShowAdd(true);
            }}
            className="bg-slate-900 text-white px-8 py-4 rounded-[2rem] flex items-center space-x-3 font-black text-xs uppercase tracking-[0.2em] shadow-2xl hover:bg-blue-600 transition-all active:scale-95 group"
          >
            <Plus size={18} className="group-hover:rotate-90 transition-transform duration-300" />
            <span>BUAT LAPORAN</span>
          </button>
        )}
      </div>

      <div className="space-y-10">
        {sortedDates.length === 0 ? (
          <div className="bg-white rounded-[3rem] p-20 text-center border-2 border-dashed border-slate-100">
            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <Calendar size={32} className="text-slate-300" />
            </div>
            <h4 className="text-xl font-black text-slate-400 uppercase tracking-widest">Tidak Ada Aktivitas</h4>
            <p className="text-xs font-bold text-slate-300 mt-2">Coba sesuaikan filter tanggal atau pencarian Anda.</p>
          </div>
        ) : (
          sortedDates.map(date => {
            const dateObj = new Date(date);
            const isToday = date === new Date().toISOString().split('T')[0];
            const displayDate = dateObj.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

            return (
              <div key={date} className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex items-center gap-4 mb-6 ml-4">
                  <div className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.2em] ${isToday ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' : 'bg-slate-900 text-white'}`}>
                    {isToday ? 'HARI INI' : displayDate}
                  </div>
                  <div className="h-px flex-1 bg-gradient-to-r from-slate-200 to-transparent"></div>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{groupedReports[date].length} LAPORAN</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {groupedReports[date].map(report => {
                    const user = users.find(u => u.id === report.userId);
                    return (
                      <div key={report.id} className="bg-white rounded-[2.5rem] border border-slate-100 p-8 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group flex flex-col">
                        <div className="flex justify-between items-start mb-6">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center font-black text-sm overflow-hidden shadow-lg border-2 border-white ring-4 ring-slate-50">
                              {user?.avatarUrl ? (
                                <img src={user.avatarUrl} alt={user.name} className="w-full h-full object-cover" />
                              ) : (
                                user?.name.charAt(0)
                              )}
                            </div>
                            <div>
                              <h4 className="text-xs font-black text-slate-800 uppercase tracking-tight">{user?.name}</h4>
                              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest truncate max-w-[120px]">{user?.jobTitle || 'Anggota Tim'}</p>
                            </div>
                          </div>
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            {report.userId === currentUser.id && (
                              <button onClick={() => prepareEdit(report)} className="p-2 bg-amber-50 text-amber-500 rounded-xl hover:bg-amber-500 hover:text-white transition">
                                <Pencil size={14} />
                              </button>
                            )}
                            {(report.userId === currentUser.id || canViewAll) && (
                              <button onClick={() => handleDelete(report.id)} className="p-2 bg-rose-50 text-rose-500 rounded-xl hover:bg-rose-600 hover:text-white transition">
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="flex-1 space-y-4 mb-6">
                          {(report.activities || []).slice(0, 3).map((act, i) => (
                            <div key={i} className="flex gap-3">
                              <div className="mt-1.5 shrink-0 w-1.5 h-1.5 rounded-full bg-blue-500 ring-4 ring-blue-50"></div>
                              <p className="text-[11px] font-bold text-slate-600 leading-relaxed line-clamp-2 italic">"{act.task}"</p>
                            </div>
                          ))}
                          {(report.activities || []).length > 3 && (
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-4">
                              + {(report.activities || []).length - 3} Aktivitas Lainnya
                            </p>
                          )}
                        </div>

                        <div className="flex items-center justify-between pt-6 border-t border-slate-50 mt-auto">
                          <span className="bg-slate-100 text-slate-500 px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest">
                            {report.activities?.length || 0} TOTAL TUGAS
                          </span>
                          <button
                            onClick={() => setSelectedReport(report)}
                            className="flex items-center gap-2 text-[10px] font-black text-blue-600 uppercase tracking-[0.2em] hover:bg-blue-50 px-4 py-2 rounded-xl transition-colors"
                          >
                            DETAIL <Eye size={14} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* View Detail Modal ... (Unchanged) ... */}
      {selectedReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/90 backdrop-blur-md p-4" onClick={() => setSelectedReport(null)}>
          <div className="bg-white rounded-[2.5rem] w-full max-w-lg p-8 shadow-2xl overflow-hidden flex flex-col border border-white/20 animate-in zoom-in duration-300 relative" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="text-2xl font-black text-slate-800 leading-none">Detail Laporan</h3>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">{selectedReport.date}</p>
              </div>
              <button onClick={() => setSelectedReport(null)} className="p-2 bg-slate-100 rounded-full hover:bg-rose-500 hover:text-white transition"><X size={20} /></button>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar max-h-[60vh] space-y-4">
              {(selectedReport.activities || []).map((act, i) => (
                <div key={i} className="bg-slate-50 p-5 rounded-[1.5rem] border border-slate-100">
                  <div className="flex justify-between items-start mb-2">
                    <p className="text-sm font-bold text-slate-800 w-2/3 whitespace-pre-wrap">{act.task}</p>
                    <span className="bg-white px-3 py-1 rounded-lg text-[10px] font-black text-blue-600 shadow-sm border border-slate-100">
                      {act.quantity} {act.unit || 'unit'}
                    </span>
                  </div>
                  {act.link && (
                    <a href={act.link} target="_blank" className="inline-flex items-center gap-2 text-[10px] font-black text-blue-500 uppercase tracking-widest hover:underline mt-2">
                      <LinkIcon size={12} /> BUKTI / HASIL KERJA
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Add Report Modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/90 backdrop-blur-md p-4">
          <div className="bg-white rounded-[3.5rem] w-full max-w-xl p-12 shadow-2xl overflow-hidden flex flex-col border border-white/20 max-h-[90vh]">
            <h3 className="text-3xl font-black text-slate-800 mb-6 uppercase tracking-tight leading-none italic">
              {editingReport ? 'Edit Laporan' : 'Log Aktivitas'}<br />
              <span className="text-blue-600">{editingReport ? 'Perbarui Data' : 'Produktivitas Harian'}</span>
            </h3>

            {/* NEW: Date Picker for Backdate */}
            <div className="mb-6 bg-slate-50 p-4 rounded-2xl border border-slate-100">
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] block mb-2">TANGGAL PELAPORAN</label>
              <input
                type="date"
                className="w-full p-3 bg-white border border-slate-200 rounded-xl font-bold text-slate-800 outline-none focus:border-blue-500"
                value={reportDate}
                onChange={e => setReportDate(e.target.value)}
              />
              <p className="text-[10px] text-slate-400 mt-2 italic">*Anda bisa memilih tanggal mundur jika lupa input kemarin.</p>
            </div>

            <div className="flex-1 overflow-y-auto space-y-8 pr-4 custom-scrollbar">
              {activities.map((act, idx) => (
                <div key={idx} className="bg-slate-50 p-6 md:p-8 rounded-[2.5rem] space-y-6 border border-slate-100 relative group animate-in slide-in-from-right duration-300">
                  <button onClick={() => handleRemoveActivity(idx)} className="absolute top-6 right-6 text-slate-300 hover:text-rose-500 transition-colors">✕</button>
                  <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">TUGAS / PEKERJAAN</label>
                    <textarea
                      className="w-full p-5 bg-white border-2 border-transparent rounded-[1.5rem] text-xs font-black focus:border-blue-600 outline-none shadow-sm transition resize-none h-24"
                      value={act.task}
                      onChange={e => {
                        const newAct = [...activities];
                        newAct[idx].task = e.target.value;
                        setActivities(newAct);
                      }}
                      placeholder="Deskripsikan pekerjaan yang anda selesaikan..."
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-3">
                      <label className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">KUANTITAS (ANGKA)</label>
                      <input
                        type="number"
                        className="w-full p-4 bg-white border-2 border-transparent rounded-xl text-xs font-black focus:border-blue-600 outline-none shadow-sm transition text-center"
                        value={act.quantity}
                        onChange={e => {
                          const newAct = [...activities];
                          newAct[idx].quantity = Number(e.target.value);
                          setActivities(newAct);
                        }}
                      />
                    </div>
                    <div className="space-y-3">
                      <label className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">SATUAN (OPSIONAL)</label>
                      <input
                        type="text"
                        className="w-full p-4 bg-white border-2 border-transparent rounded-xl text-xs font-black focus:border-blue-600 outline-none shadow-sm transition text-center"
                        value={act.unit}
                        onChange={e => {
                          const newAct = [...activities];
                          newAct[idx].unit = e.target.value;
                          setActivities(newAct);
                        }}
                        placeholder="Pcs, Jam, Lembar..."
                      />
                    </div>
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">LINK HASIL (OPSIONAL)</label>
                    <input
                      className="w-full p-5 bg-white border-2 border-transparent rounded-xl text-xs font-black focus:border-blue-600 outline-none shadow-sm transition"
                      value={act.link}
                      onChange={e => {
                        const newAct = [...activities];
                        newAct[idx].link = e.target.value;
                        setActivities(newAct);
                      }}
                      placeholder="https://..."
                    />
                  </div>
                </div>
              ))}
              <button onClick={handleAddActivity} className="w-full py-5 border-2 border-dashed border-slate-200 rounded-[2rem] text-[11px] font-black uppercase tracking-widest text-slate-400 hover:border-blue-300 hover:text-blue-600 transition-all duration-300 flex items-center justify-center gap-3">
                <Plus size={16} /> TAMBAH LIST TUGAS LAGI
              </button>
            </div>
            <div className="flex gap-6 mt-8 pt-6 border-t border-slate-50 shrink-0">
              <button onClick={() => setShowAdd(false)} className="flex-1 py-5 text-slate-400 font-black uppercase tracking-widest hover:bg-slate-50 rounded-[1.5rem] text-[10px] transition" disabled={isSubmitting}>BATAL</button>
              <button onClick={submitReport} disabled={isSubmitting} className="flex-1 bg-slate-900 text-white py-5 rounded-[1.5rem] font-black uppercase tracking-[0.2em] text-[10px] shadow-2xl shadow-slate-100 hover:bg-blue-600 transition disabled:opacity-50 flex justify-center items-center gap-2">
                {isSubmitting ? 'MEMPROSES...' : (editingReport ? 'SIMPAN PERUBAHAN' : 'LAPORKAN & KIRIM')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DailyReportModule;
