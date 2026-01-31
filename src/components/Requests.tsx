
import React, { useState, useEffect } from 'react';
import { User, LeaveRequest, RequestType, RequestStatus, UserRole } from '../types';
import { FileText, Plus, Check, X, Clock, AlertCircle, ImageIcon, UploadCloud, History, CheckCircle2, Eye, Edit, Trash2, MoreVertical, Calendar, Filter } from 'lucide-react';
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

  // BEST PRACTICE: Default filter empty to show ALL history initially (prevent "disappearing" data)
  const [filterStart, setFilterStart] = useState('');
  const [filterEnd, setFilterEnd] = useState('');

  // Auto-Fetch when Date Range Changes (Debounced)
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

  // Reset note when modal opens
  useEffect(() => {
    if (selectedRequest) {
      setActionNote(selectedRequest.actionNote || '');
    } else {
      setActionNote('');
    }
  }, [selectedRequest]);

  // PERMISSION LOGIC
  const isManagement = [UserRole.OWNER, UserRole.MANAGER, UserRole.FINANCE].includes(currentUser.role as UserRole);
  const canCreate = currentUser.role !== UserRole.OWNER;

  // DATA VISIBILITY
  // Filter locally if needed, but server usually handles the bulk
  const visibleRequests = isManagement
    ? requests
    : requests.filter(r => r.userId === currentUser.id);

  const sortRequests = (data: LeaveRequest[]) => {
    return [...data].sort((a, b) => Number(b.createdAt) - Number(a.createdAt));
  };

  const validateRequest = () => {
    if (!formData.description) {
      toast.warning("Harap tuliskan alasan permohonan.");
      return false;
    }

    const start = new Date(formData.startDate);
    const end = new Date(formData.endDate || formData.startDate);
    const diffDays = Math.ceil((start.getTime() - new Date().setHours(0, 0, 0, 0)) / (86400000));

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

  const handleEdit = (req: LeaveRequest) => {
    setEditId(req.id);
    setFormData({
      type: req.type as RequestType,
      description: req.description || '',
      startDate: (req.startDate as any).split('T')[0], // Ensure YYYY-MM-DD
      endDate: (req.endDate as any).split('T')[0]
    });
    setAttachment(req.attachmentUrl || null);
    setShowAdd(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Apakah Anda yakin ingin menghapus data permohonan ini? Tindakan ini tidak dapat dibatalkan.")) return;

    try {
      if (store.deleteRequest) {
        await store.deleteRequest(id);
        toast.success("Berhasil menghapus data.");
        // Force refresh
        store.fetchRequests(filterStart, filterEnd);
      }
    } catch (e: any) {
      toast.error("Gagal menghapus data: " + (e.message || "Error unknown"));
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
      // Ensure we re-fetch to see the new item immediately
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
    setFormData({ type: RequestType.IZIN, description: '', startDate: new Date().toISOString().split('T')[0], endDate: new Date().toISOString().split('T')[0] });
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
      // Refresh list to update status properly
      if (store.fetchRequests) store.fetchRequests(filterStart, filterEnd);
    } catch (err: any) {
      console.error(err);
      toast.error("Gagal memproses aksi. Coba refresh halaman.");
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

  const clearFilters = () => {
    setFilterStart('');
    setFilterEnd('');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <h3 className="text-xl font-bold text-slate-800">Izin & Cuti</h3>
          <p className="text-sm text-slate-500 uppercase font-black tracking-widest mb-4">
            {isManagement ? 'Portal Approval Manajemen' : 'Portal Kehadiran'}
          </p>

          {/* Date Filter */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 bg-white p-2 rounded-2xl border border-slate-200 shadow-sm animate-in fade-in max-w-fit">
            <div className="flex items-center gap-2 px-3 py-1 border-r border-slate-100">
              <Filter size={14} className="text-slate-400" />
              <span className="text-[10px] font-black uppercase text-slate-400">FILTER</span>
            </div>
            <div className="flex items-center gap-2 px-2">
              <input
                type="date"
                value={filterStart}
                onChange={e => setFilterStart(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold text-slate-700 outline-none w-32 cursor-pointer focus:border-blue-300 transition"
                placeholder="Dari Tanggal"
              />
              <span className="text-slate-300 text-xs">-</span>
              <input
                type="date"
                value={filterEnd}
                onChange={e => setFilterEnd(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold text-slate-700 outline-none w-32 cursor-pointer focus:border-blue-300 transition"
                placeholder="Sampai Tanggal"
              />
            </div>
            {(filterStart || filterEnd) && (
              <button onClick={clearFilters} className="p-1.5 bg-slate-100 rounded-full text-slate-400 hover:bg-rose-100 hover:text-rose-500 transition mr-1" title="Reset Filter">
                <X size={12} />
              </button>
            )}
          </div>
        </div>
        {canCreate && (
          <button onClick={() => setShowAdd(true)} className="bg-slate-900 text-white px-8 py-4 rounded-[1.5rem] flex items-center gap-3 font-black text-[10px] uppercase tracking-widest hover:bg-blue-600 hover:scale-105 transition-all shadow-xl shadow-slate-200">
            <Plus size={16} /> <span>Ajukan Permohonan</span>
          </button>
        )}
      </div>

      <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/50 overflow-hidden">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Karyawan</th>
                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Tgl & Keperluan</th>
                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-center">Lampiran</th>
                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Status</th>
                <th className="px-8 py-6 text-right text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Opsi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-xs font-bold text-slate-600">
              {sortRequests(visibleRequests).map(req => {
                const applicant = users.find(u => u.id === req.userId);
                const canEdit = isManagement || (req.userId === currentUser.id && req.status === RequestStatus.PENDING);
                const canDelete = isManagement;
                const isResolved = req.status === RequestStatus.APPROVED || req.status === RequestStatus.REJECTED;

                return (
                  <tr
                    key={req.id}
                    onClick={() => setSelectedRequest(req)}
                    className="hover:bg-blue-50/30 cursor-pointer transition-colors group"
                  >
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white font-black text-sm shadow-md transition-transform group-hover:scale-110 ${req.type === RequestType.SAKIT ? 'bg-rose-500' :
                            req.type === RequestType.CUTI ? 'bg-indigo-500' : 'bg-amber-500'
                          }`}>
                          {req.type === RequestType.SAKIT ? <Plus size={20} className="rotate-45" /> :
                            req.type === RequestType.CUTI ? <Calendar size={20} /> : <Clock size={20} />}
                        </div>
                        <div>
                          <p className="text-slate-800 font-black text-sm">{applicant?.name || 'Unknown User'}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{req.type}</span>
                            <span className="text-[10px] text-slate-300">•</span>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{applicant?.role}</span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex flex-col gap-1">
                        <span className="text-slate-800 font-bold">
                          {new Date(req.startDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                          {req.endDate !== req.startDate && ` - ${new Date(req.endDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}`}
                        </span>
                        <span className="text-[11px] text-slate-500 font-medium truncate max-w-[200px] italic">
                          "{req.description}"
                        </span>
                      </div>
                    </td>
                    <td className="px-8 py-6 text-center">
                      {req.attachmentUrl ? (
                        <div className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200 mx-auto flex items-center justify-center text-slate-400">
                          <ImageIcon size={14} />
                        </div>
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </td>
                    <td className="px-8 py-6">
                      <span className={`px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest flex w-fit items-center gap-2 ${req.status === RequestStatus.APPROVED ? 'bg-emerald-100 text-emerald-600' :
                          req.status === RequestStatus.REJECTED ? 'bg-rose-100 text-rose-600' :
                            'bg-amber-100 text-amber-600 animate-pulse'
                        }`}>
                        {req.status === RequestStatus.PENDING && <Clock size={12} />}
                        {req.status}
                      </span>
                    </td>
                    <td className="px-8 py-6 text-right">
                      <div className="flex justify-end gap-2" onClick={e => e.stopPropagation()}>
                        {isManagement && req.status === RequestStatus.PENDING && (
                          <>
                            <button onClick={() => handleAction(req, RequestStatus.APPROVED)} title="Setujui" className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 hover:bg-emerald-500 hover:text-white flex items-center justify-center transition shadow-sm"><Check size={16} /></button>
                            <button onClick={() => handleAction(req, RequestStatus.REJECTED)} title="Tolak" className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 hover:bg-rose-500 hover:text-white flex items-center justify-center transition shadow-sm"><X size={16} /></button>
                          </>
                        )}
                        {/* Allow Edit/Delete only if pending or if Management wants to override */}
                        {(canEdit && !isResolved) || (canDelete && isResolved) ? (
                          <>
                            {canEdit && !isResolved && (
                              <button onClick={() => handleEdit(req)} title="Edit" className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 hover:bg-blue-500 hover:text-white flex items-center justify-center transition shadow-sm"><Edit size={16} /></button>
                            )}
                            {canDelete && (
                              <button onClick={() => handleDelete(req.id)} title="Hapus" className="w-9 h-9 rounded-xl bg-slate-50 text-slate-400 hover:bg-rose-500 hover:text-white flex items-center justify-center transition shadow-sm"><Trash2 size={16} /></button>
                            )}
                          </>
                        ) : (
                          <button className="w-9 h-9 rounded-xl bg-slate-50 text-slate-400 hover:bg-slate-900 hover:text-white flex items-center justify-center transition shadow-sm" title="Lihat Detail"><Eye size={16} /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {visibleRequests.length === 0 && (
                <tr><td colSpan={5} className="p-16 text-center text-slate-300 font-bold uppercase tracking-widest text-xs italic">Tidak ada data permohonan</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* DETAIL MODAL */}
      {selectedRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4" onClick={() => setSelectedRequest(null)}>
          <div className="bg-white rounded-[3rem] w-full max-w-3xl p-10 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 border border-white/20" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-10 border-b border-slate-100 pb-8">
              <div className="flex items-center gap-6">
                <div className="w-20 h-20 rounded-[2rem] bg-slate-100 flex items-center justify-center text-slate-400 font-black text-2xl overflow-hidden border-4 border-white shadow-xl">
                  {users.find(u => u.id === selectedRequest.userId)?.avatarUrl ? (
                    <img src={users.find(u => u.id === selectedRequest.userId)?.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    users.find(u => u.id === selectedRequest.userId)?.name.charAt(0)
                  )}
                </div>
                <div>
                  <h3 className="text-3xl font-black text-slate-800">{users.find(u => u.id === selectedRequest.userId)?.name}</h3>
                  <div className="flex items-center gap-3 mt-2">
                    <span className="px-3 py-1 bg-slate-100 rounded-lg text-slate-500 text-[10px] font-black uppercase tracking-widest">{selectedRequest.type}</span>
                    <span className="text-slate-300">•</span>
                    <span className="text-slate-400 text-xs font-bold">{new Date(Number(selectedRequest.createdAt)).toLocaleDateString('id-ID')}</span>
                  </div>
                </div>
              </div>
              <button onClick={() => setSelectedRequest(null)} className="p-3 bg-slate-50 rounded-2xl hover:bg-rose-500 hover:text-white transition shadow-sm"><X size={20} /></button>
            </div>

            <div className="grid md:grid-cols-2 gap-10 mb-8">
              <div className="space-y-8">
                <div className="space-y-2">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Calendar size={12} /> TANGGAL PELAKSANAAN</p>
                  <div className="p-4 bg-blue-50/50 rounded-2xl border border-blue-100">
                    <p className="text-base font-black text-slate-800">
                      {new Date(selectedRequest.startDate).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>
                    {selectedRequest.startDate !== selectedRequest.endDate && (
                      <p className="text-sm font-bold text-slate-500 mt-1">s/d {new Date(selectedRequest.endDate).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><FileText size={12} /> ALASAN DETAIL</p>
                  <div className="p-6 bg-slate-50 rounded-[1.5rem] border border-slate-100 text-sm font-medium text-slate-600 italic leading-relaxed shadow-inner">
                    "{selectedRequest.description}"
                  </div>
                </div>
              </div>
              <div className="space-y-8">
                <div className="space-y-2">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Check size={12} /> STATUS SAAT INI</p>
                  <div className={`p-4 rounded-2xl border-2 text-sm font-black uppercase tracking-widest text-center flex items-center justify-center gap-3 ${selectedRequest.status === RequestStatus.APPROVED ? 'bg-emerald-50 border-emerald-100 text-emerald-600' :
                      selectedRequest.status === RequestStatus.REJECTED ? 'bg-rose-50 border-rose-100 text-rose-600' :
                        'bg-amber-50 border-amber-100 text-amber-600'
                    }`}>
                    {selectedRequest.status === RequestStatus.APPROVED ? <CheckCircle2 size={18} /> :
                      selectedRequest.status === RequestStatus.REJECTED ? <AlertCircle size={18} /> : <Clock size={18} className="animate-spin" />}
                    {selectedRequest.status}
                  </div>
                </div>
                {selectedRequest.attachmentUrl && (
                  <div className="space-y-2">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><ImageIcon size={12} /> LAMPIRAN BUKTI</p>
                    <a href={selectedRequest.attachmentUrl} target="_blank" rel="noreferrer" className="block relative aspect-video rounded-2xl overflow-hidden group shadow-lg border border-slate-200">
                      <img src={selectedRequest.attachmentUrl} alt="Bukti" className="w-full h-full object-cover transition duration-500 group-hover:scale-110" />
                      <div className="absolute inset-0 bg-slate-900/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition backdrop-blur-sm">
                        <div className="px-4 py-2 bg-white rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                          <Eye size={12} /> Lihat Gambar Full
                        </div>
                      </div>
                    </a>
                  </div>
                )}
              </div>
            </div>

            <div className="border-t border-slate-100 pt-8 mt-4">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                <History size={12} /> LOG PERSETUJUAN
              </p>

              {selectedRequest.status === RequestStatus.PENDING ? (
                <div className="bg-amber-50 p-6 rounded-3xl flex items-center gap-4 text-amber-700 border border-amber-100">
                  <div className="p-3 bg-amber-100 rounded-full">
                    <Clock size={20} />
                  </div>
                  <div>
                    <p className="text-sm font-black uppercase tracking-wide">Menunggu Konfirmasi</p>
                    <p className="text-xs opacity-80 mt-1">Permohonan ini sedang ditinjau oleh pihak manajemen.</p>
                  </div>
                </div>
              ) : (
                <div className={`p-6 rounded-3xl flex flex-col gap-4 border ${selectedRequest.status === RequestStatus.APPROVED ? 'bg-emerald-50 border-emerald-100 text-emerald-800' : 'bg-rose-50 border-rose-100 text-rose-800'}`}>
                  <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-full ${selectedRequest.status === RequestStatus.APPROVED ? 'bg-emerald-200' : 'bg-rose-200'}`}>
                      {selectedRequest.status === RequestStatus.APPROVED ? <CheckCircle2 size={24} className="text-emerald-700" /> : <AlertCircle size={24} className="text-rose-700" />}
                    </div>
                    <div>
                      <p className="text-sm font-black uppercase tracking-wide">
                        {selectedRequest.status === RequestStatus.APPROVED ? 'DISETUJUI OLEH' : 'DITOLAK OLEH'}:
                        <span className="ml-2 inline-flex items-center gap-2 px-2 py-1 bg-white/50 rounded-lg">
                          {selectedRequest.approverId && users.find(u => u.id === selectedRequest.approverId)?.avatarUrl && (
                            <img src={users.find(u => u.id === selectedRequest.approverId)?.avatarUrl} className="w-5 h-5 rounded-full object-cover shadow-sm" />
                          )}
                          {users.find(u => u.id === selectedRequest.approverId)?.name || selectedRequest.approverName || 'Manajemen'}
                        </span>
                      </p>
                      <div className="flex gap-4 mt-2 text-[10px] font-bold opacity-70">
                        <span>WAKTU: {selectedRequest.actionAt ? new Date(Number(selectedRequest.actionAt)).toLocaleString('id-ID') : '-'}</span>
                      </div>
                    </div>
                  </div>
                  {selectedRequest.actionNote && (
                    <div className="ml-16 p-4 bg-white/60 rounded-2xl border border-black/5 text-sm italic">
                      "{selectedRequest.actionNote}"
                    </div>
                  )}
                </div>
              )}

              {isManagement && selectedRequest.status === RequestStatus.PENDING && (
                <div className="mt-8 space-y-4 animate-in slide-in-from-bottom-4 bg-slate-50 p-6 rounded-[2rem] border border-slate-100">
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block">Catatan Approval (Opsional / Wajib jika Ditolak)</label>
                    <textarea
                      className="w-full p-4 bg-white rounded-2xl font-medium text-xs outline-none border border-slate-200 focus:border-blue-400 transition resize-none h-24 shadow-sm"
                      placeholder="Tuliskan alasan penolakan atau catatan tambahan untuk karyawan..."
                      value={actionNote}
                      onChange={e => setActionNote(e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <button onClick={() => handleAction(selectedRequest, RequestStatus.REJECTED)} className="py-4 bg-white border-2 border-slate-200 text-slate-500 font-black uppercase tracking-widest rounded-2xl hover:border-rose-200 hover:bg-rose-500 hover:text-white transition text-xs shadow-sm">Tolak Pengajuan</button>
                    <button onClick={() => handleAction(selectedRequest, RequestStatus.APPROVED)} className="py-4 bg-blue-600 text-white font-black uppercase tracking-widest rounded-2xl hover:bg-slate-900 transition text-xs shadow-xl shadow-blue-500/30">Setujui Pengajuan</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* CREATE / EDIT MODAL */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/90 p-4 backdrop-blur-md" onClick={handleCloseModal}>
          <div className="bg-white p-10 rounded-[2.5rem] w-full max-w-lg shadow-2xl animate-in fade-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <h3 className="text-2xl font-black text-slate-800 mb-8 uppercase text-center">{editId ? 'Edit Permohonan' : 'Buat Permohonan Baru'}</h3>
            <div className="space-y-6">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block">Jenis Permohonan</label>
                <div className="grid grid-cols-3 gap-3">
                  {[RequestType.IZIN, RequestType.SAKIT, RequestType.CUTI].map(t => (
                    <button key={t} onClick={() => setFormData({ ...formData, type: t })} className={`py-4 rounded-2xl text-[10px] font-black uppercase transition-all ${formData.type === t ? 'bg-slate-800 text-white shadow-xl scale-105' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-5">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Mulai Tanggal</label>
                  <input type="date" className="w-full p-4 bg-slate-50 border-transparent focus:bg-white border-2 focus:border-blue-600 rounded-2xl font-bold text-xs outline-none transition" value={formData.startDate} onChange={e => setFormData({ ...formData, startDate: e.target.value })} />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Sampai Tanggal</label>
                  <input type="date" className="w-full p-4 bg-slate-50 border-transparent focus:bg-white border-2 focus:border-blue-600 rounded-2xl font-bold text-xs outline-none transition" value={formData.endDate || formData.startDate} onChange={e => setFormData({ ...formData, endDate: e.target.value })} />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Alasan Keperluan</label>
                <textarea className="w-full p-4 bg-slate-50 border-transparent focus:bg-white border-2 focus:border-blue-600 rounded-2xl font-bold text-xs outline-none h-28 resize-none transition" placeholder="Jelaskan alasan pengajuan secara rinci..." value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} />
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Bukti / Lampiran (Opsional)</label>
                {!attachment ? (
                  <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-slate-200 rounded-3xl cursor-pointer hover:bg-slate-50 hover:border-slate-300 transition group">
                    <UploadCloud className="text-slate-300 group-hover:text-blue-500 transition mb-2" size={24} />
                    <p className="text-[10px] font-black text-slate-400 uppercase group-hover:text-blue-500 transition">Klik untuk upload bukti</p>
                    <input type="file" onChange={handleFileChange} className="hidden" accept="image/*" />
                  </label>
                ) : (
                  <div className="relative h-32 rounded-3xl overflow-hidden group shadow-lg">
                    <img src={attachment} alt="Bukti" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                      <button onClick={() => setAttachment(null)} className="p-3 bg-white text-rose-600 rounded-xl font-black text-[10px] uppercase hover:bg-rose-600 hover:text-white transition shadow-lg flex items-center gap-2">
                        <Trash2 size={14} /> Hapus Gambar
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <button onClick={handleSubmit} disabled={isSubmitting} className="w-full py-5 bg-blue-600 text-white rounded-3xl font-black uppercase text-xs tracking-[0.2em] mt-4 hover:bg-slate-900 hover:scale-[1.02] active:scale-95 transition-all shadow-xl shadow-blue-500/30 disabled:opacity-50 disabled:scale-100">
                {isSubmitting ? 'SEDANG MEMPROSES...' : editId ? 'SIMPAN PERUBAHAN' : 'KIRIM PENGAJUAN'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RequestsModule;
