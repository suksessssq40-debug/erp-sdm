import React, { useState } from 'react';
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
  const store = useAppStore(); // Access store for settings (Telegram Token)
  const [showAdd, setShowAdd] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingReport, setEditingReport] = useState<DailyReport | null>(null);
  const [selectedReport, setSelectedReport] = useState<DailyReport | null>(null);
  const [monthFilter, setMonthFilter] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [activities, setActivities] = useState([{ task: '', quantity: 1, unit: '', link: '' }]);

  const handleAddActivity = () => setActivities([...activities, { task: '', quantity: 1, unit: '', link: '' }]);
  const handleRemoveActivity = (idx: number) => setActivities(activities.filter((_, i) => i !== idx));

  const sendTelegramReport = async (report: DailyReport) => {
    const { telegramBotToken, telegramOwnerChatId, telegramGroupId } = store.settings;

    // DEBUG: Check what values are actually loaded
    console.log("DailyReport Tele Debug:", { 
        hasToken: !!telegramBotToken, 
        hasOwner: !!telegramOwnerChatId, 
        hasGroup: !!telegramGroupId,
        botTokenHint: telegramBotToken ? telegramBotToken.substring(0,5) + '...' : 'NONE'
    });

    if (!telegramBotToken) {
       console.log("Telegram Bot Token is MISSING.");
       toast.warning("Gagal kirim Telegram: Bot Token belum diisi di Settings.");
       return;
    }

    if (!telegramOwnerChatId && !telegramGroupId) {
       console.log("No destination (Owner/Group) set.");
       toast.warning("Gagal kirim Telegram: Belum ada tujuan (ID Owner / ID Group) di Settings.");
       return;
    }

    const activityList = report.activities
      .map((a, i) => `${i + 1}. ${a.task} — *${a.quantity} ${a.unit || 'x'}* ${a.link ? '[Link]' : ''}`)
      .join('\n');

    const message = `
📝 *LAPORAN HARIAN BARU*
📅 *Tanggal:* ${new Date(report.date).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
👤 *Oleh:* ${currentUser.name} (@${currentUser.username})

*Rincian Aktivitas:*
${activityList}

_Dikirim dari Sistem ERP SDM_
    `.trim();

    try {
      const promises = [];

      // Priority 1: Send to Group (Shared visibility)
      if (telegramGroupId) {
         promises.push(
             fetch(`https://api.telegram.org/bot${telegramBotToken}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chat_id: telegramGroupId, text: message, parse_mode: 'Markdown' })
             })
         );
      }

      // Priority 2: Send to Owner (Control)
      // Only send to owner if explicitly set AND different from Group (to avoid double notif if Owner is testing in group)
      if (telegramOwnerChatId && telegramOwnerChatId !== telegramGroupId) {
         promises.push(
             fetch(`https://api.telegram.org/bot${telegramBotToken}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chat_id: telegramOwnerChatId, text: message, parse_mode: 'Markdown' })
             })
         );
      }

      await Promise.all(promises);
      console.log("Telegram notification sent successfully.");

    } catch (e) {
      console.error("Failed to send Telegram notification:", e);
    }
  };

  const submitReport = async () => {
    if (activities.some(a => !a.task)) {
      toast.warning("Harap isi semua tugas harian sebelum menyimpan laporan.");
      return;
    }
    
    if (isSubmitting) return; // Prevent Double Click
    setIsSubmitting(true);

    try {
      // FIX: Use Jakarta Timezone for Date String (YYYY-MM-DD)
      // If we use toISOString(), 1 AM Jakarta (18 PM UTC) becomes Yesterday. We must adhere to Jakarta day.
      const jakartaDateStr = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Jakarta' });
      const isoDate = jakartaDateStr; 
      
      const reportData: DailyReport = {
        id: editingReport ? editingReport.id : Math.random().toString(36).substr(2, 9),
        userId: currentUser.id,
        date: editingReport ? editingReport.date : isoDate, // Keep original date if editing
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
          // Trigger Telegram only on Create (to avoid spam on edit)
          toast.info("Memproses notifikasi...");
          await sendTelegramReport(reportData);
          toast.success(`Laporan harian berhasil disimpan!`);
      }

      setShowAdd(false);
      setActivities([{ task: '', quantity: 1, unit: '', link: '' }]);
      setEditingReport(null);
    } catch (err: any) {
      toast.error(err?.message || 'Gagal menyimpan laporan harian.');
    } finally {
        setIsSubmitting(false);
    }
  };

  // ACCESS CONTROL
  // 1. View All: Owner, Manager, Finance must see ALL reports from ALL history (Superadmin view)
  const canViewAll = [UserRole.OWNER, UserRole.MANAGER, UserRole.FINANCE].includes(currentUser.role);
  
  // 2. Create Report: Staff, Manager, Finance can create. Owner usually monitors but logic allows != Owner.
  const canReport = currentUser.role !== UserRole.OWNER; 

  // Filter Logic:
  // - Management: Sees EVERYTHING (Filtered by Month)
  // - Staff: Sees only OWN reports (Filtered by Month)
  
  const filteredByRole = canViewAll 
    ? reports 
    : reports.filter(r => r.userId === currentUser.id);

  const displayReports = filteredByRole.filter(r => r.date.startsWith(monthFilter));

  const prepareEdit = (report: DailyReport) => {
      setEditingReport(report);
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
      {/* ... header ... */}
      <div className="flex justify-between items-center">
        <div className="flex flex-col gap-2">
          <h3 className="text-xl font-bold text-slate-800">Laporan Harian</h3>
          <p className="text-sm text-slate-500 uppercase font-black tracking-widest">Update aktivitas tim Sukses Digital Media</p>
          
          {/* Month Filter */}
          <div className="flex items-center gap-2 mt-2">
             <Calendar size={16} className="text-slate-400" />
             <input 
                type="month" 
                value={monthFilter}
                onChange={e => setMonthFilter(e.target.value)}
                className="bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 rounded-lg px-3 py-1 outline-none focus:border-blue-500 transition"
             />
          </div>
        </div>
        {canReport && (
          <button 
            onClick={() => {
                setEditingReport(null);
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
                       {/* Edit/Delete if Own Report */}
                       {report.userId === currentUser.id && (
                           <>
                             <button onClick={() => prepareEdit(report)} className="p-2 bg-slate-100 text-slate-500 rounded-xl hover:bg-amber-500 hover:text-white transition group mr-2">
                                <Pencil size={16} />
                             </button>
                             <button onClick={() => handleDelete(report.id)} className="p-2 bg-slate-100 text-slate-500 rounded-xl hover:bg-rose-600 hover:text-white transition group">
                                <Trash2 size={16} />
                             </button>
                           </>
                       )}
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
            <h3 className="text-3xl font-black text-slate-800 mb-10 uppercase tracking-tight leading-none italic">
                {editingReport ? 'Edit Laporan' : 'Log Aktivitas'}<br/>
                <span className="text-blue-600">{editingReport ? 'Perbarui Data' : 'Produktivitas Harian'}</span>
            </h3>
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
