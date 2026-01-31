
import React, { useState, useEffect, useMemo } from 'react';
import { User, LeaveRequest, RequestType, RequestStatus, UserRole } from '../types';
import {
  FileText,
  Plus,
  Check,
  X,
  Clock,
  AlertCircle,
  ImageIcon,
  UploadCloud,
  History,
  CheckCircle2,
  Eye,
  Edit,
  Trash2,
  Calendar,
  Filter,
  User as UserIcon,
  ChevronRight,
  ArrowRight
} from 'lucide-react';
import { useToast } from './Toast';
import { useAppStore } from '../context/StoreContext';

interface RequestsProps {
  currentUser: User;
  users: User[];
  requests: LeaveRequest[];
  onAddRequest: (req: LeaveRequest) => void;
  onUpdateRequest: (req: LeaveRequest) => void;
  toast: ReturnType<typeof useToast>;
  uploadFile?: (file: File) => Promise<string>;
}

const RequestsModule: React.FC<RequestsProps> = ({ currentUser, users, requests, onAddRequest, onUpdateRequest, toast, uploadFile }) => {
  const store = useAppStore();

  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<LeaveRequest | null>(null);
  const [attachment, setAttachment] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Date filter initialized to empty to show all history by default
  const [filterStart, setFilterStart] = useState('');
  const [filterEnd, setFilterEnd] = useState('');

  // Debounced fetch when filter changes
  useEffect(() => {
    if (store.fetchRequests) {
      const timer = setTimeout(() => {
        store.fetchRequests(filterStart, filterEnd);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [filterStart, filterEnd, store.fetchRequests]);

  const [formData, setFormData] = useState({
    type: RequestType.IZIN,
    description: '',
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });
  const [actionNote, setActionNote] = useState('');

  // Sync action note when selected request changes
  useEffect(() => {
    if (selectedRequest) {
      setActionNote(selectedRequest.actionNote || '');
    } else {
      setActionNote('');
    }
  }, [selectedRequest]);

  // Permission logic
  const isManagement = [UserRole.OWNER, UserRole.MANAGER, UserRole.FINANCE].includes(currentUser.role as UserRole);
  const canCreate = currentUser.role !== UserRole.OWNER;

  // Data filtering
  const visibleRequests = useMemo(() => {
    return isManagement
      ? requests
      : requests.filter(r => r.userId === currentUser.id);
  }, [requests, isManagement, currentUser.id]);

  const sortedRequests = useMemo(() => {
    return [...visibleRequests].sort((a, b) => Number(b.createdAt) - Number(a.createdAt));
  }, [visibleRequests]);

  const validateRequest = () => {
    if (!formData.description.trim()) {
      toast.warning("Harap tuliskan alasan permohonan.");
      return false;
    }

    const start = new Date(formData.startDate);
    const end = new Date(formData.endDate || formData.startDate);

    if (formData.type === RequestType.SAKIT && !attachment) {
      toast.warning("Wajib lampirkan bukti/surat sakit.");
      return false;
    }

    if (end < start) {
      toast.warning("Tanggal selesai tidak boleh sebelum mulai.");
      return false;
    }

    return true;
  };

  const handleEdit = (req: LeaveRequest) => {
    setEditId(req.id);
    setFormData({
      type: req.type as RequestType,
      description: req.description || '',
      startDate: (req.startDate as any).includes('T') ? (req.startDate as any).split('T')[0] : req.startDate as any,
      endDate: (req.endDate as any).includes('T') ? (req.endDate as any).split('T')[0] : (req.endDate || req.startDate) as any
    });
    setAttachment(req.attachmentUrl || null);
    setShowAdd(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Apakah Anda yakin ingin menghapus data permohonan ini?")) return;

    try {
      if (store.deleteRequest) {
        await store.deleteRequest(id);
        toast.success("Berhasil menghapus data.");
        store.fetchRequests(filterStart, filterEnd);
      }
    } catch (e: any) {
      toast.error("Gagal menghapus data: " + (e.message || "Unknown error"));
    }
  };

  const handleSubmit = async () => {
    if (!validateRequest()) return;
    setIsSubmitting(true);
    try {
      if (editId) {
        const original = requests.find(r => r.id === editId);
        if (original) {
          await onUpdateRequest({
            ...original,
            ...formData,
            attachmentUrl: attachment || undefined
          });
          toast.success("Perubahan disimpan.");
        }
      } else {
        const req: LeaveRequest = {
          id: Math.random().toString(36).substr(2, 9),
          userId: currentUser.id,
          status: RequestStatus.PENDING,
          createdAt: Date.now() as any,
          attachmentUrl: attachment || undefined,
          ...formData
        };
        await onAddRequest(req);
        toast.success(`Permohonan dikirim.`);
      }
      handleCloseModal();
      if (store.fetchRequests) store.fetchRequests(filterStart, filterEnd);
    } catch (err: any) {
      toast.error("Gagal memproses permohonan.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCloseModal = () => {
    setShowAdd(false);
    setEditId(null);
    setAttachment(null);
    setFormData({
      type: RequestType.IZIN,
      description: '',
      startDate: new Date().toISOString().split('T')[0],
      endDate: new Date().toISOString().split('T')[0]
    });
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
        actionAt: Date.now() as any
      });
      toast.success(`Permohonan ${status === RequestStatus.APPROVED ? 'DISETUJUI' : 'DITOLAK'}`);
      setSelectedRequest(null);
      if (store.fetchRequests) store.fetchRequests(filterStart, filterEnd);
    } catch (err: any) {
      toast.error("Gagal memproses aksi.");
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (uploadFile) {
      const loadingId = toast.loading("Mengupload lampiran...");
      try {
        const url = await uploadFile(file);
        setAttachment(url);
        toast.dismiss(loadingId);
        toast.success("Upload berhasil");
      } catch (error) {
        toast.dismiss(loadingId);
        toast.error("Upload gagal");
      }
    } else {
      const reader = new FileReader();
      reader.onloadend = () => setAttachment(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <h3 className="text-2xl font-black text-slate-800 italic uppercase tracking-tighter">Izin & Cuti</h3>
          <p className="text-xs text-slate-500 uppercase font-black tracking-widest mt-1">
            {isManagement ? 'Portal Approval Manajemen' : 'Portal Kehadiran'}
          </p>

          <div className="flex flex-wrap items-center gap-2 mt-6 bg-white p-2 rounded-2xl border border-slate-100 shadow-sm animate-in fade-in">
            <div className="flex items-center gap-2 px-3 py-1 border-r border-slate-100">
              <Filter size={14} className="text-blue-600" />
              <span className="text-[10px] font-black uppercase text-slate-400">FILTER</span>
            </div>
            <div className="flex items-center gap-2 px-2">
              <input
                type="date"
                value={filterStart}
                onChange={e => setFilterStart(e.target.value)}
                className="bg-slate-50 border-none rounded-lg px-3 py-1.5 text-xs font-black text-slate-700 outline-none w-36 focus:ring-2 ring-blue-100 transition"
              />
              <span className="text-slate-300 font-black">-</span>
              <input
                type="date"
                value={filterEnd}
                onChange={e => setFilterEnd(e.target.value)}
                className="bg-slate-50 border-none rounded-lg px-3 py-1.5 text-xs font-black text-slate-700 outline-none w-36 focus:ring-2 ring-blue-100 transition"
              />
            </div>
            {(filterStart || filterEnd) && (
              <button onClick={() => { setFilterStart(''); setFilterEnd(''); }} className="p-2 bg-slate-100 rounded-xl text-slate-400 hover:bg-rose-500 hover:text-white transition" title="Reset Filter">
                <X size={14} />
              </button>
            )}
          </div>
        </div>
        {canCreate && (
          <button onClick={() => setShowAdd(true)} className="bg-slate-900 text-white px-10 py-5 rounded-[1.8rem] flex items-center gap-3 font-black text-[10px] uppercase tracking-[0.2em] hover:bg-blue-600 hover:scale-105 active:scale-95 transition-all shadow-2xl shadow-slate-200 border-b-4 border-slate-700 hover:border-blue-800">
            <Plus size={18} /> <span>Ajukan Permohonan</span>
          </button>
        )}
      </div>

      {/* Main Table Container */}
      <div className="bg-white rounded-[3rem] border border-slate-100 shadow-2xl shadow-slate-200/50 overflow-hidden">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left">
            <thead className="bg-slate-50/50 border-b border-slate-100">
              <tr>
                <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Karyawan</th>
                <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Periode Izin</th>
                <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] text-center">Berkas</th>
                <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Status</th>
                <th className="px-10 py-6 text-right text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-xs font-bold text-slate-600">
              {sortedRequests.map(req => {
                const applicant = users.find(u => u.id === req.userId);
                const isResolved = req.status === RequestStatus.APPROVED || req.status === RequestStatus.REJECTED;

                return (
                  <tr
                    key={req.id}
                    onClick={() => setSelectedRequest(req)}
                    className="hover:bg-blue-50/30 cursor-pointer transition-all group"
                  >
                    <td className="px-10 py-7">
                      <div className="flex items-center gap-5">
                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-white font-black text-sm shadow-lg transition-transform group-hover:scale-110 ${req.type === RequestType.SAKIT ? 'bg-rose-500' :
                            req.type === RequestType.CUTI ? 'bg-blue-600' : 'bg-amber-500'
                          }`}>
                          {req.type === RequestType.SAKIT ? <Plus size={24} className="rotate-45" /> :
                            req.type === RequestType.CUTI ? <Calendar size={24} /> : <Clock size={24} />}
                        </div>
                        <div>
                          <p className="text-slate-800 font-black text-base italic">{applicant?.name || 'Unknown'}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={`text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-wider ${req.type === RequestType.SAKIT ? 'bg-rose-50 text-rose-500' :
                                req.type === RequestType.CUTI ? 'bg-blue-50 text-blue-500' : 'bg-amber-50 text-amber-500'
                              }`}>{req.type}</span>
                            <span className="text-slate-300">•</span>
                            <span className="text-[9px] font-black text-slate-400 uppercase">{applicant?.role}</span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-10 py-7">
                      <div className="flex flex-col gap-1.5">
                        <span className="text-slate-800 font-black flex items-center gap-2">
                          {new Date(req.startDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                          {req.endDate !== req.startDate && (
                            <>
                              <ArrowRight size={10} className="text-slate-300" />
                              {new Date(req.endDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                            </>
                          )}
                        </span>
                        <span className="text-[10px] text-slate-400 font-bold truncate max-w-[250px] italic">
                          "{req.description}"
                        </span>
                      </div>
                    </td>
                    <td className="px-10 py-7 text-center">
                      {req.attachmentUrl ? (
                        <div className="w-10 h-10 rounded-xl bg-slate-100 border-2 border-slate-50 flex items-center justify-center text-slate-400 hover:bg-white hover:text-blue-500 transition-colors mx-auto shadow-sm">
                          <ImageIcon size={18} />
                        </div>
                      ) : (
                        <span className="text-slate-200 font-black">-</span>
                      )}
                    </td>
                    <td className="px-10 py-7">
                      <span className={`px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-[0.1em] flex w-fit items-center gap-2 shadow-sm ${req.status === RequestStatus.APPROVED ? 'bg-emerald-500 text-white' :
                          req.status === RequestStatus.REJECTED ? 'bg-rose-500 text-white' :
                            'bg-amber-100 text-amber-600'
                        }`}>
                        {req.status === RequestStatus.PENDING && <Clock size={12} className="animate-pulse" />}
                        {req.status}
                      </span>
                    </td>
                    <td className="px-10 py-7 text-right">
                      <div className="flex justify-end gap-2" onClick={e => e.stopPropagation()}>
                        {isManagement && req.status === RequestStatus.PENDING && (
                          <>
                            <button onClick={() => handleAction(req, RequestStatus.APPROVED)} className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 hover:bg-emerald-500 hover:text-white flex items-center justify-center transition shadow-sm border border-emerald-100"><Check size={18} /></button>
                            <button onClick={() => handleAction(req, RequestStatus.REJECTED)} className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 hover:bg-rose-500 hover:text-white flex items-center justify-center transition shadow-sm border border-rose-100"><X size={18} /></button>
                          </>
                        )}
                        {!isResolved ? (
                          <>
                            <button onClick={() => handleEdit(req)} className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white flex items-center justify-center transition shadow-sm border border-blue-100"><Edit size={18} /></button>
                            {isManagement && (
                              <button onClick={() => handleDelete(req.id)} className="w-10 h-10 rounded-xl bg-slate-50 text-slate-400 hover:bg-rose-500 hover:text-white flex items-center justify-center transition shadow-sm border border-slate-100"><Trash2 size={18} /></button>
                            )}
                          </>
                        ) : (
                          <button className="w-10 h-10 rounded-xl bg-slate-100 text-slate-400 hover:bg-slate-900 hover:text-white flex items-center justify-center transition-all shadow-sm">
                            <ChevronRight size={18} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {sortedRequests.length === 0 && (
                <tr><td colSpan={5} className="p-32 text-center text-slate-300 font-black uppercase tracking-[0.4em] italic text-sm">No Requests Record</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 
          ENHANCED DETAIL MODAL 
          - scrollable internal content (overflow-y-auto)
          - max height limited to 90vh
          - sticky footer for actions if needed 
      */}
      {selectedRequest && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4 md:p-10 lg:p-20 overflow-hidden" onClick={() => setSelectedRequest(null)}>
          <div
            className="bg-white rounded-[3.5rem] w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl animate-in zoom-in-95 duration-300 relative border border-white/20"
            onClick={e => e.stopPropagation()}
          >
            {/* Sticky Top Header */}
            <div className="p-10 md:p-12 border-b border-slate-100 flex justify-between items-center shrink-0 bg-white rounded-t-[3.5rem] z-10 transition-all">
              <div className="flex items-center gap-6">
                <div className="w-20 h-20 md:w-24 md:h-24 rounded-[2.5rem] bg-slate-100 flex items-center justify-center text-slate-400 font-black text-3xl overflow-hidden border-4 border-white shadow-2xl relative">
                  {users.find(u => u.id === selectedRequest.userId)?.avatarUrl ? (
                    <img src={users.find(u => u.id === selectedRequest.userId)?.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <UserIcon size={40} className="text-slate-300" />
                  )}
                  <div className={`absolute bottom-0 right-0 w-8 h-8 rounded-full border-4 border-white ${selectedRequest.status === RequestStatus.APPROVED ? 'bg-emerald-500' :
                      selectedRequest.status === RequestStatus.REJECTED ? 'bg-rose-500' : 'bg-amber-500'
                    }`}></div>
                </div>
                <div>
                  <h3 className="text-3xl md:text-4xl font-black text-slate-800 italic uppercase leading-none tracking-tighter">
                    {users.find(u => u.id === selectedRequest.userId)?.name}
                  </h3>
                  <div className="flex items-center gap-4 mt-3">
                    <span className="px-4 py-1.5 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-blue-500/20">{selectedRequest.type}</span>
                    <span className="text-slate-300 font-black">•</span>
                    <span className="text-slate-400 text-xs font-black uppercase tracking-wider">{new Date(Number(selectedRequest.createdAt)).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                  </div>
                </div>
              </div>
              <button onClick={() => setSelectedRequest(null)} className="p-5 bg-slate-100 text-slate-400 rounded-3xl hover:bg-rose-500 hover:text-white transition-all shadow-sm group">
                <X size={24} className="group-hover:rotate-90 transition-transform" />
              </button>
            </div>

            {/* Scrollable Content Area */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-10 md:p-12 space-y-12">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                {/* Left Block: Info */}
                <div className="space-y-10">
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] flex items-center gap-2">
                      <Calendar size={14} className="text-blue-600" /> TANGGAL PELAKSANAAN
                    </label>
                    <div className="p-8 bg-blue-50/50 rounded-[2rem] border-2 border-blue-100/50 relative overflow-hidden group">
                      <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-125 transition-transform duration-700">
                        <Calendar size={80} />
                      </div>
                      <p className="text-2xl font-black text-slate-800 relative z-10 italic">
                        {new Date(selectedRequest.startDate).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                      </p>
                      {selectedRequest.startDate !== selectedRequest.endDate && (
                        <div className="flex items-center gap-3 mt-2 relative z-10">
                          <div className="h-px w-10 bg-blue-200"></div>
                          <p className="text-sm font-bold text-slate-500 uppercase tracking-widest italic">Hingga {new Date(selectedRequest.endDate).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] flex items-center gap-2">
                      <FileText size={14} className="text-blue-600" /> ALASAN DETAIL
                    </label>
                    <div className="p-8 bg-slate-50 rounded-[2.5rem] border border-slate-100 text-base font-bold text-slate-600 italic leading-relaxed shadow-inner">
                      "{selectedRequest.description}"
                    </div>
                  </div>
                </div>

                {/* Right Block: Status & Attachment */}
                <div className="space-y-10">
                  <div className="space-y-3 text-center lg:text-left">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] flex items-center gap-2 justify-center lg:justify-start">
                      <CheckCircle2 size={14} className="text-blue-600" /> STATUS PENGAJUAN
                    </label>
                    <div className={`p-8 rounded-[2rem] border-4 text-xl font-black uppercase tracking-[0.3em] flex items-center justify-center gap-4 transition-all hover:scale-[1.02] shadow-xl ${selectedRequest.status === RequestStatus.APPROVED ? 'bg-emerald-500 border-white text-white rotate-1 shadow-emerald-200' :
                        selectedRequest.status === RequestStatus.REJECTED ? 'bg-rose-500 border-white text-white -rotate-1 shadow-rose-200' :
                          'bg-amber-100 border-amber-200 text-amber-700 shadow-amber-100'
                      }`}>
                      {selectedRequest.status === RequestStatus.APPROVED ? <CheckCircle2 size={32} /> :
                        selectedRequest.status === RequestStatus.REJECTED ? <AlertCircle size={32} /> : <Clock size={32} className="animate-spin" />}
                      {selectedRequest.status}
                    </div>
                  </div>

                  {selectedRequest.attachmentUrl && (
                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] flex items-center gap-2">
                        <ImageIcon size={14} className="text-blue-600" /> LAMPIRAN BUKTI
                      </label>
                      <a href={selectedRequest.attachmentUrl} target="_blank" rel="noreferrer" className="block relative aspect-[16/10] rounded-[2.5rem] overflow-hidden group shadow-2xl border-8 border-white">
                        <img src={selectedRequest.attachmentUrl} alt="Bukti" className="w-full h-full object-cover transition duration-1000 group-hover:scale-110" />
                        <div className="absolute inset-0 bg-slate-900/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition duration-500 backdrop-blur-sm">
                          <div className="px-8 py-4 bg-white rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-3 shadow-2xl scale-50 group-hover:scale-100 transition-all duration-500">
                            <Eye size={16} /> Buka Lampiran
                          </div>
                        </div>
                      </a>
                    </div>
                  )}
                </div>
              </div>

              {/* Audit Log Section */}
              <div className="pt-10 border-t border-slate-100">
                <div className="flex items-center justify-between mb-8">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] flex items-center gap-2">
                    <History size={14} className="text-blue-600" /> LOG PERSETUJUAN MANAJEMEN
                  </p>
                </div>

                {selectedRequest.status === RequestStatus.PENDING ? (
                  <div className="bg-amber-50/50 p-10 rounded-[2.5rem] flex flex-col md:flex-row items-center gap-8 text-amber-700 border-2 border-dashed border-amber-200/50">
                    <div className="p-6 bg-white rounded-[2rem] shadow-xl text-amber-500">
                      <Clock size={32} className="animate-pulse" />
                    </div>
                    <div className="text-center md:text-left">
                      <p className="text-xl font-black uppercase italic tracking-tight">Menunggu Verifikasi</p>
                      <p className="text-sm font-bold opacity-70 mt-1 max-w-sm">Data permohonan telah diterima oleh sistem dan sedang menunggu keputusan dari pihak Manajemen SDM.</p>
                    </div>
                  </div>
                ) : (
                  <div className={`p-10 rounded-[2.5rem] flex flex-col gap-6 border-4 shadow-2xl transition-all ${selectedRequest.status === RequestStatus.APPROVED ? 'bg-emerald-50 border-white text-emerald-900 shadow-emerald-100/50' : 'bg-rose-50 border-white text-rose-900 shadow-rose-100/50'
                    }`}>
                    <div className="flex flex-col md:flex-row md:items-center gap-6">
                      <div className={`p-5 rounded-[1.5rem] shrink-0 self-start md:self-center shadow-lg ${selectedRequest.status === RequestStatus.APPROVED ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'}`}>
                        {selectedRequest.status === RequestStatus.APPROVED ? <CheckCircle2 size={32} /> : <AlertCircle size={32} />}
                      </div>
                      <div>
                        <p className="text-[11px] font-black uppercase tracking-[0.2em] opacity-60">
                          {selectedRequest.status === RequestStatus.APPROVED ? 'Disetujui Oleh Admin' : 'Ditolak Oleh Admin'}
                        </p>
                        <p className="text-2xl font-black italic uppercase tracking-tight mt-1">
                          {users.find(u => u.id === selectedRequest.approverId)?.name || selectedRequest.approverName || 'Pihak Manajemen'}
                        </p>
                        <div className="flex flex-wrap gap-4 mt-3">
                          <div className="px-3 py-1 bg-white/50 rounded-lg text-[10px] font-black uppercase tracking-widest border border-white">
                            {selectedRequest.actionAt ? new Date(Number(selectedRequest.actionAt)).toLocaleString('id-ID', { dateStyle: 'long', timeStyle: 'short' }) : '-'}
                          </div>
                        </div>
                      </div>
                    </div>
                    {selectedRequest.actionNote && (
                      <div className="ml-0 md:ml-16 p-8 bg-white/80 rounded-[2rem] border-2 border-white/50 text-base font-bold italic text-slate-600 shadow-inner relative">
                        <div className="absolute top-0 left-0 w-1 h-full bg-blue-500/20"></div>
                        "{selectedRequest.actionNote}"
                      </div>
                    )}
                  </div>
                )}

                {/* Admin Approval Form */}
                {isManagement && selectedRequest.status === RequestStatus.PENDING && (
                  <div className="mt-12 space-y-6 animate-in slide-in-from-bottom-8 duration-700 bg-slate-900 p-12 rounded-[3.5rem] shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/10 blur-[100px] rounded-full -mr-32 -mt-32"></div>
                    <div className="relative z-10">
                      <label className="text-[10px] font-black text-blue-400 uppercase tracking-[0.3em] mb-4 block">Formulir Keputusan Manajemen</label>
                      <textarea
                        className="w-full p-8 bg-white/5 rounded-[2rem] font-bold text-sm text-white outline-none border-2 border-white/10 focus:border-blue-500 focus:bg-white/10 transition-all resize-none h-32 placeholder:text-slate-600"
                        placeholder="Berikan catatan persetujuan atau alasan jika pengajuan ini ditolak..."
                        value={actionNote}
                        onChange={e => setActionNote(e.target.value)}
                      />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
                      <button onClick={() => handleAction(selectedRequest, RequestStatus.REJECTED)} className="py-6 bg-rose-500/10 border-2 border-rose-500/20 text-rose-500 font-black uppercase tracking-[0.2em] rounded-[1.8rem] hover:bg-rose-500 hover:text-white transition-all text-[11px] shadow-xl">Tolak Permanen</button>
                      <button onClick={() => handleAction(selectedRequest, RequestStatus.APPROVED)} className="py-6 bg-blue-600 text-white font-black uppercase tracking-[0.2em] rounded-[1.8rem] hover:bg-white hover:text-blue-600 transition-all text-[11px] shadow-2xl shadow-blue-500/30">Setujui Sekarang</button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Decoration Bar */}
            <div className="h-6 bg-slate-50 border-t border-slate-100 rounded-b-[3.5rem] shrink-0"></div>
          </div>
        </div>
      )}

      {/* CREATE / EDIT MODAL (Applied Same Scrolling logic) */}
      {showAdd && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/90 p-4 backdrop-blur-md overflow-hidden" onClick={handleCloseModal}>
          <div className="bg-white rounded-[3.5rem] w-full max-w-lg max-h-[90vh] flex flex-col shadow-2xl animate-in fade-in zoom-in-95 duration-300" onClick={e => e.stopPropagation()}>
            <div className="p-10 md:p-12 border-b border-slate-100 flex justify-between items-center shrink-0">
              <h3 className="text-2xl font-black text-slate-800 uppercase italic tracking-tighter">{editId ? 'Ubah Data' : 'Pengajuan Baru'}</h3>
              <button onClick={handleCloseModal} className="p-3 bg-slate-50 text-slate-400 rounded-2xl hover:bg-rose-500 hover:text-white transition">
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-10 md:p-12 space-y-8">
              <div className="space-y-4">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-3">Kategori</label>
                <div className="grid grid-cols-3 gap-3">
                  {[RequestType.IZIN, RequestType.SAKIT, RequestType.CUTI].map(t => (
                    <button key={t} onClick={() => setFormData({ ...formData, type: t })} className={`py-4 rounded-2xl text-[10px] font-black uppercase transition-all border-b-4 ${formData.type === t ? 'bg-slate-900 text-white border-blue-600 shadow-xl scale-105' : 'bg-slate-50 text-slate-400 border-slate-100 hover:bg-slate-100'}`}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-5">
                <div className="space-y-4">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-3">Mulai</label>
                  <input type="date" className="w-full p-4 bg-slate-50 border-2 border-transparent focus:border-blue-600 focus:bg-white rounded-2xl font-black text-xs outline-none transition shadow-inner" value={formData.startDate} onChange={e => setFormData({ ...formData, startDate: e.target.value })} />
                </div>
                <div className="space-y-4">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-3">Sampai</label>
                  <input type="date" className="w-full p-4 bg-slate-50 border-2 border-transparent focus:border-blue-600 focus:bg-white rounded-2xl font-black text-xs outline-none transition shadow-inner" value={formData.endDate || formData.startDate} onChange={e => setFormData({ ...formData, endDate: e.target.value })} />
                </div>
              </div>

              <div className="space-y-4">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-3">Penjelasan Alasan</label>
                <textarea className="w-full p-5 bg-slate-50 border-2 border-transparent focus:border-blue-600 focus:bg-white rounded-3xl font-bold text-xs outline-none h-32 resize-none transition shadow-inner" placeholder="Jelaskan secara detail alasan permohonan Anda..." value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} />
              </div>

              <div className="space-y-4">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-3">Unggah Bukti (Format Gambar)</label>
                {!attachment ? (
                  <label className="flex flex-col items-center justify-center w-full h-40 border-4 border-dashed border-slate-100 rounded-[2.5rem] cursor-pointer hover:bg-blue-50/50 hover:border-blue-200 transition-all group overflow-hidden">
                    <div className="p-4 bg-slate-50 rounded-2xl group-hover:bg-blue-100 transition">
                      <UploadCloud className="text-slate-300 group-hover:text-blue-600 transition" size={32} />
                    </div>
                    <p className="text-[10px] font-black text-slate-400 group-hover:text-blue-600 uppercase mt-4 tracking-widest">Klik Untuk Memilih File</p>
                    <input type="file" onChange={handleFileChange} className="hidden" accept="image/*" />
                  </label>
                ) : (
                  <div className="relative h-40 rounded-[2.5rem] overflow-hidden group shadow-2xl border-4 border-white">
                    <img src={attachment} alt="Attachment" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-slate-900/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition backdrop-blur-sm">
                      <button onClick={() => setAttachment(null)} className="px-6 py-3 bg-rose-500 text-white rounded-2xl font-black text-[10px] uppercase shadow-xl flex items-center gap-2">
                        <Trash2 size={16} /> Hapus & Ganti
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="p-10 shrink-0 border-t border-slate-100">
              <button onClick={handleSubmit} disabled={isSubmitting} className="w-full py-6 bg-blue-600 text-white rounded-[1.8rem] font-black uppercase text-xs tracking-[0.4em] hover:bg-slate-900 hover:scale-[1.02] active:scale-95 transition-all shadow-2xl shadow-blue-500/40 disabled:opacity-50 border-b-4 border-blue-800 active:border-b-0 active:translate-y-1">
                {isSubmitting ? 'MENGHUBUNGKAN...' : editId ? 'SIMPAN PERUBAHAN' : 'KIRIM PERMOHONAN'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RequestsModule;
