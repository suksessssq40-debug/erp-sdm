import React, { useState } from 'react';
import { useAppStore } from '../context/StoreContext';
import { useRouter } from 'next/navigation';
import { Project, UserRole, ProjectPriority, KanbanStatus, User } from '../types';
import { Search, Calendar, CheckCircle2, AlertCircle, Clock, ChevronRight, BarChart2 } from 'lucide-react';

export const ProjectList = () => {
  const { projects, users, currentUser } = useAppStore();
  const router = useRouter();
  
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [filterPriority, setFilterPriority] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // 1. Filter Projects based on Role & Search
  const visibleProjects = projects.filter(p => {
    // Role Check
    if (p.isManagementOnly) {
      if (!currentUser || ![UserRole.OWNER, UserRole.MANAGER, UserRole.FINANCE, UserRole.SUPERADMIN].includes(currentUser.role)) {
        return false;
      }
    }
    // Search
    if (searchQuery && !p.title.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    // Status Filter
    if (filterStatus !== 'ALL' && p.status !== filterStatus) return false;
    // Priority Filter
    if (filterPriority !== 'ALL' && p.priority !== filterPriority) return false;

    return true;
  });

  const getProgress = (p: Project) => {
    if (!p.tasks || p.tasks.length === 0) return 0;
    const completed = p.tasks.filter(t => t.isCompleted).length;
    return Math.round((completed / p.tasks.length) * 100);
  };

  const getStatusColor = (status: KanbanStatus) => {
    switch (status) {
      case KanbanStatus.ON_GOING: return 'bg-blue-100 text-blue-700';
      case KanbanStatus.TODO: return 'bg-slate-100 text-slate-700';
      case KanbanStatus.DOING: return 'bg-amber-100 text-amber-700';
      case KanbanStatus.PREVIEW: return 'bg-indigo-100 text-indigo-700';
      case KanbanStatus.DONE: return 'bg-emerald-100 text-emerald-700';
      default: return 'bg-slate-100 text-slate-500';
    }
  };

  const navigateToDetail = (projectId: string) => {
    if (!currentUser) return;
    router.push(`/${currentUser.role.toLowerCase()}/projects/${projectId}`);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header & Stats */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
           <h2 className="text-3xl font-black text-slate-800 tracking-tight mb-2">Daftar Proyek</h2>
           <p className="text-slate-500 font-medium">Semua proyek dalam tampilan terperinci.</p>
        </div>
        <div className="flex gap-4">
           <div className="px-6 py-4 bg-white rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center">
              <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">TOTAL</span>
              <span className="text-2xl font-black text-slate-800">{visibleProjects.length}</span>
           </div>
           <div className="px-6 py-4 bg-white rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center">
              <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">ON GOING</span>
              <span className="text-2xl font-black text-blue-600">{visibleProjects.filter(p => p.status === 'ON_GOING').length}</span>
           </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 flex flex-col md:flex-row gap-4 items-center">
        <div className="relative flex-1 w-full">
           <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
           <input 
             className="w-full pl-12 pr-4 py-3 bg-slate-50 rounded-xl font-bold text-xs outline-none focus:ring-2 focus:ring-blue-500 transition" 
             placeholder="Cari nama proyek..."
             value={searchQuery}
             onChange={e => setSearchQuery(e.target.value)}
           />
        </div>
        <select 
          className="w-full md:w-48 p-3 bg-slate-50 rounded-xl font-bold text-xs outline-none focus:ring-2 focus:ring-blue-500"
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
        >
          <option value="ALL">Semua Status</option>
          {Object.values(KanbanStatus).map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select 
           className="w-full md:w-48 p-3 bg-slate-50 rounded-xl font-bold text-xs outline-none focus:ring-2 focus:ring-blue-500"
           value={filterPriority}
           onChange={e => setFilterPriority(e.target.value)}
        >
          <option value="ALL">Semua Prioritas</option>
          <option value="High">High</option>
          <option value="Medium">Medium</option>
          <option value="Low">Low</option>
        </select>
      </div>

      {/* Table View (Desktop) / Card View (Mobile) */}
      <div className="bg-white rounded-[2.5rem] shadow-xl border border-slate-100 overflow-hidden min-h-[500px]">
        {/* Desktop Header */}
        <div className="hidden md:grid grid-cols-12 gap-4 p-6 bg-slate-50 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest">
           <div className="col-span-4 pl-4">PROJECT NAME</div>
           <div className="col-span-2 text-center">DEADLINE</div>
           <div className="col-span-2 text-center">PROGRESS</div>
           <div className="col-span-2 text-center">PRIORITY / STATUS</div>
           <div className="col-span-2 text-center">TEAM</div>
        </div>

        <div className="divide-y divide-slate-50">
           {visibleProjects.map(project => {
             const progress = getProgress(project);
             const isOverdue = new Date(project.deadline) < new Date() && project.status !== KanbanStatus.DONE;
             
             return (
               <div 
                 key={project.id} 
                 onClick={() => navigateToDetail(project.id)}
                 className="group p-6 flex flex-col md:grid md:grid-cols-12 gap-4 items-center hover:bg-blue-50/30 transition cursor-pointer"
               >
                 {/* Project Info */}
                 <div className="col-span-4 w-full flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                      project.priority === 'High' ? 'bg-rose-100 text-rose-600' : 'bg-blue-100 text-blue-600'
                    }`}>
                       <BarChart2 size={24} />
                    </div>
                    <div>
                       <h4 className="font-black text-slate-800 text-sm group-hover:text-blue-600 transition">{project.title}</h4>
                       <p className="text-[10px] font-medium text-slate-400 line-clamp-1">{project.description || 'Tidak ada deskripsi'}</p>
                    </div>
                 </div>

                 {/* Mobile Labels */}
                 <div className="w-full flex md:hidden justify-between items-center text-xs font-bold text-slate-500 mb-2">
                    <span>Deadline & Progress</span>
                 </div>

                 {/* Deadline */}
                 <div className="col-span-2 text-center w-full md:w-auto flex md:justify-center">
                    <div className={`inline-flex items-center px-3 py-1.5 rounded-lg text-[10px] font-black ${isOverdue ? 'bg-rose-100 text-rose-600 animate-pulse' : 'bg-slate-100 text-slate-600'}`}>
                       <Clock size={12} className="mr-2" />
                       {isOverdue ? 'OVERDUE' : new Date(project.deadline).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </div>
                 </div>

                 {/* Progress */}
                 <div className="col-span-2 w-full md:w-auto px-4">
                    <div className="flex justify-between text-[9px] font-black text-slate-400 mb-1">
                       <span>COMPLETED</span>
                       <span>{progress}%</span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                       <div className="h-full bg-blue-500 rounded-full transition-all duration-1000" style={{ width: `${progress}%` }}></div>
                    </div>
                 </div>

                 {/* Priority & Status */}
                 <div className="col-span-2 text-center w-full md:w-auto flex gap-2 justify-center">
                    <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase ${project.priority === 'High' ? 'bg-rose-100 text-rose-600' : 'bg-slate-100 text-slate-600'}`}>
                       {project.priority}
                    </span>
                    <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase ${getStatusColor(project.status as KanbanStatus)}`}>
                       {project.status.replace('_', ' ')}
                    </span>
                 </div>

                 {/* Team */}
                 <div className="col-span-2 flex justify-center w-full md:w-auto pt-4 md:pt-0">
                    <div className="flex -space-x-2">
                       {project.collaborators.slice(0, 4).map(uid => (
                          <div key={uid} className="w-8 h-8 rounded-full bg-slate-200 border-2 border-white flex items-center justify-center text-[10px] font-black text-slate-500 uppercase" title={users.find(u => u.id === uid)?.name}>
                             {users.find(u => u.id === uid)?.name.slice(0, 1)}
                          </div>
                       ))}
                       {project.collaborators.length > 4 && (
                          <div className="w-8 h-8 rounded-full bg-slate-100 border-2 border-white flex items-center justify-center text-[9px] font-black text-slate-400">
                             +{project.collaborators.length - 4}
                          </div>
                       )}
                    </div>
                 </div>

                 <div className="hidden md:block col-span-12 absolute right-6 text-slate-300 group-hover:text-blue-500 transition">
                    <ChevronRight size={20} />
                 </div>
               </div>
             );
           })}

           {visibleProjects.length === 0 && (
             <div className="p-20 flex flex-col items-center justify-center text-center">
                <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-6">
                   <Search size={32} className="text-slate-300" />
                </div>
                <h3 className="text-slate-800 font-bold text-lg">Tidak ada proyek ditemukan</h3>
                <p className="text-slate-400 text-sm mt-2">Coba ubah filter atau kata kunci pencarian Anda.</p>
             </div>
           )}
        </div>
      </div>
    </div>
  );
};
