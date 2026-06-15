import React, { useState, useEffect, useMemo } from 'react';
import { User, DailyReport, UserRole } from '../types';
import { Plus, CheckCircle2, History, Link as LinkIcon, Image as ImageIcon, Send, Eye, X, Pencil, Trash2, Calendar, ArrowDownNarrowWide, ArrowUpNarrowWide, Filter } from 'lucide-react';
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
  
  // SERVER-SIDE FILTER STATE (Auto Fetch)
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
  const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];

  const [filterStart, setFilterStart] = useState(firstDay);
  const [filterEnd, setFilterEnd] = useState(lastDay);
  const [filterUserId, setFilterUserId] = useState('');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  
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

  const canViewAll = [UserRole.OWNER, UserRole.MANAGER, UserRole.FINANCE].includes(currentUser.role) || !!currentUser.isKaizenMaster;
  const canReport = currentUser.role !== UserRole.OWNER; 
  const filteredByRole = canViewAll ? reports : reports.filter(r => r.userId === currentUser.id);

  // Apply user filter + sort order
  const displayReports = useMemo(() => {
    let result = [...filteredByRole];
    if (filterUserId) {
      result = result.filter(r => r.userId === filterUserId);
    }
    // Sort by date + createdAt
    result.sort((a, b) => {
      const dateA = new Date(a.createdAt || a.date).getTime();
      const dateB = new Date(b.createdAt || b.date).getTime();
      return sortOrder === 'newest' ? dateB - dateA : dateA - dateB;
    });
    return result;
  }, [filteredByRole, filterUserId, sortOrder]);

  const prepareEdit = (report: DailyReport) => {
      setEditingReport(report);
      setReportDate(report.date);
      setActivities(report.activities.map(a => ({
          task: a.task,
          quantity: a.quantity,
          unit: a.unit || '',
          link: a.link || ''
      })));
      setShowAdd(true);
  };

  const handleDelete = async (id: string) => {
      if(!confirm("Yakin ingin menghapus laporan ini?")) return;
      try {
          await onDeleteReport(id);
          toast.success("Laporan dihapus");
      } catch(e) {
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
             <div className="flex items-center gap-1 px-2 border-r border-slate-100">
                <span className="text-[10px] font-black uppercase text-slate-400">SAMPAI</span>
                <input 
                    type="date" 
                    value={filterEnd}
                    onChange={e => setFilterEnd(e.target.value)}
                    className="bg-transparent text-xs font-bold text-slate-700 outline-none w-24 cursor-pointer"
                />
             </div>
             {/* User Filter (only for admin/kaizen) */}
             {canViewAll && (
               <div className="flex items-center gap-1 px-2 border-r border-slate-100">
                  <Filter size={12} className="text-slate-400" />
                  <select
                    value={filterUserId}
                    onChange={e => setFilterUserId(e.target.value)}
                    className="bg-transparent text-xs font-bold text-slate-700 outline-none cursor-pointer min-w-[100px]"
                  >
                    <option value="">Semua Anggota</option>
                    {users
                      .filter(u => u.role !== 'OWNER' && u.role !== 'SUPERADMIN')
                      .map(u => (
                        <option key={u.id} value={u.id}>{u.name || u.username}</option>
                      ))}
                  </select>
               </div>
             )}
             {/* Sort Order Toggle */}
             <button
               onClick={() => setSortOrder(sortOrder === 'newest' ? 'oldest' : 'newest')}
               className="flex items-center gap-1 px-2 text-slate-500 hover:text-blue-600 transition"
               title={sortOrder === 'newest' ? 'Terbaru dulu' : 'Terlama dulu'}
             >
               {sortOrder === 'newest' ? <ArrowDownNarrowWide size={14} /> : <ArrowUpNarrowWide size={14} />}
               <span className="text-[10px] font-black uppercase hidden md:inline">
                 {sortOrder === 'newest' ? 'Terbaru' : 'Terlama'}
               </span>
             </button>
             {/* Auto-loading indicator */}
             <div className="px-2">
                 <div className="h-2 w-2 bg-emerald-500 rounded-full animate-pulse" title="Live Sync Active"></div>
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
            className="bg-slate-900 text-white px-8 py-3 rounded-[1.5rem] flex items-center space-x-3 font-black text-xs uppercase tracking-widest shadow-2xl hover:bg-blue-600 transition"
          >
            <Plus size={18} /> <span>BUAT LAPORAN</span>
          </button>
        )}
      </div>

      {/* Card Grid */}
      {displayReports.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {displayReports.map(report => {
            const user = users.find(u => u.id === report.userId);
            const displayDate = new Date(report.date).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
            const totalItems = report.activities.reduce((sum, a) => sum + (a.quantity || 0), 0);

            return (
              <div
                key={report.id}
                onClick={() => setSelectedReport(report)}
                className="bg-white rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-xl hover:border-blue-200 transition-all duration-300 cursor-pointer group overflow-hidden"
              >
                {/* Card Header */}
                <div className="p-6 pb-4">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-600 text-white flex items-center justify-center font-black text-sm overflow-hidden shadow-lg">
                        {user?.avatarUrl ? (
                          <img src={user.avatarUrl} alt={user.name} className="w-full h-full object-cover" />
                        ) : (
                          user?.name?.charAt(0) || '?'
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-black text-slate-800 leading-tight">{user?.name || 'Unknown'}</p>
                        <span className={`inline-block mt-1 px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-widest ${
                          user?.role === 'MANAGER' ? 'bg-amber-50 text-amber-600' :
                          user?.role === 'FINANCE' ? 'bg-emerald-50 text-emerald-600' :
                          'bg-blue-50 text-blue-600'
                        }`}>{user?.role || '-'}</span>
                      </div>
                    </div>
                    {/* Action Buttons */}
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {report.userId === currentUser.id && (
                        <button onClick={(e) => { e.stopPropagation(); prepareEdit(report); }} className="p-2 bg-slate-100 text-slate-400 rounded-xl hover:bg-amber-500 hover:text-white transition">
                          <Pencil size={14} />
                        </button>
                      )}
                      {(report.userId === currentUser.id || canViewAll) && (
                        <button onClick={(e) => { e.stopPropagation(); handleDelete(report.id); }} className="p-2 bg-slate-100 text-slate-400 rounded-xl hover:bg-rose-600 hover:text-white transition">
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Date & Activity Count */}
                  <div className="flex items-center gap-2 mb-3">
                    <div className="flex items-center gap-1.5 text-slate-400">
                      <Calendar size={12} />
                      <span className="text-[10px] font-black uppercase tracking-widest">{displayDate}</span>
                    </div>
                  </div>

                  {/* First Task Preview */}
                  <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                    <p className="text-xs font-bold text-slate-600 line-clamp-2 leading-relaxed">
                      {report.activities[0]?.task || 'Tidak ada aktivitas'}
                    </p>
                    {report.activities[0]?.link && (
                      <div className="flex items-center gap-1 mt-2 text-blue-500">
                        <LinkIcon size={10} />
                        <span className="text-[9px] font-black uppercase tracking-widest">Ada bukti/link</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Footer */}
                <div className="px-6 py-4 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="bg-blue-100 text-blue-700 px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest">
                      {report.activities.length} Aktivitas
                    </span>
                    {totalItems > 0 && (
                      <span className="bg-emerald-100 text-emerald-700 px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest">
                        {totalItems} Item
                      </span>
                    )}
                  </div>
                  {report.createdAt && (
                    <div className="flex items-center gap-1.5 text-slate-400">
                      <History size={10} />
                      <span className="text-[9px] font-bold">
                        {new Date(report.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-16 text-center">
          <Calendar size={48} className="mx-auto text-slate-200 mb-4" />
          <p className="text-slate-400 font-black uppercase tracking-widest text-xs">Tidak ada laporan aktivitas pada rentang tanggal ini.</p>
        </div>
      )}

      {/* View Detail Modal ... (Unchanged) ... */}
      {selectedReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/90 backdrop-blur-md p-4" onClick={() => setSelectedReport(null)}>
           <div className="bg-white rounded-[2.5rem] w-full max-w-lg p-8 shadow-2xl overflow-hidden flex flex-col border border-white/20 animate-in zoom-in duration-300 relative" onClick={e => e.stopPropagation()}>
              <div className="flex justify-between items-start mb-6">
                 <div>
                    <h3 className="text-2xl font-black text-slate-800 leading-none">Detail Laporan</h3>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">{selectedReport.date}</p>
                    <div className="flex flex-col gap-1 mt-3">
                       {selectedReport.createdAt && (
                         <div className="flex items-center gap-2">
                           <Calendar size={10} className="text-emerald-500" />
                           <span className="text-[9px] font-bold text-slate-500">
                             Dibuat: {new Date(selectedReport.createdAt).toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                           </span>
                         </div>
                       )}
                       {selectedReport.updatedAt && selectedReport.updatedAt !== selectedReport.createdAt && (
                         <div className="flex items-center gap-2">
                           <History size={10} className="text-amber-500" />
                           <span className="text-[9px] font-bold text-slate-500">
                             Diperbarui: {new Date(selectedReport.updatedAt).toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                           </span>
                         </div>
                       )}
                    </div>
                 </div>
                 <button onClick={() => setSelectedReport(null)} className="p-2 bg-slate-100 rounded-full hover:bg-rose-500 hover:text-white transition"><X size={20} /></button>
              </div>
              <div className="flex-1 overflow-y-auto custom-scrollbar max-h-[60vh] space-y-4">
                 {selectedReport.activities.map((act, i) => (
                    <div key={i} className="bg-slate-50 p-5 rounded-[1.5rem] border border-slate-100">
                       <div className="flex justify-between items-start mb-2">
                          <p className="text-sm font-bold text-slate-800 w-2/3">{act.task}</p>
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
                {editingReport ? 'Edit Laporan' : 'Log Aktivitas'}<br/>
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
