import React, { useState, useEffect } from 'react';
import { useAppStore } from '../context/StoreContext';
import { useRouter, useParams } from 'next/navigation';
import { Project, UserRole, Task, ProjectPriority, KanbanStatus } from '../types';
import { 
  ArrowLeft, Calendar, CheckSquare, MessageSquare, 
  Users, Paperclip, Clock, Shield, MoreVertical,
  CheckCircle2, AlertCircle, Send
} from 'lucide-react';
import { useToast } from './Toast';

export const ProjectDetail = () => {
  const { projects, users, currentUser, updateProject, patchProject } = useAppStore();
  const router = useRouter();
  const params = useParams();
  const toast = useToast();
  
  const projectId = params?.id as string;
  const [project, setProject] = useState<Project | null>(null);
  const [commentText, setCommentText] = useState('');
  const [taskInputs, setTaskInputs] = useState<Record<string, string>>({}); // New local state for task inputs

  const handleTaskComment = async (e: React.MouseEvent | React.KeyboardEvent, taskId: string) => {
    e.stopPropagation();
    if (!project || !currentUser) return;
    
    const text = taskInputs[taskId];
    if (!text?.trim()) return;

    try {
        const tIdx = project.tasks.findIndex(t => t.id === taskId);
        if (tIdx === -1) return;
        
        const task = project.tasks[tIdx];
        const newComment = { 
            id: Date.now().toString(), 
            userId: currentUser.id, 
            text, 
            createdAt: Date.now() 
        };
        
        // Optimistic Update locally to feel instant
        const optimisticTasks = [...project.tasks];
        optimisticTasks[tIdx] = {
            ...task,
            comments: [...(task.comments || []), newComment]
        };
        setProject({ ...project, tasks: optimisticTasks });

        // Atomic Update
        const updatedTask = {
            ...task,
            comments: [...(task.comments || []), newComment]
        };

        if (patchProject) {
            await patchProject(project.id, 'UPDATE_TASK', { taskId, task: updatedTask });
        } else {
            // Fallback if patchProject not avail (should not match)
            console.warn("patchProject unavailable, using updateProject");
            updateProject({ ...project, tasks: optimisticTasks }); 
        }

        setTaskInputs(prev => ({ ...prev, [taskId]: '' }));
        toast.success("Komentar terkirim");
    } catch (e) {
        toast.error("Gagal kirim komentar");
        console.error(e);
        // Revert? (Optional: for now simple optimistic is fine)
    }
  };

  useEffect(() => {
    if (projectId && projects.length > 0) {
      const found = projects.find(p => p.id === projectId);
      setProject(found || null);
    }
  }, [projectId, projects]);

  if (!project || !currentUser) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
         {projects.length === 0 ? <p>Loading...</p> : <p>Project not found</p>}
      </div>
    );
  }

  const navigateBack = () => {
    router.back();
  };

  const handleStatusChange = (newStatus: KanbanStatus) => {
    try {
      if (currentUser.role === UserRole.STAFF && newStatus === KanbanStatus.DONE) {
         toast.warning("Hanya Manager/Owner yang dapat memverifikasi DONE.");
         // Allow anyway for now if blocking logic is not strict, but usually we block.
         // Let's stick to the warning but maybe allow if it's 'preview' -> 'done'?
         // Actually the Kanban logic blocked it. I'll block it here too strictly if needed.
         // But for UX let's just warn and block.
         return; 
      }
      const updated = { ...project, status: newStatus };
      updateProject(updated);
      toast.success(`Status updated to ${newStatus}`);
    } catch (e) {
      toast.error("Failed to update status");
    }
  };

  const toggleTask = (taskId: string) => {
    const tasks = [...project.tasks];
    const taskIndex = tasks.findIndex(t => t.id === taskId);
    if (taskIndex === -1) return;
    
    // Toggle completion
    tasks[taskIndex].isCompleted = !tasks[taskIndex].isCompleted;
    if (tasks[taskIndex].isCompleted) {
        tasks[taskIndex].history.push({
            id: Date.now().toString(),
            userId: currentUser.id,
            userName: currentUser.name,
            action: 'Completed Task',
            timestamp: Date.now()
        });
    }
    updateProject({ ...project, tasks });
  };

  const postComment = () => {
    if (!commentText.trim()) return;
    const newComment = {
        id: Date.now().toString(),
        userId: currentUser.id,
        text: commentText,
        createdAt: Date.now()
    };
    updateProject({
        ...project,
        comments: [...(project.comments || []), newComment]
    });
    setCommentText('');
  };

  const getPriorityColor = (p: string) => {
    switch(p) {
        case 'High': return 'bg-rose-500 text-white shadow-rose-200';
        case 'Medium': return 'bg-amber-500 text-white shadow-amber-200';
        default: return 'bg-blue-500 text-white shadow-blue-200';
    }
  };

  return (
    <div className="space-y-8 animate-in slide-in-from-right duration-500 pb-20">
      {/* Header */}
      <div className="bg-white rounded-[3rem] p-8 shadow-sm border border-slate-100 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-500 via-purple-500 to-rose-500"></div>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
           <div className="space-y-4">
              <button onClick={navigateBack} className="flex items-center text-slate-400 hover:text-blue-600 transition font-black text-xs uppercase tracking-widest gap-2">
                 <ArrowLeft size={16} /> Kembali ke List
              </button>
              <h1 className="text-3xl md:text-4xl font-black text-slate-800 leading-tight">{project.title}</h1>
              <div className="flex flex-wrap items-center gap-3">
                 <span className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest shadow-lg ${getPriorityColor(project.priority)}`}>
                    {project.priority} Priority
                 </span>
                 <span className="px-4 py-2 bg-slate-100 text-slate-500 rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2">
                    <Clock size={14} /> Deadline: {new Date(project.deadline).toLocaleDateString()}
                 </span>
                 {project.isManagementOnly && (
                    <span className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2">
                       <Shield size={14} /> Confidential
                    </span>
                 )}
              </div>
           </div>

           {/* Status Switcher */}
           <div className="flex overflow-hidden bg-slate-100 p-1.5 rounded-2xl">
              {Object.values(KanbanStatus).map(s => (
                  <button 
                    key={s}
                    onClick={() => handleStatusChange(s)}
                    className={`px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                        project.status === s 
                        ? 'bg-white text-slate-900 shadow-md transform scale-105' 
                        : 'text-slate-400 hover:text-slate-600'
                    }`}
                  >
                    {s.replace('_', ' ')}
                  </button>
              ))}
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
         {/* Main Content */}
         <div className="lg:col-span-2 space-y-8">
            {/* Description */}
            <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 space-y-4">
               <h3 className="text-sm font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                  <MessageSquare size={16} /> Deskripsi Proyek
               </h3>
               <p className="text-slate-600 leading-loose text-sm font-medium">
                  {project.description || "Tidak ada deskripsi detail untuk proyek ini."}
               </p>
            </div>

            {/* Task List */}
            <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 space-y-6">
               <div className="flex justify-between items-center">
                  <h3 className="text-sm font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                     <CheckSquare size={16} /> Daftar Tugas ({project.tasks.filter(t => t.isCompleted).length}/{project.tasks.length})
                  </h3>
               </div>
               
               <div className="space-y-3">
                  {project.tasks.map(task => (
                      <div key={task.id} 
                           onClick={() => toggleTask(task.id)}
                           className={`p-6 rounded-2xl border-2 cursor-pointer transition-all group hover:shadow-lg ${
                             task.isCompleted ? 'bg-emerald-50 border-emerald-100 opacity-60' : 'bg-white border-slate-100 hover:border-blue-500'
                           }`}
                      >
                         <div className="flex items-start gap-4">
                            <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center mt-0.5 transition ${
                                task.isCompleted ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-300 group-hover:border-blue-500'
                            }`}>
                               {task.isCompleted && <CheckCircle2 size={14} />}
                            </div>
                            <div className="flex-1">
                               <p className={`text-sm font-bold ${task.isCompleted ? 'text-slate-500 line-through' : 'text-slate-800'}`}>
                                  {task.title}
                               </p>
                               {task.assignedTo && task.assignedTo.length > 0 && (
                                  <div className="flex items-center gap-2 mt-2">
                                     <span className="text-[10px] uppercase font-bold text-slate-400">PIC:</span>
                                     <div className="flex -space-x-1">
                                       {task.assignedTo.map(uid => (
                                           <div key={uid} className="w-5 h-5 rounded-full bg-slate-200 border border-white flex items-center justify-center text-[8px] font-black uppercase text-slate-500 overflow-hidden">
                                              {users.find(u => u.id === uid)?.avatarUrl ? (
                                                  <img src={users.find(u => u.id === uid)?.avatarUrl} alt="pic" className="w-full h-full object-cover" />
                                              ) : (
                                                  users.find(u => u.id === uid)?.name.slice(0,1)
                                              )}
                                           </div>
                                       ))}
                                     </div>
                                  </div>
                               )}
                            </div>
                         </div>


                      {/* Task Comments Section */}
                      <div className="mt-4 pt-4 border-t border-slate-100" onClick={e => e.stopPropagation()}>
                          {task.comments && task.comments.length > 0 && (
                            <div className="space-y-2 mb-3">
                                {task.comments.map(c => (
                                    <div key={c.id} className="bg-slate-50 p-3 rounded-lg text-xs border border-slate-100/50">
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="font-bold text-slate-700">{users.find(u => u.id === c.userId)?.name}</span>
                                            <span className="text-slate-400 text-[10px]">{new Date(c.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                        </div>
                                        <p className="text-slate-600">{c.text}</p>
                                    </div>
                                ))}
                            </div>
                          )}
                          <div className="flex gap-2">
                             <input 
                                className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-blue-500 transition"
                                placeholder="Tulis komentar/instruksi..."
                                value={taskInputs[task.id] || ''}
                                onChange={e => setTaskInputs(prev => ({...prev, [task.id]: e.target.value}))}
                                onKeyDown={e => e.key === 'Enter' && handleTaskComment(e, task.id)}
                             />
                             <button onClick={e => handleTaskComment(e, task.id)} className="p-2.5 bg-slate-100 text-slate-600 rounded-lg hover:bg-blue-600 hover:text-white transition shadow-sm">
                                <Send size={14} />
                             </button>
                          </div>
                      </div>
                   </div>
               ))}
                  {project.tasks.length === 0 && (
                     <div className="text-center py-10 text-slate-400 italic text-xs">Belum ada tugas yang dibuat.</div>
                  )}
               </div>
            </div>

            {/* Comments */}
            <div className="bg-slate-50 p-8 rounded-[2.5rem] border border-slate-200 space-y-6">
                <h3 className="text-sm font-black text-slate-400 uppercase tracking-[0.2em]">Diskusi Tim</h3>
                <div className="space-y-6 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                   {project.comments?.map(c => (
                       <div key={c.id} className="flex gap-4">
                           <div className="w-10 h-10 rounded-full bg-white border-2 border-slate-200 flex items-center justify-center text-xs font-black text-slate-700 uppercase shrink-0 overflow-hidden">
                              {users.find(u => u.id === c.userId)?.avatarUrl ? (
                                  <img src={users.find(u => u.id === c.userId)?.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                              ) : (
                                  users.find(u => u.id === c.userId)?.name.slice(0,1)
                              )}
                           </div>
                          <div>
                             <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs font-black text-slate-800">{users.find(u => u.id === c.userId)?.name}</span>
                                <span className="text-[10px] font-bold text-slate-400">{new Date(c.createdAt).toLocaleString()}</span>
                             </div>
                             <div className="bg-white p-4 rounded-xl rounded-tl-none shadow-sm text-xs font-medium text-slate-600 leading-relaxed border border-slate-100">
                                {c.text}
                             </div>
                          </div>
                       </div>
                   ))}
                </div>
                
                <div className="bg-white p-2 rounded-2xl shadow-sm border border-slate-200 flex gap-2">
                   <input 
                     className="flex-1 p-3 text-xs font-medium outline-none" 
                     placeholder="Tulis komentar..." 
                     value={commentText}
                     onChange={e => setCommentText(e.target.value)}
                     onKeyDown={e => e.key === 'Enter' && postComment()}
                   />
                   <button onClick={postComment} className="bg-slate-900 text-white p-3 rounded-xl hover:bg-blue-600 transition">
                      <Send size={16} />
                   </button>
                </div>
            </div>
         </div>

         {/* Sidebar */}
         <div className="space-y-6">
            {/* Team Card */}
            <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 space-y-4">
               <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <Users size={14} /> Tim Kolaborator
               </h3>
               <div className="flex flex-col gap-3">
                  {project.collaborators.map(uid => {
                     const user = users.find(u => u.id === uid);
                     return (
                        <div key={uid} className="flex items-center gap-3 p-3 hover:bg-slate-50 rounded-xl transition cursor-pointer">
                           <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-[10px] font-black uppercase overflow-hidden">
                              {user?.avatarUrl ? (
                                  <img src={user.avatarUrl} alt={user.name} className="w-full h-full object-cover" />
                              ) : (
                                  user?.name.slice(0,1)
                              )}
                           </div>
                           <div>
                              <p className="text-xs font-bold text-slate-700">{user?.name}</p>
                              <p className="text-[10px] text-slate-400">{user?.role}</p>
                           </div>
                        </div>
                     );
                  })}
               </div>
            </div>

            {/* Attachments Card (Mockup mostly as file types vary) */}
            <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 space-y-4">
               <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <Paperclip size={14} /> Lampiran
               </h3>
               <div className="space-y-2">
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-center py-8">
                     <p className="text-[10px] font-bold text-slate-400">Tidak ada lampiran utama.</p>
                     <button className="mt-2 text-[10px] font-black text-blue-600 hover:underline">UPLOAD FILE</button>
                  </div>
               </div>
            </div>
         </div>
      </div>
    </div>
  );
};
