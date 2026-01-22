 
import React, { useState, useEffect } from 'react';
import { User, LeaveRequest, RequestType, RequestStatus, UserRole } from '../types';
import { FileText, Plus, Check, X, Clock, AlertCircle, ImageIcon, UploadCloud, History, CheckCircle2, Eye } from 'lucide-react';
import { useToast } from './Toast';
import { useAppStore } from '../context/StoreContext';

interface RequestsProps {
  currentUser: User;
  users: User[]; // Added users prop
  requests: LeaveRequest[];
  onAddRequest: (req: LeaveRequest) => void;
  onUpdateRequest: (req: LeaveRequest) => void;
  toast: ReturnType<typeof useToast>;
  uploadFile?: (file: File) => Promise<string>;
}

const RequestsModule: React.FC<RequestsProps> = ({ currentUser, users, requests, onAddRequest, onUpdateRequest, toast, uploadFile }) => {
  const store = useAppStore();

  const [showAdd, setShowAdd] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<LeaveRequest | null>(null);
  const [attachment, setAttachment] = useState<string | null>(null);
  
  // SERVER-SIDE FILTER STATE (Auto Fetch)
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
  const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];

  const [filterStart, setFilterStart] = useState(firstDay);
  const [filterEnd, setFilterEnd] = useState(lastDay);

  // Auto-Fetch when Date Range Changes
  useEffect(() => {
    if (store.fetchRequests) {
        const timer = setTimeout(() => {
            store.fetchRequests(filterStart, filterEnd);
        }, 500);
        return () => clearTimeout(timer);
    }
  }, [filterStart, filterEnd]);

  const [formData, setFormData] = useState({
    type: RequestType.IZIN,
    description: '',
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });
  const [actionNote, setActionNote] = useState('');

  // Reset note when modal opens
  useEffect(() => {
     if (selectedRequest) {
        setActionNote(selectedRequest.actionNote || ''); 
     } else {
        setActionNote('');
     }
  }, [selectedRequest]);

  // PERMISSION LOGIC
  const isManagement = [UserRole.OWNER, UserRole.MANAGER, UserRole.FINANCE].includes(currentUser.role);
  // Allow everyone to create (except Owner usually, but Manager/Finance can)
  const canCreate = currentUser.role !== UserRole.OWNER; 

  // DATA VISIBILITY
  // Management sees ALL, Staff sees OWN
  const visibleRequests = isManagement 
    ? requests 
    : requests.filter(r => r.userId === currentUser.id);

  const sortRequests = (data: LeaveRequest[]) => {
     return [...data].sort((a, b) => b.createdAt - a.createdAt);
  };

  const validateRequest = () => {
    if (!formData.description) {
        toast.warning("Harap tuliskan alasan permohonan.");
        return false;
    }
    
    const start = new Date(formData.startDate);
    const end = new Date(formData.endDate || formData.startDate);
    const diffDays = Math.ceil((start.getTime() - new Date().setHours(0,0,0,0)) / (86400000));

    if (formData.type === RequestType.SAKIT && !attachment) {
        toast.warning("Wajib lampirkan bukti/surat sakit.");
        return false;
    }
    if (formData.type === RequestType.CUTI && diffDays < 7 && currentUser.role === UserRole.STAFF) {
        toast.info("Info: Pengajuan Cuti idealnya H-7.");
    }
    if (end < start) {
        toast.warning("Tanggal selesai tidak boleh sebelum mulai.");
        return false;
    }
    
    return true;
  };

  const handleSubmit = async () => {
    if (!validateRequest()) return;
    try {
      const req: LeaveRequest = {
        id: Math.random().toString(36).substr(2, 9),
        userId: currentUser.id,
        status: RequestStatus.PENDING,
        createdAt: Date.now(),
        attachmentUrl: attachment || undefined,
        ...formData
      };
      await onAddRequest(req);
      setShowAdd(false);
      setAttachment(null);
      setFormData({ type: RequestType.IZIN, description: '', startDate: new Date().toISOString().split('T')[0], endDate: new Date().toISOString().split('T')[0] });
      toast.success(`Permohonan dikirim.`);
      // Refresh list
      if (store.fetchRequests) store.fetchRequests(filterStart, filterEnd);
    } catch (err: any) {
      toast.error("Gagal mengirim permohonan.");
    }
  };

  const handleAction = async (req: LeaveRequest, status: RequestStatus) => {
    if (!isManagement) return;

    if (status === RequestStatus.REJECTED && !actionNote.trim()) {
        toast.warning("Mohon sertakan alasan penolakan pada catatan.");
        return;
    }

    try {
      await onUpdateRequest({
        ...req,
        status,
        approverId: currentUser.id,
        approverName: currentUser.name,
        actionNote: actionNote,
        actionAt: Date.now()
      });
      toast.success(`Permohonan ${status === RequestStatus.APPROVED ? 'DISETUJUI' : 'DITOLAK'}`);
      setSelectedRequest(null); // Close modal immediately
    } catch (err: any) {
      console.error(err);
      toast.error("Gagal memproses aksi. Coba refresh halaman.");
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (uploadFile) {
        toast.info("Uploading...");
        uploadFile(file).then(setAttachment).catch(() => toast.error("Upload gagal"));
    } else {
        const reader = new FileReader();
        reader.onloadend = () => setAttachment(reader.result as string);
        reader.readAsDataURL(file);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h3 className="text-xl font-bold text-slate-800">Izin & Cuti</h3>
          <p className="text-sm text-slate-500 uppercase font-black tracking-widest">
            {isManagement ? 'Portal Approval Manajemen' : 'Portal Kehadiran'}
          </p>
          
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
        {canCreate && (
          <button onClick={() => setShowAdd(true)} className="bg-blue-600 text-white px-6 py-3 rounded-2xl flex items-center gap-2 font-black text-xs uppercase tracking-widest hover:bg-blue-700 shadow-lg shadow-blue-200 transition">
            <Plus size={16} /> <span>Ajukan Baru</span>
          </button>
        )}
      </div>

      <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Pemohon</th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Tanggal Pelaksanaan</th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Keperluan</th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Status</th>
                <th className="px-6 py-5 text-right text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-xs font-bold text-slate-600">
              {sortRequests(visibleRequests).map(req => {
                const applicant = users.find(u => u.id === req.userId);
                return (
                  <tr 
                    key={req.id} 
                    onClick={() => setSelectedRequest(req)}
                    className="hover:bg-blue-50/50 cursor-pointer transition-colors group"
                  >
                    <td className="px-6 py-5">
                       <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 font-black text-xs border-2 border-white shadow-sm overflow-hidden">
                             {applicant?.avatarUrl ? (
                                <img src={applicant.avatarUrl} alt={applicant.name} className="w-full h-full object-cover" />
                             ) : (
                                applicant?.name.charAt(0)
                             )}
                          </div>
                          <div>
                             <p className="text-slate-800 font-bold">{applicant?.name || 'Unknown'}</p>
                             <div className="flex items-center gap-2 mt-1">
                                <span className={`text-[9px] px-2 py-0.5 rounded flex items-center gap-1 uppercase tracking-wider ${
                                   req.type === RequestType.SAKIT ? 'bg-rose-100 text-rose-600' : 
                                   req.type === RequestType.CUTI ? 'bg-indigo-100 text-indigo-600' : 'bg-amber-100 text-amber-600'
                                }`}>
                                   {req.type}
                                </span>
                             </div>
                          </div>
                       </div>
                    </td>
                    <td className="px-6 py-5 text-slate-500">
                        {new Date(req.startDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                        {req.endDate !== req.startDate && ` - ${new Date(req.endDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}`}
                        <br/>
                        <span className="text-[9px] text-slate-400 font-normal uppercase tracking-wider">
                           Diajukan: {new Date(req.createdAt).toLocaleDateString()}
                        </span>
                    </td>
                    <td className="px-6 py-5 max-w-xs truncate opacity-80 group-hover:opacity-100">
                        {req.description}
                    </td>
                    <td className="px-6 py-5">
                        <span className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest flex w-fit items-center gap-2 ${
                            req.status === RequestStatus.APPROVED ? 'bg-emerald-100 text-emerald-600' :
                            req.status === RequestStatus.REJECTED ? 'bg-rose-100 text-rose-600' :
                            'bg-slate-100 text-slate-500'
                        }`}>
                           {req.status === RequestStatus.PENDING && <Clock size={12} className="animate-spin" />}
                           {req.status}
                        </span>
                    </td>
                    <td className="px-6 py-5 text-right">
                       {isManagement && req.status === RequestStatus.PENDING ? (
                          <div className="flex justify-end gap-2" onClick={e => e.stopPropagation()}>
                             <button onClick={() => handleAction(req, RequestStatus.APPROVED)} className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-600 hover:bg-emerald-500 hover:text-white flex items-center justify-center transition shadow-sm"><Check size={14} /></button>
                             <button onClick={() => handleAction(req, RequestStatus.REJECTED)} className="w-8 h-8 rounded-full bg-rose-50 text-rose-600 hover:bg-rose-500 hover:text-white flex items-center justify-center transition shadow-sm"><X size={14} /></button>
                          </div>
                       ) : (
                          <button className="text-[10px] font-bold text-blue-500 hover:underline">LIHAT DETAIL</button>
                       )}
                    </td>
                  </tr>
                );
              })}
              {visibleRequests.length === 0 && (
                <tr><td colSpan={5} className="p-10 text-center text-slate-300 font-bold uppercase tracking-widest text-xs">Tidak ada data permohonan</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* DETAIL MODAL WITH AUDIT LOG */}
      {selectedRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200" onClick={() => setSelectedRequest(null)}>
           <div className="bg-white rounded-[2.5rem] w-full max-w-2xl p-8 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 border border-white/20" onClick={e => e.stopPropagation()}>
              
              <div className="flex justify-between items-start mb-8">
                 <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 font-black text-xl overflow-hidden border-4 border-white shadow-lg">
                       {users.find(u => u.id === selectedRequest.userId)?.avatarUrl ? (
                            <img src={users.find(u => u.id === selectedRequest.userId)?.avatarUrl} alt="Avatar" className="w-full h-full object-cover"/>
                       ) : (
                           users.find(u => u.id === selectedRequest.userId)?.name.charAt(0)
                       )}
                    </div>
                    <div>
                       <h3 className="text-2xl font-black text-slate-800">{users.find(u => u.id === selectedRequest.userId)?.name}</h3>
                       <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">{selectedRequest.type}</p>
                    </div>
                 </div>
                 <button onClick={() => setSelectedRequest(null)} className="p-2 bg-slate-50 rounded-full hover:bg-rose-100 hover:text-rose-600 transition"><X size={20}/></button>
              </div>

              <div className="grid md:grid-cols-2 gap-8 mb-8">
                  <div className="space-y-6">
                      <div className="space-y-1">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">TANGGAL PELAKSANAAN</p>
                          <p className="text-sm font-bold text-slate-800">
                             {new Date(selectedRequest.startDate).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                             {selectedRequest.startDate !== selectedRequest.endDate && (
                                <span className="block text-slate-500 mt-1">s/d {new Date(selectedRequest.endDate).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span>
                             )}
                          </p>
                      </div>
                      <div className="space-y-1">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">ALASAN DETAIL</p>
                          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-sm font-medium text-slate-600 italic leading-relaxed">
                             "{selectedRequest.description}"
                          </div>
                      </div>
                  </div>
                  <div className="space-y-6">
                      <div className="space-y-1">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">STATUS SAAT INI</p>
                          <div className={`px-4 py-3 rounded-xl border-2 text-xs font-black uppercase tracking-widest text-center ${
                             selectedRequest.status === RequestStatus.APPROVED ? 'bg-emerald-50 border-emerald-100 text-emerald-600' :
                             selectedRequest.status === RequestStatus.REJECTED ? 'bg-rose-50 border-rose-100 text-rose-600' :
                             'bg-slate-50 border-slate-100 text-slate-500'
                          }`}>
                              {selectedRequest.status}
                          </div>
                      </div>
                       {selectedRequest.attachmentUrl && (
                          <div className="space-y-1">
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">LAMPIRAN BUKTI</p>
                              <a href={selectedRequest.attachmentUrl} target="_blank" className="block relative aspect-video rounded-xl overflow-hidden group shadow-sm bg-slate-100">
                                  <img src={selectedRequest.attachmentUrl} className="w-full h-full object-cover transition duration-500 group-hover:scale-110" />
                                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                                      <p className="text-white text-[10px] font-black uppercase tracking-widest">LIHAT GAMBAR</p>
                                  </div>
                              </a>
                          </div>
                       )}
                  </div>
              </div>

              {/* AUDIT LOG SECTION */}
              <div className="border-t border-slate-100 pt-6">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                       <History size={12}/> AUDIT LOG & APPROVAL
                  </p>
                  
                  {selectedRequest.status === RequestStatus.PENDING ? (
                      <div className="bg-amber-50 p-4 rounded-xl flex items-center gap-3 text-amber-700">
                           <Clock size={16} />
                           <p className="text-xs font-bold">Menunggu persetujuan dari Manajemen.</p>
                      </div>
                  ) : (
                      <div className={`p-4 rounded-xl flex flex-col gap-2 ${selectedRequest.status === RequestStatus.APPROVED ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'}`}>
                           <div className="flex items-start gap-3">
                               {selectedRequest.status === RequestStatus.APPROVED ? <CheckCircle2 size={18} className="mt-0.5 text-emerald-600"/> : <AlertCircle size={18} className="mt-0.5 text-rose-600"/>}
                               <div>
                                  <p className="text-xs font-black uppercase tracking-wide">
                                     {selectedRequest.status === RequestStatus.APPROVED ? 'DISETUJUI OLEH' : 'DITOLAK OLEH'}: 
                                     <span className="ml-1 inline-flex items-center gap-1">
                                        {selectedRequest.approverId && users.find(u => u.id === selectedRequest.approverId)?.avatarUrl && (
                                            <img src={users.find(u => u.id === selectedRequest.approverId)?.avatarUrl} className="w-4 h-4 rounded-full object-cover border border-white" />
                                        )}
                                        {users.find(u => u.id === selectedRequest.approverId)?.name || selectedRequest.approverName || 'Manajemen'}
                                     </span>
                                  </p>
                                  <p className="text-[10px] opacity-70 font-bold mt-1">
                                     Pada: {selectedRequest.actionAt ? new Date(selectedRequest.actionAt).toLocaleString('id-ID') : '-'}
                                  </p>
                               </div>
                           </div>
                           {selectedRequest.actionNote && (
                               <div className="ml-8 mt-1 p-3 bg-white/60 rounded-lg border border-black/5 text-xs italic">
                                   "{selectedRequest.actionNote}"
                               </div>
                           )}
                      </div>
                  )}

                  {/* ACTION BUTTONS FOR MANAGEMENT */}
                  {isManagement && selectedRequest.status === RequestStatus.PENDING && (
                      <div className="mt-6 space-y-4">
                           <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Catatan Approval (Wajib jika Ditolak)</label>
                                <textarea 
                                    className="w-full p-4 bg-slate-50 rounded-xl font-medium text-xs outline-none border border-slate-100 focus:border-blue-200 transition resize-none h-24" 
                                    placeholder="Tuliskan alasan penolakan atau catatan tambahan..."
                                    value={actionNote}
                                    onChange={e => setActionNote(e.target.value)}
                                />
                           </div>
                           <div className="flex gap-4">
                               <button onClick={() => handleAction(selectedRequest, RequestStatus.REJECTED)} className="flex-1 py-4 bg-white border-2 border-slate-100 text-slate-400 font-black uppercase tracking-widest rounded-xl hover:border-rose-100 hover:bg-rose-50 hover:text-rose-600 transition text-[10px]">TOLAK</button>
                               <button onClick={() => handleAction(selectedRequest, RequestStatus.APPROVED)} className="flex-1 py-4 bg-emerald-600 text-white font-black uppercase tracking-widest rounded-xl hover:bg-emerald-700 shadow-lg shadow-emerald-200 transition text-[10px]">SETUJUI PERMOHONAN</button>
                           </div>
                      </div>
                  )}
              </div>
           </div>
        </div>
      )}

      {/* ADD MODAL */}
      {showAdd && (
         <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/90 p-4 backdrop-blur-md" onClick={() => setShowAdd(false)}>
             <div className="bg-white p-10 rounded-[2.5rem] w-full max-w-lg shadow-2xl animate-in fade-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                 <h3 className="text-2xl font-black text-slate-800 mb-6 uppercase">Buat Permohonan</h3>
                 <div className="space-y-4">
                     {/* Form Inputs Simplified for this rewrite step, can match previous full form */}
                     <div className="grid grid-cols-3 gap-2">
                        {[RequestType.IZIN, RequestType.SAKIT, RequestType.CUTI].map(t => (
                            <button key={t} onClick={() => setFormData({...formData, type: t})} className={`py-3 rounded-xl text-[10px] font-black uppercase ${formData.type === t ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400'}`}>{t}</button>
                        ))}
                     </div>
                     <input type="date" className="w-full p-4 bg-slate-50 rounded-xl font-bold text-xs outline-none" value={formData.startDate} onChange={e => setFormData({...formData, startDate: e.target.value})} />
                     <input type="date" className="w-full p-4 bg-slate-50 rounded-xl font-bold text-xs outline-none" value={formData.endDate || formData.startDate} onChange={e => setFormData({...formData, endDate: e.target.value})} />
                     <textarea className="w-full p-4 bg-slate-50 rounded-xl font-bold text-xs outline-none h-24 resize-none" placeholder="Alasan..." value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
                     <input type="file" onChange={handleFileChange} className="text-xs" />
                     <button onClick={handleSubmit} className="w-full py-4 bg-slate-900 text-white rounded-xl font-black uppercase text-xs tracking-widest mt-4 hover:bg-blue-600 transition">Kirim Pengajuan</button>
                 </div>
             </div>
         </div>
      )}
    </div>
  );
};

export default RequestsModule;
