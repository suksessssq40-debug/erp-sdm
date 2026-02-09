import React, { useState } from 'react';
import { useAppStore } from '../context/StoreContext';
import { useRouter } from 'next/navigation';
import { Project, UserRole, ProjectPriority, KanbanStatus, User } from '../types';
import { Search, Calendar, CheckCircle2, AlertCircle, Clock, ChevronRight, BarChart2, Plus, FolderSearch } from 'lucide-react';
import { ProjectModal } from './ProjectModal';
import { useToast } from './Toast';
import { sendTelegramNotification, escapeHTML } from '../utils';
import { LoadingState } from './LoadingState';
import { EmptyState } from './EmptyState';

export const ProjectList = () => {
  const { projects, users, currentUser, settings, addProject, updateProject, fetchProjects } = useAppStore();
  const router = useRouter();
  const toast = useToast();

  const [isLoading, setIsLoading] = React.useState(true);

  // Lazy Load on Mount
  React.useEffect(() => {
    if (fetchProjects) {
      fetchProjects().finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, []);

  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [filterPriority, setFilterPriority] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // 1. Filter Projects based on Role & Search & Date
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

    // Date Filter (based on p.createdAt) -> User asked "tanggal di buat/create nya"
    if (startDate) {
      const start = new Date(startDate).getTime();
      if (p.createdAt < start) return false;
    }
    if (endDate) {
      const end = new Date(endDate).setHours(23, 59, 59, 999);
      if (p.createdAt > end) return false;
    }

    return true;
  });

  const exportToExcel = async () => {
    try {
      const { utils, writeFile } = await import('xlsx');
      const data = visibleProjects.map(p => ({
        'Judul': p.title,
        'Status': p.status,
        'Deadline': new Date(p.deadline).toLocaleDateString(),
        'Tgl Dibuat': new Date(p.createdAt).toLocaleDateString(),
        'Dibuat Oleh': users.find(u => u.id === p.createdBy)?.name || '-',
        'Deskripsi': p.description,
        'Daftar Tugas': p.tasks.map(t => `[${t.isCompleted ? '✓' : ' '}] ${t.title}`).join('\n')
      }));
      const worksheet = utils.json_to_sheet(data);
      const workbook = utils.book_new();
      utils.book_append_sheet(workbook, worksheet, 'Proyek');
      writeFile(workbook, `Laporan_Proyek_${new Date().toISOString().split('T')[0]}.xlsx`);
      toast.success("Excel berhasil diunduh");
    } catch (e) {
      toast.error("Gagal export excel");
    }
  };

  const exportToPDF = async () => {
    try {
      const { jsPDF } = await import('jspdf');
      // @ts-ignore
      const autoTable = (await import('jspdf-autotable')).default;
      const doc = new jsPDF('l', 'mm', 'a4');

      doc.setFontSize(18);
      doc.text('LAPORAN PROYEK ERP', 14, 22);
      doc.setFontSize(10);
      doc.text(`Dicetak pada: ${new Date().toLocaleString()}`, 14, 28);
      if (startDate || endDate) {
        doc.text(`Periode: ${startDate || '-'} s/d ${endDate || '-'}`, 14, 34);
      }

      const tableData = visibleProjects.map((p, i) => [
        i + 1,
        p.title,
        p.status,
        p.priority,
        new Date(p.deadline).toLocaleDateString(),
        new Date(p.createdAt).toLocaleDateString(),
        p.collaborators.map(id => users.find(u => u.id === id)?.name).join(', ')
      ]);

      autoTable(doc, {
        startY: 40,
        head: [['No', 'Judul Proyek', 'Status', 'Prioritas', 'Deadline', 'Tgl Dibuat', 'PIC Tim']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [51, 65, 85] }
      });

      doc.save(`Laporan_Proyek_${new Date().toISOString().split('T')[0]}.pdf`);
      toast.success("PDF berhasil diunduh");
    } catch (e) {
      console.error(e);
      toast.error("Gagal export PDF");
    }
  };

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
    router.push(`/${currentUser.tenantId || 'sdm'}/${currentUser.role.toLowerCase()}/projects/${projectId}`);
  };

  const handleSaveProject = (project: Project) => {
    if (!currentUser) return;
    addProject(project); // From store

    // Detailed Telegram Notification
    const collaborators = users.filter(u => project.collaborators.includes(u.id));
    const tagString = collaborators.map(u => u.telegramUsername ? `${u.telegramUsername}` : u.name).join(', ');

    const officeLabel = settings.companyProfile?.name ? settings.companyProfile.name.toUpperCase() : currentUser.tenantId.toUpperCase() + " ERP";

    const msg = `🏢 <b>${escapeHTML(officeLabel)}</b>\n` +
      `🚀 <b>PROYEK BARU DIBUAT (LIST VIEW)</b>\n\n` +
      `📌 PROYEK: <b>${escapeHTML(project.title)}</b>\n` +
      `📜 DESC: <i>${escapeHTML(project.description || '-')}</i>\n` +
      `📅 DEADLINE: <b>${new Date(project.deadline).toLocaleDateString('id-ID')}</b>\n` +
      `🔥 PRIORITY: <b>${project.priority}</b>\n\n` +
      `👤 OLEH: <b>${escapeHTML(currentUser.name)}</b>\n` +
      `👥 TEAM: ${escapeHTML(tagString)}`;

    let targetChatId = settings.telegramGroupId || settings.telegramOwnerChatId;

    if (targetChatId) {
      if (targetChatId.includes('_')) {
        const parts = targetChatId.split('_');
        if (!parts[0].startsWith('-')) targetChatId = `-100${parts[0]}_${parts[1]}`;
      } else if (!targetChatId.startsWith('-') && /^\d+$/.test(targetChatId)) {
        targetChatId = `-100${targetChatId}`;
      }
    }

    sendTelegramNotification(settings.telegramBotToken, targetChatId, msg);
    setShowAddModal(false);
  };

  if (isLoading) {
    return <LoadingState text="Menyiapkan data proyek..." />;
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header & Stats */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <button
            onClick={() => router.push(`/${currentUser?.tenantId || 'sdm'}/${currentUser?.role.toLowerCase()}/kanban`)}
            className="mb-4 flex items-center gap-2 text-slate-400 hover:text-blue-600 transition text-[10px] font-black uppercase tracking-widest"
          >
            <ChevronRight className="rotate-180" size={14} /> Kembali ke Kanban
          </button>
          <h2 className="text-3xl font-black text-slate-800 tracking-tight mb-2">Daftar Proyek</h2>
          <p className="text-slate-500 font-medium">Semua proyek dalam tampilan terperinci.</p>
        </div>
        <div className="flex gap-4">
          <button
            onClick={() => setShowAddModal(true)}
            className="px-6 py-4 bg-blue-600 rounded-2xl shadow-lg shadow-blue-200 text-white flex gap-2 items-center hover:bg-blue-700 transition"
          >
            <Plus size={20} className="stroke-[3px]" />
            <div className="flex flex-col items-start leading-none">
              <span className="text-[10px] font-black uppercase tracking-widest">BUAT</span>
              <span className="text-sm font-black">PROYEK</span>
            </div>
          </button>
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

      {/* Filters & Export */}
      <div className="bg-white p-6 md:p-8 rounded-[2.5rem] shadow-sm border border-slate-100 space-y-6">
        <div className="flex flex-col md:flex-row gap-4 items-center">
          <div className="relative flex-1 w-full">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              className="w-full pl-12 pr-4 py-3 bg-slate-50 border-2 border-transparent focus:border-blue-500 rounded-2xl font-bold text-xs outline-none transition"
              placeholder="Cari nama proyek..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
          <select
            className="w-full md:w-48 p-4 bg-slate-50 border-2 border-transparent focus:border-blue-500 rounded-2xl font-black text-[10px] uppercase outline-none"
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
          >
            <option value="ALL">Semua Status</option>
            {Object.values(KanbanStatus).map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select
            className="w-full md:w-48 p-4 bg-slate-50 border-2 border-transparent focus:border-blue-500 rounded-2xl font-black text-[10px] uppercase outline-none"
            value={filterPriority}
            onChange={e => setFilterPriority(e.target.value)}
          >
            <option value="ALL">Semua Prioritas</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </select>
        </div>

        <div className="flex flex-col md:flex-row justify-between items-center gap-6 pt-6 border-t border-slate-50">
          <div className="flex flex-wrap items-center gap-4 w-full md:w-auto">
            <div className="space-y-1">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Dari Tanggal (Dibuat)</label>
              <input type="date" className="p-3 bg-slate-50 rounded-xl text-[10px] font-bold border-2 border-transparent focus:border-blue-500 outline-none w-full" value={startDate} onChange={e => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Sampai Tanggal</label>
              <input type="date" className="p-3 bg-slate-50 rounded-xl text-[10px] font-bold border-2 border-transparent focus:border-blue-500 outline-none w-full" value={endDate} onChange={e => setEndDate(e.target.value)} />
            </div>
            {(startDate || endDate) && (
              <button onClick={() => { setStartDate(''); setEndDate(''); }} className="mt-5 text-[9px] font-black text-rose-500 hover:underline uppercase">Reset</button>
            )}
          </div>

          <div className="flex gap-3 w-full md:w-auto">
            <button
              onClick={exportToExcel}
              className="flex-1 md:flex-none px-6 py-3 bg-emerald-50 text-emerald-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-600 hover:text-white transition"
            >
              Export Excel
            </button>
            <button
              onClick={exportToPDF}
              className="flex-1 md:flex-none px-6 py-3 bg-rose-50 text-rose-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-600 hover:text-white transition"
            >
              Export PDF
            </button>
          </div>
        </div>
      </div>

      {visibleProjects.length === 0 ? (
        <EmptyState
          icon={FolderSearch}
          title="Belum Ada Proyek"
          description={searchQuery ? `Tidak ditemukan proyek dengan kata kunci "${searchQuery}"` : "Belum ada proyek aktif. Silakan buat proyek baru."}
          actionLabel="Buat Proyek Baru"
          onAction={() => setShowAddModal(true)}
        />
      ) : (
        <div className="bg-white rounded-[2.5rem] shadow-xl border border-slate-100 overflow-hidden min-h-[500px]">
          {/* Desktop Header */}
          <div className="hidden md:grid grid-cols-12 gap-4 p-6 bg-slate-50 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest">
            <div className="col-span-3 pl-4">PROJECT NAME</div>
            <div className="col-span-3">DESKRIPSI</div>
            <div className="col-span-2 text-center">DEADLINE</div>
            <div className="col-span-2 text-center">PROGRESS & STATUS</div>
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
                  <div className="col-span-3 w-full flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${project.priority === 'High' ? 'bg-rose-100 text-rose-600' : 'bg-blue-100 text-blue-600'
                      }`}>
                      <BarChart2 size={24} />
                    </div>
                    <div>
                      <h4 className="font-black text-slate-800 text-sm group-hover:text-blue-600 transition truncate max-w-[150px]">{project.title}</h4>
                      <span className={`text-[8px] font-black px-1.5 py-0.5 rounded ${project.priority === 'High' ? 'bg-rose-500 text-white' : 'bg-slate-200 text-slate-500'}`}>{project.priority}</span>
                    </div>
                  </div>

                  {/* Description Column */}
                  <div className="col-span-3">
                    <p className="text-[10px] font-medium text-slate-500 line-clamp-2 leading-relaxed">{project.description || '-'}</p>
                  </div>

                  {/* Mobile Labels */}
                  <div className="w-full flex md:hidden justify-between items-center text-xs font-bold text-slate-500 mb-2">
                    <span>Deadline & Progress</span>
                  </div>

                  {/* Deadline */}
                  <div className="col-span-2 text-center w-full md:w-auto flex md:justify-center">
                    <div className={`inline-flex items-center px-3 py-1.5 rounded-lg text-[10px] font-black ${isOverdue ? 'bg-rose-100 text-rose-600 animate-pulse' : 'bg-slate-100 text-slate-600'}`}>
                      {isOverdue ? 'OVERDUE' : new Date(project.deadline).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </div>
                  </div>

                  {/* Progress & Status */}
                  <div className="col-span-2 w-full md:w-auto px-4 flex flex-col gap-2 items-center">
                    <div className="w-full flex justify-between items-center">
                      <span className="text-[9px] font-black text-slate-400 uppercase">{progress}%</span>
                      <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${getStatusColor(project.status as KanbanStatus)}`}>
                        {project.status.replace('_', ' ')}
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500 rounded-full transition-all duration-1000" style={{ width: `${progress}%` }}></div>
                    </div>
                  </div>

                  {/* Team */}
                  <div className="col-span-2 flex justify-center w-full md:w-auto pt-4 md:pt-0">
                    <div className="flex -space-x-2">
                      {project.collaborators.slice(0, 4).map(uid => {
                        const u = users.find(user => user.id === uid);
                        return (
                          <div key={uid} className="w-8 h-8 rounded-full bg-slate-200 border-2 border-white flex items-center justify-center text-[10px] font-black text-slate-500 uppercase overflow-hidden" title={u?.name}>
                            {u?.avatarUrl ? (
                              <img src={u.avatarUrl} alt={u.name} className="w-full h-full object-cover" />
                            ) : (
                              u?.name.slice(0, 1)
                            )}
                          </div>
                        );
                      })}
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

          </div>
        </div>
      )}

      {showAddModal && currentUser && (
        <ProjectModal
          users={users}
          currentUser={currentUser}
          initialData={null}
          onClose={() => setShowAddModal(false)}
          onSave={handleSaveProject}
          toast={toast}
        />
      )}
    </div>
  );
};
