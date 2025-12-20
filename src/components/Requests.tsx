
import React, { useState } from 'react';
import { User, LeaveRequest, RequestType, RequestStatus, UserRole } from '../types';
import { FileText, Plus, Check, X, Clock, AlertCircle, ImageIcon, UploadCloud } from 'lucide-react';
import { useToast } from './Toast';

interface RequestsProps {
  currentUser: User;
  requests: LeaveRequest[];
  onAddRequest: (req: LeaveRequest) => void;
  onUpdateRequest: (req: LeaveRequest) => void;
  toast: ReturnType<typeof useToast>;
  uploadFile?: (file: File) => Promise<string>;
}

const RequestsModule: React.FC<RequestsProps> = ({ currentUser, requests, onAddRequest, onUpdateRequest, toast, uploadFile }) => {
  const [showAdd, setShowAdd] = useState(false);
  const [attachment, setAttachment] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    type: RequestType.IZIN,
    description: '',
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });

  const validateRequest = () => {
    if (!formData.description) {
      toast.warning("Harap tuliskan alasan permohonan dengan jelas.");
      return false;
    }

    const start = new Date(formData.startDate);
    const end = new Date(formData.endDate || formData.startDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const diffTime = start.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (formData.type === RequestType.IZIN) {
       // Rule: H-1 (Simplify: Cannot be past date)
       if (diffDays < 1 && start.getDate() !== today.getDate()) {
         // Allow same day if urgency, but warn
       }
    }

    if (formData.type === RequestType.SAKIT) {
       if (!attachment) {
        toast.warning("Wajib melampirkan foto bukti atau surat dokter untuk permohonan SAKIT.");
        return false;
       }
    }

    if (formData.type === RequestType.CUTI) {
      if (diffDays < 14) {
        toast.warning("Permohonan CUTI harus dilakukan minimal H-14 sebelum tanggal mulai.");
        return false;
      }
      if (!attachment) {
         toast.warning("Wajib melampirkan foto formulir/pendukung untuk permohonan CUTI.");
         return false;
      }
    }

    if (end < start) {
      toast.warning("Tanggal selesai tidak boleh sebelum tanggal mulai.");
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
      toast.success(`Permohonan ${formData.type} berhasil diajukan. Menunggu persetujuan.`);
    } catch (err: any) {
      toast.error(err?.message || 'Gagal mengajukan permohonan. Periksa koneksi dan coba lagi.');
    }
  };

  const handleAction = async (req: LeaveRequest, status: RequestStatus) => {
    try {
      await onUpdateRequest({ ...req, status });
      toast.success(`Permohonan ${req.type} dari ${req.userId} telah ${status === RequestStatus.APPROVED ? 'disetujui' : 'ditolak'}.`);
    } catch (err: any) {
      toast.error(err?.message || 'Gagal memproses permohonan. Periksa koneksi dan coba lagi.');
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.warning("File terlalu besar (Maks 5MB)");
        return;
      }
      if (uploadFile) {
        try {
          toast.info("Mengupload dokumen...");
          const url = await uploadFile(file);
          setAttachment(url);
          toast.success("Dokumen terlampir.");
        } catch(e) {
          toast.error("Gagal upload dokumen.");
        }
      } else {
        const reader = new FileReader();
        reader.onloadend = () => setAttachment(reader.result as string);
        reader.readAsDataURL(file);
      }
    }
  };

  // Rule: Management (except Owner) and Staff can create requests. Owner only overseer.
  const isOwner = currentUser.role === UserRole.OWNER;
  const isManagementOverseer = [UserRole.OWNER, UserRole.MANAGER].includes(currentUser.role);
  const visibleRequests = isOwner ? requests : requests.filter(r => r.userId === currentUser.id || (isManagementOverseer && r.status === RequestStatus.PENDING));

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-xl font-bold text-slate-800">Izin & Permohonan</h3>
          <p className="text-sm text-slate-500 uppercase font-black tracking-widest">Sentral permohonan kehadiran SDM Core</p>
        </div>
        {!isOwner && (
          <button onClick={() => setShowAdd(true)} className="bg-blue-600 text-white px-8 py-3 rounded-2xl flex items-center space-x-3 font-black text-xs uppercase tracking-widest shadow-xl shadow-blue-200 hover:bg-blue-700 transition">
            <Plus size={18} /> <span>AJUKAN PERMOHONAN</span>
          </button>
        )}
      </div>

      <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Info Jenis</th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Tanggal</th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Detail Alasan</th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Bukti</th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Status</th>
                {isManagementOverseer && <th className="px-6 py-5 text-right text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Aksi</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {visibleRequests.slice().reverse().map(req => (
                <tr key={req.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                        req.type === RequestType.SAKIT ? 'bg-rose-50 text-rose-500' : 
                        req.type === RequestType.CUTI ? 'bg-indigo-50 text-indigo-500' : 'bg-amber-50 text-amber-500'
                      }`}>
                        <FileText size={16} />
                      </div>
                      <span className={`text-[10px] font-black uppercase tracking-[0.2em] ${
                        req.type === RequestType.SAKIT ? 'text-rose-600' : 
                        req.type === RequestType.CUTI ? 'text-indigo-600' : 'text-amber-600'
                      }`}>{req.type}</span>
                    </div>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">ID: {req.userId}</p>
                  </td>
                  <td className="px-6 py-5">
                    <div className="text-xs font-bold text-slate-700">
                      {new Date(req.startDate).toLocaleDateString('id-ID', {day: 'numeric', month: 'long', year: 'numeric'})}
                    </div>
                    {req.endDate && req.endDate !== req.startDate && (
                       <div className="text-[10px] text-slate-400 font-medium">s/d {new Date(req.endDate).toLocaleDateString('id-ID', {day: 'numeric', month: 'long', year: 'numeric'})}</div>
                    )}
                  </td>
                  <td className="px-6 py-5">
                    <p className="text-xs font-medium text-slate-600 max-w-xs">{req.description}</p>
                  </td>
                  <td className="px-6 py-5">
                    {req.attachmentUrl ? (
                      <div className="flex items-center text-blue-500 text-[9px] font-black uppercase tracking-widest bg-blue-50 px-2 py-1 rounded w-fit gap-1">
                         <ImageIcon size={10} /> <span>ADA LAMPIRAN</span>
                      </div>
                    ) : '-'}
                  </td>
                  <td className="px-6 py-5">
                    <div className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest w-fit flex items-center gap-2 ${
                      req.status === RequestStatus.APPROVED ? 'bg-emerald-50 text-emerald-600' :
                      req.status === RequestStatus.REJECTED ? 'bg-rose-50 text-rose-600' : 'bg-slate-100 text-slate-400'
                    }`}>
                      {req.status === RequestStatus.PENDING && <Clock size={10} className="animate-spin" />}
                      <span>{req.status}</span>
                    </div>
                  </td>
                  {isManagementOverseer && (
                    <td className="px-6 py-5 text-right">
                       {req.status === RequestStatus.PENDING && (
                        <div className="flex justify-end gap-2">
                          <button onClick={() => handleAction(req, RequestStatus.APPROVED)} className="p-2 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100 transition" title="Setujui"><Check size={16} /></button>
                          <button onClick={() => handleAction(req, RequestStatus.REJECTED)} className="p-2 bg-rose-50 text-rose-600 rounded-lg hover:bg-rose-100 transition" title="Tolak"><X size={16} /></button>
                        </div>
                       )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {visibleRequests.length === 0 && (
             <div className="p-12 text-center text-slate-300 font-bold uppercase tracking-widest text-xs">
               Belum ada riwayat permohonan
             </div>
          )}
        </div>
      </div>

      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/90 backdrop-blur-md p-4">
          <div className="bg-white rounded-[3rem] w-full max-w-xl p-12 shadow-2xl border border-white/20 animate-in zoom-in duration-300 overflow-y-auto max-h-[90vh]">
            <h3 className="text-3xl font-black text-slate-800 mb-8 uppercase tracking-tight leading-none">Formulir<br/><span className="text-blue-600">Permohonan Izin</span></h3>
            
            <div className="space-y-8">
              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">JENIS IZIN / PERMOHONAN</label>
                <div className="grid grid-cols-3 gap-3">
                  {[RequestType.IZIN, RequestType.SAKIT, RequestType.CUTI].map(t => (
                    <button 
                      key={t}
                      onClick={() => setFormData({...formData, type: t})}
                      className={`py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest border-2 transition-all ${formData.type === t ? 'bg-blue-600 border-blue-600 text-white shadow-xl shadow-blue-100' : 'bg-slate-50 border-transparent text-slate-400 hover:bg-white hover:border-slate-100'}`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">PILIH TANGGAL MULAI</label>
                 <input 
                   type="date"
                   className="w-full p-5 bg-slate-50 border-2 border-transparent focus:border-blue-600 focus:bg-white rounded-2xl outline-none font-black text-xs transition"
                   value={formData.startDate}
                   onChange={e => setFormData({...formData, startDate: e.target.value})}
                 />
              </div>

              <div className="space-y-3">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">SAMPAI TANGGAL</label>
                 <input 
                   type="date"
                   className="w-full p-5 bg-slate-50 border-2 border-transparent focus:border-blue-600 focus:bg-white rounded-2xl outline-none font-black text-xs transition"
                   value={formData.endDate || formData.startDate}
                   onChange={e => setFormData({...formData, endDate: e.target.value})}
                 />
              </div>

              <div className="space-y-3">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">ALASAN DETAIL</label>
                 <textarea 
                   className="w-full p-5 bg-slate-50 border-2 border-transparent focus:border-blue-600 focus:bg-white rounded-2xl outline-none font-bold text-xs h-28 resize-none transition"
                   placeholder="Sebutkan alasan atau keperluan Anda..."
                   value={formData.description}
                   onChange={e => setFormData({...formData, description: e.target.value})}
                 />
              </div>

              <div className="space-y-3">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">LAMPIRAN PROOF (WAJIB SAKIT/CUTI)</label>
                 {!attachment ? (
                   <label className="w-full h-32 bg-slate-50 border-2 border-dashed border-slate-200 rounded-[2rem] flex flex-col items-center justify-center cursor-pointer hover:border-blue-300 hover:bg-blue-50 transition group">
                     <UploadCloud size={32} className="text-slate-300 group-hover:text-blue-500 transition mb-2" />
                     <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest group-hover:text-blue-600">Klik untuk upload foto/dokumen</span>
                     <input type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
                   </label>
                 ) : (
                   <div className="relative rounded-[2rem] overflow-hidden group">
                     <img src={attachment} alt="proof" className="w-full h-40 object-cover" />
                     <button onClick={() => setAttachment(null)} className="absolute top-4 right-4 p-2 bg-rose-500 text-white rounded-xl shadow-lg opacity-0 group-hover:opacity-100 transition">✕ Ganti</button>
                   </div>
                 )}
              </div>

              <div className="flex gap-4 pt-6 border-t border-slate-50">
                 <button onClick={() => setShowAdd(false)} className="flex-1 py-5 text-slate-400 font-black uppercase tracking-widest hover:bg-slate-50 rounded-[1.5rem] text-[10px] transition">BATAL</button>
                 <button onClick={handleSubmit} className="flex-1 bg-slate-900 text-white py-5 rounded-[1.5rem] font-black uppercase tracking-[0.2em] text-[10px] shadow-2xl shadow-slate-100 hover:bg-blue-600 transition">KIRIM PERMOHONAN</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RequestsModule;
