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
  const filteredByRole = canViewAll ? reports : reports.filter(r => r.userId === currentUser.id);
  const displayReports = filteredByRole;

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

      <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
        {/* Table content unchanged */}
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Tanggal</th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Anggota</th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Ringkasan Aktivitas</th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Total Item</th>
                <th className="px-6 py-5 text-right text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Detail</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {displayReports.slice().reverse().map(report => {
                const user = users.find(u => u.id === report.userId);
                // Render nicely formatted date
                const displayDate = new Date(report.date).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
                
                return (
                  <tr key={report.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-5">
                      <span className="text-xs font-bold text-slate-700">{displayDate}</span>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center font-black text-xs overflow-hidden shadow-md">
                          {user?.avatarUrl ? (
                              <img src={user.avatarUrl} alt={user.name} className="w-full h-full object-cover" />
                          ) : (
                              user?.name.charAt(0)
                          )}
                        </div>
                        <span className="text-xs font-bold text-slate-700">{user?.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                       <p className="text-xs font-medium text-slate-500 italic truncate max-w-xs">
                         "{report.activities[0]?.task || 'No activity'}" {report.activities.length > 1 && `dan ${report.activities.length - 1} lainnya...`}
                       </p>
                    </td>
                    <td className="px-6 py-5">
                       <span className="bg-blue-50 text-blue-600 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">
                         {report.activities.length} AKTIVITAS
                       </span>
                    </td>
                    <td className="px-6 py-5 text-right">
                       <button onClick={() => setSelectedReport(report)} className="p-2 bg-slate-100 text-slate-500 rounded-xl hover:bg-blue-600 hover:text-white transition group mr-2">
                          <Eye size={16} />
                       </button>
                       {/* Actions */}
                       <div className="flex items-center gap-1">
                           {/* Edit: Only Report Owner */}
                           {report.userId === currentUser.id && (
                             <button onClick={() => prepareEdit(report)} className="p-2 bg-slate-100 text-slate-500 rounded-xl hover:bg-amber-500 hover:text-white transition group">
                                <Pencil size={16} />
                             </button>
                           )}
                           
                           {/* Delete: Owner or Management */}
                           {(report.userId === currentUser.id || canViewAll) && (
                             <button onClick={() => handleDelete(report.id)} className="p-2 bg-slate-100 text-slate-500 rounded-xl hover:bg-rose-600 hover:text-white transition group">
                                <Trash2 size={16} />
                             </button>
                           )}
                       </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {displayReports.length === 0 && (
             <div className="p-12 text-center text-slate-300 font-bold uppercase tracking-widest text-xs">
               Tidak ada laporan aktivitas pada rentang tanggal ini.
             </div>
          )}
        </div>
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
