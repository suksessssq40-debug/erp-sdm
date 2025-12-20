import React, { useState } from 'react';
import { User, DailyReport, UserRole } from '../types';
import { Plus, CheckCircle2, History, Link as LinkIcon, Image as ImageIcon, Send, Eye, X } from 'lucide-react';
import { useToast } from './Toast';

interface DailyReportProps {
  currentUser: User;
  users: User[];
  reports: DailyReport[];
  onAddReport: (report: DailyReport) => void;
  toast: ReturnType<typeof useToast>;
}

const DailyReportModule: React.FC<DailyReportProps> = ({ currentUser, users, reports, onAddReport, toast }) => {
  const [showAdd, setShowAdd] = useState(false);
  const [selectedReport, setSelectedReport] = useState<DailyReport | null>(null);
  const [activities, setActivities] = useState([{ task: '', quantity: 1, link: '' }]);

  const handleAddActivity = () => setActivities([...activities, { task: '', quantity: 1, link: '' }]);
  const handleRemoveActivity = (idx: number) => setActivities(activities.filter((_, i) => i !== idx));

  const submitReport = async () => {
    if (activities.some(a => !a.task)) {
      toast.warning("Harap isi semua tugas harian sebelum menyimpan laporan.");
      return;
    }
    try {
      const report: DailyReport = {
        id: Math.random().toString(36).substr(2, 9),
        userId: currentUser.id,
        date: new Date().toDateString(),
        activities: activities.map(a => ({ ...a, quantity: Number(a.quantity) }))
      };
      await onAddReport(report);
      setShowAdd(false);
      setActivities([{ task: '', quantity: 1, link: '' }]);
      toast.success(`Laporan harian dengan ${activities.length} aktivitas berhasil disimpan!`);
    } catch (err: any) {
      toast.error(err?.message || 'Gagal menyimpan laporan harian. Periksa koneksi dan coba lagi.');
    }
  };

  const isOwner = currentUser.role === UserRole.OWNER;
  const isManagementOverseer = [UserRole.OWNER, UserRole.MANAGER].includes(currentUser.role);
  // Show reporting capability to all roles EXCEPT owner as requested
  const canReport = currentUser.role !== UserRole.OWNER;
  
  const displayReports = isOwner ? reports : reports.filter(r => r.userId === currentUser.id || (isManagementOverseer && r.date === new Date().toDateString()));

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-xl font-bold text-slate-800">Laporan Harian</h3>
          <p className="text-sm text-slate-500 uppercase font-black tracking-widest">Update aktivitas tim Sukses Digital Media</p>
        </div>
        {canReport && (
          <button 
            onClick={() => setShowAdd(true)}
            className="bg-slate-900 text-white px-8 py-3 rounded-[1.5rem] flex items-center space-x-3 font-black text-xs uppercase tracking-widest shadow-2xl hover:bg-blue-600 transition"
          >
            <Plus size={18} /> <span>BUAT LAPORAN</span>
          </button>
        )}
      </div>

      <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
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
                return (
                  <tr key={report.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-5">
                      <span className="text-xs font-bold text-slate-700">{report.date}</span>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center font-black text-xs">
                          {user?.name.charAt(0)}
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
                       <button onClick={() => setSelectedReport(report)} className="p-2 bg-slate-100 text-slate-500 rounded-xl hover:bg-blue-600 hover:text-white transition group">
                          <Eye size={16} />
                       </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {displayReports.length === 0 && (
             <div className="p-12 text-center text-slate-300 font-bold uppercase tracking-widest text-xs">
               Belum ada laporan aktivitas
             </div>
          )}
        </div>
      </div>

      {/* View Detail Modal */}
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
                          <p className="text-sm font-bold text-slate-800">{act.task}</p>
                          <span className="bg-white px-2 py-1 rounded-lg text-[10px] font-black text-blue-600 shadow-sm">{act.quantity}x</span>
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
          <div className="bg-white rounded-[3.5rem] w-full max-w-xl p-12 shadow-2xl overflow-hidden flex flex-col border border-white/20">
            <h3 className="text-3xl font-black text-slate-800 mb-10 uppercase tracking-tight leading-none italic">Log Aktivitas<br/><span className="text-blue-600">Produktivitas Harian</span></h3>
            <div className="flex-1 overflow-y-auto space-y-8 pr-4 custom-scrollbar max-h-[60vh]">
              {activities.map((act, idx) => (
                <div key={idx} className="bg-slate-50 p-8 rounded-[2.5rem] space-y-6 border border-slate-100 relative group animate-in slide-in-from-right duration-300">
                  <button onClick={() => handleRemoveActivity(idx)} className="absolute top-6 right-6 text-slate-300 hover:text-rose-500 transition-colors">✕</button>
                  <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">TUGAS / PEKERJAAN</label>
                    <input 
                      className="w-full p-5 bg-white border-2 border-transparent rounded-[1.5rem] text-xs font-black focus:border-blue-600 outline-none shadow-sm transition"
                      value={act.task}
                      onChange={e => {
                        const newAct = [...activities];
                        newAct[idx].task = e.target.value;
                        setActivities(newAct);
                      }}
                      placeholder="Apa yang telah dikerjakan?"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <label className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">KUANTITAS (QTY)</label>
                      <input 
                        type="number"
                        className="w-full p-5 bg-white border-2 border-transparent rounded-xl text-xs font-black focus:border-blue-600 outline-none shadow-sm transition text-center"
                        value={act.quantity}
                        onChange={e => {
                          const newAct = [...activities];
                          newAct[idx].quantity = Number(e.target.value);
                          setActivities(newAct);
                        }}
                      />
                    </div>
                    <div className="space-y-3">
                      <label className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">LINK HASIL (OPS)</label>
                      <input 
                        className="w-full p-5 bg-white border-2 border-transparent rounded-xl text-xs font-black focus:border-blue-600 outline-none shadow-sm transition"
                        value={act.link}
                        onChange={e => {
                          const newAct = [...activities];
                          newAct[idx].link = e.target.value;
                          setActivities(newAct);
                        }}
                        placeholder="Link GDrive/Web"
                      />
                    </div>
                  </div>
                </div>
              ))}
              <button onClick={handleAddActivity} className="w-full py-5 border-2 border-dashed border-slate-200 rounded-[2rem] text-[11px] font-black uppercase tracking-widest text-slate-400 hover:border-blue-300 hover:text-blue-600 transition-all duration-300 flex items-center justify-center gap-3">
                <Plus size={16} /> TAMBAH LIST TUGAS LAGI
              </button>
            </div>
            <div className="flex gap-6 mt-12 pt-8 border-t border-slate-50">
              <button onClick={() => setShowAdd(false)} className="flex-1 py-5 text-slate-400 font-black uppercase tracking-widest hover:bg-slate-50 rounded-[1.5rem] text-[10px] transition">BATAL</button>
              <button onClick={submitReport} className="flex-1 bg-slate-900 text-white py-5 rounded-[1.5rem] font-black uppercase tracking-[0.2em] text-[10px] shadow-2xl shadow-slate-100 hover:bg-blue-600 transition">LAPORKAN AKTIVITAS</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DailyReportModule;
