import React, { useState } from 'react';
import { Project, User, ProjectPriority, KanbanStatus, Task } from '../types';
import { UserPlus, Plus } from 'lucide-react';
import { useToast } from './Toast';

interface ProjectModalProps {
  users: User[];
  currentUser: User;
  initialData: Project | null;
  onClose: () => void;
  onSave: (p: Project) => void;
  toast: ReturnType<typeof useToast>;
}

export const ProjectModal: React.FC<ProjectModalProps> = ({ users, currentUser, initialData, onClose, onSave, toast }) => {
  const [formData, setFormData] = useState({
    title: initialData?.title || '',
    description: initialData?.description || '',
    collaborators: initialData?.collaborators || [currentUser.id],
    deadline: initialData?.deadline || '',
    priority: initialData?.priority || 'Medium',
    isManagementOnly: initialData?.isManagementOnly || false,
    tasks: initialData?.tasks || []
  });
  
  const [newTaskText, setNewTaskText] = useState('');
  const [newTaskPICs, setNewTaskPICs] = useState<string[]>([]);
  const [showPICSelector, setShowPICSelector] = useState(false);
  const [showProjPICSelector, setShowProjPICSelector] = useState(false);

  const handleSave = () => {
    if (!formData.title || !formData.deadline) {
      toast.warning("Harap isi semua field utama (Judul dan Deadline).");
      return;
    }
    const projectData: Project = {
      ...(initialData || {} as Project),
      id: initialData?.id || Math.random().toString(36).substr(2, 9),
      title: formData.title,
      description: formData.description,
      collaborators: formData.collaborators,
      deadline: formData.deadline,
      priority: formData.priority as ProjectPriority,
      isManagementOnly: formData.isManagementOnly,
      tasks: formData.tasks,
      status: initialData?.status || KanbanStatus.ON_GOING,
      createdAt: initialData?.createdAt || Date.now(),
      createdBy: initialData?.createdBy || currentUser.id,
      comments: initialData?.comments || []
    };
    try {
      onSave(projectData);
      toast.success(initialData ? 'Proyek berhasil diperbarui!' : 'Proyek baru berhasil dibuat!');
    } catch (err: any) {
      toast.error(err?.message || 'Gagal menyimpan proyek. Periksa koneksi dan coba lagi.');
    }
  };

  const addTask = () => {
    if (!newTaskText) return;
    const newTask: Task = {
      id: Math.random().toString(36).substr(2, 9),
      title: newTaskText,
      assignedTo: newTaskPICs,
      isCompleted: false,
      completionProof: undefined,
      comments: [],
      history: [{ id: Math.random().toString(36).substr(2, 9), userId: currentUser.id, userName: currentUser.name, action: 'Task dibuat', timestamp: Date.now() }]
    };
    setFormData({ ...formData, tasks: [...formData.tasks, newTask] });
    setNewTaskText('');
    setNewTaskPICs([]);
    setShowPICSelector(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/90 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-[3rem] w-full max-w-2xl overflow-hidden flex flex-col shadow-2xl border border-white/20 animate-in zoom-in duration-300">
        <div className="p-6 md:p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <h3 className="text-xl md:text-2xl font-black text-slate-800 uppercase tracking-tight">{initialData ? 'Update Proyek' : 'Konfigurasi Proyek Baru'}</h3>
          <button onClick={onClose} className="p-3 bg-slate-100 rounded-2xl hover:bg-rose-500 hover:text-white transition">✕</button>
        </div>
        <div className="p-6 md:p-8 space-y-8 overflow-y-auto max-h-[70vh] custom-scrollbar">
          <div className="space-y-4">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Judul Proyek</label>
            <input className="w-full p-4 bg-slate-50 border-2 border-transparent focus:border-blue-600 focus:bg-white rounded-2xl outline-none font-black text-lg md:text-xl transition" 
              value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} placeholder="Nama Proyek..." />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button onClick={() => setFormData({...formData, isManagementOnly: false})} className={`py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest border-2 transition-all ${!formData.isManagementOnly ? 'bg-blue-600 border-blue-600 text-white shadow-lg' : 'bg-slate-50 border-transparent text-slate-400'}`}>SEMUA TIM</button>
            <button onClick={() => setFormData({...formData, isManagementOnly: true})} className={`py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest border-2 transition-all ${formData.isManagementOnly ? 'bg-slate-900 border-slate-900 text-white shadow-lg' : 'bg-slate-50 border-transparent text-slate-400'}`}>MANAGEMENT ONLY</button>
          </div>

          <div className="space-y-4">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Deskripsi Proyek</label>
            <textarea 
              className="w-full p-4 bg-slate-50 border-2 border-transparent focus:border-blue-600 focus:bg-white rounded-2xl outline-none font-medium text-sm transition min-h-[100px]" 
              value={formData.description} 
              onChange={e => setFormData({...formData, description: e.target.value})} 
              placeholder="Detail penjelasan proyek..."
            />
          </div>

          <div className="space-y-4">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Assign Tim Inti (Project Card PICs)</label>
            <div className="relative">
              <button onClick={() => setShowProjPICSelector(!showProjPICSelector)} className="w-full p-4 bg-slate-50 rounded-2xl text-left flex items-center justify-between group hover:bg-slate-100 transition">
                <div className="flex -space-x-2">
                   {formData.collaborators.map(id => (
                     <div key={id} className="w-8 h-8 rounded-full bg-blue-600 border-2 border-white flex items-center justify-center text-[10px] font-black text-white">{users.find(u => u.id === id)?.name.charAt(0).toUpperCase()}</div>
                   ))}
                </div>
                <UserPlus size={18} className="text-slate-400 group-hover:text-blue-600" />
              </button>
              {showProjPICSelector && (
                <div className="absolute top-16 left-0 right-0 bg-white border border-slate-100 rounded-3xl shadow-2xl z-50 p-4 grid grid-cols-2 gap-2 animate-in slide-in-from-top-2">
                  {users.map(u => (
                    <label key={u.id} className="flex items-center space-x-3 p-3 hover:bg-slate-50 rounded-xl cursor-pointer transition">
                      <input type="checkbox" className="w-5 h-5 rounded-lg border-2" checked={formData.collaborators.includes(u.id)} onChange={e => {
                        const next = e.target.checked ? [...formData.collaborators, u.id] : formData.collaborators.filter(cid => cid !== u.id);
                        setFormData({...formData, collaborators: next});
                      }} />
                      <span className="text-[10px] font-black uppercase text-slate-700">{u.name}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Prioritas</label>
              <select className="w-full p-4 bg-slate-50 rounded-2xl font-black text-xs uppercase outline-none focus:border-blue-600 border-2 border-transparent transition" value={formData.priority} onChange={e => setFormData({...formData, priority: e.target.value as ProjectPriority})}>
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
              </select>
            </div>
            <div className="space-y-4">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Deadline</label>
              <input type="date" className="w-full p-4 bg-slate-50 rounded-2xl font-black text-xs outline-none focus:border-blue-600 border-2 border-transparent transition" value={formData.deadline} onChange={e => setFormData({...formData, deadline: e.target.value})} />
            </div>
          </div>

          <div className="space-y-4 pt-4 border-t border-slate-50">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Daftar Tugas & Assign Task PIC</label>
            <div className="bg-slate-900 p-6 rounded-[2rem] space-y-4 shadow-xl">
               <input className="w-full p-4 bg-white/10 text-white border-2 border-white/20 rounded-2xl text-xs font-black placeholder:text-white/30 outline-none focus:bg-white focus:text-slate-900 transition" placeholder="Tulis tugas baru..." value={newTaskText} onChange={e => setNewTaskText(e.target.value)} />
               <div className="flex gap-3">
                 <button onClick={() => setShowPICSelector(!showPICSelector)} className="flex-1 bg-white/10 py-3 rounded-xl text-[9px] font-black text-white uppercase tracking-widest hover:bg-white/20 transition">
                   {newTaskPICs.length === 0 ? 'PILIH PIC TUGAS' : `${newTaskPICs.length} PIC TERPILIH`}
                 </button>
                 <button onClick={addTask} className="bg-blue-600 text-white p-3 rounded-xl shadow-lg hover:bg-blue-500 transition"><Plus size={20} /></button>
               </div>
               {showPICSelector && (
                 <div className="grid grid-cols-2 gap-2 bg-white/5 p-3 rounded-2xl border border-white/10">
                   {users.map(u => (
                     <label key={u.id} className="flex items-center space-x-2 text-[9px] font-black text-white/70 hover:text-white cursor-pointer transition">
                       <input type="checkbox" checked={newTaskPICs.includes(u.id)} onChange={e => e.target.checked ? setNewTaskPICs([...newTaskPICs, u.id]) : setNewTaskPICs(newTaskPICs.filter(id => id !== u.id))} />
                       <span>{u.name.toUpperCase()}</span>
                     </label>
                   ))}
                 </div>
               )}
            </div>
            <div className="space-y-2">
              {formData.tasks.map((t: Task, idx: number) => (
                <div key={idx} className="p-4 bg-slate-50 border border-slate-100 rounded-2xl flex justify-between items-center group">
                  <div className="space-y-1">
                    <p className="text-xs font-black text-slate-700 leading-tight">{t.title}</p>
                    <div className="flex -space-x-1.5">
                      {t.assignedTo.map((uid: string) => (
                        <div key={uid} className="w-5 h-5 rounded-full bg-blue-100 text-[8px] font-black flex items-center justify-center text-blue-600 border border-white uppercase">{users.find(u => u.id === uid)?.name.charAt(0)}</div>
                      ))}
                    </div>
                  </div>
                  <button onClick={() => setFormData({...formData, tasks: formData.tasks.filter((_, i) => i !== idx)})} className="text-slate-300 hover:text-rose-500 transition opacity-0 group-hover:opacity-100">✕</button>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="p-6 md:p-8 bg-slate-50 flex gap-4">
          <button onClick={onClose} className="flex-1 py-4 text-slate-500 font-black uppercase tracking-widest hover:bg-slate-100 rounded-2xl text-[10px] transition">BATAL</button>
          <button onClick={handleSave} className="flex-1 bg-slate-900 text-white py-4 rounded-[1.5rem] font-black uppercase tracking-widest text-[10px] shadow-xl shadow-slate-200 hover:bg-blue-600 transition">SIMPAN PROYEK</button>
        </div>
      </div>
    </div>
  );
};
