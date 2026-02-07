import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { KanbanStatus, UserRole, Project, Task, User, ProjectPriority, AppSettings, SystemLog, SystemActionType } from '../types';
import { KANBAN_COLUMNS } from '../constants';
import {
  Plus, CheckCircle, Clock, EyeOff, UserPlus, UserCheck,
  History as HistoryIcon, Edit2, CheckCircle2, LayoutGrid, X, Circle,
  ChevronRight, BarChart2, FileText
} from 'lucide-react';
import { sendTelegramNotification, escapeHTML } from '../utils';
import { useToast } from './Toast';
import { useAppStore } from '../context/StoreContext';
import { ProjectModal } from './ProjectModal';

interface KanbanProps {
  projects: Project[];
  users: User[];
  currentUser: User;
  settings: AppSettings;
  logs: SystemLog[];
  onAddProject: (p: Project) => void;
  onUpdateProject: (p: Project) => void;
  fetchLogs?: (target?: string) => Promise<void>;
  toast: ReturnType<typeof useToast>;
  onCelebrate?: (message: string) => void;
}

const Kanban: React.FC<KanbanProps> = ({ projects, users, currentUser, settings, logs: propsLogs, onAddProject, onUpdateProject, fetchLogs: propsFetchLogs, toast, onCelebrate }) => {
  const router = useRouter();

  // Defensive Guard
  if (!currentUser || !settings || !projects || !users) {
    return <div className="p-8 text-center text-slate-400">Loading Kanban Data...</div>;
  }
  const { logs: storeLogs, patchProject, deleteProject, fetchLogs: storeFetchLogs } = useAppStore(); // Access logs, patchProject, and deleteProject from store

  // Prefer props if provided, fallback to store
  const logs = propsLogs || storeLogs || [];
  const fetchLogs = propsFetchLogs || storeFetchLogs;
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [draggedProjectId, setDraggedProjectId] = useState<string | null>(null);
  const [historyProject, setHistoryProject] = useState<Project | null>(null); // State for history modal
  const [isExporting, setIsExporting] = useState(false);

  const [activeTab, setActiveTab] = useState<'priority' | 'deadline' | 'search'>('priority');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Project[]>([]);

  // Filter visible projects first (Role based)
  const baseProjects = projects.filter(p => {
    if (p.isManagementOnly) {
      return [UserRole.OWNER, UserRole.MANAGER, UserRole.FINANCE].includes(currentUser.role);
    }
    return true;
  });

  // Handle Search Autocomplete
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchQuery(val);
    if (val.length >= 3) {
      const matches = baseProjects.filter(p => p.title.toLowerCase().includes(val.toLowerCase()));
      setSearchResults(matches);
    } else {
      setSearchResults([]);
    }
  };

  const getProcessedProjects = () => {
    let processed = [...baseProjects];

    // 1. FILTERING
    if (activeTab === 'search' && searchQuery.length >= 3) {
      processed = processed.filter(p => p.title.toLowerCase().includes(searchQuery.toLowerCase()));
    }

    // 2. SORTING
    if (activeTab === 'priority') {
      const weight = { 'High': 3, 'Medium': 2, 'Low': 1 };
      processed.sort((a, b) => weight[b.priority] - weight[a.priority]);
    } else if (activeTab === 'deadline') {
      processed.sort((a, b) => {
        if (!a.deadline) return 1; // No deadline -> Bottom
        if (!b.deadline) return -1;
        return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
      });
    }

    return processed;
  };

  const finalProjects = getProcessedProjects();

  // Helper function to send notifications consistently
  const notifyTelegram = (title: string, content: string, project: Project, extraInfo?: string) => {
    const collaborators = users.filter(u => project.collaborators.includes(u.id));
    const tagString = collaborators.map(u => u.telegramUsername ? `${u.telegramUsername}` : u.name).join(', ');

    const officeLabel = settings.companyProfile?.name ? settings.companyProfile.name.toUpperCase() : currentUser.tenantId.toUpperCase() + " ERP";

    const msg = `🏢 <b>${escapeHTML(officeLabel)}</b>\n` +
      `<b>${escapeHTML(title)}</b>\n\n` +
      `📌 PROYEK: <b>${escapeHTML(project.title)}</b>\n` +
      `📜 DESC: <i>${escapeHTML(project.description || '-')}</i>\n` +
      `📅 DEADLINE: <b>${new Date(project.deadline).toLocaleDateString('id-ID')}</b>\n` +
      `🔥 PRIORITY: <b>${project.priority}</b>\n\n` +
      `${content}\n` +
      (extraInfo ? `\n💡 INFO: ${extraInfo}\n` : '') +
      `\n👤 OLEH: <b>${escapeHTML(currentUser.name)}</b>\n` +
      `👥 TEAM: ${escapeHTML(tagString)}`;

    let targetChatId = project.isManagementOnly ? settings.telegramOwnerChatId : settings.telegramGroupId;

    if (targetChatId) {
      if (targetChatId.includes('_')) {
        const parts = targetChatId.split('_');
        if (!parts[0].startsWith('-')) targetChatId = `-100${parts[0]}_${parts[1]}`;
      } else if (!targetChatId.startsWith('-') && /^\d+$/.test(targetChatId)) {
        targetChatId = `-100${targetChatId}`;
      }
    }

    sendTelegramNotification(settings.telegramBotToken, targetChatId, msg);
  };

  const handleSaveProject = (project: Project) => {
    const isNew = !projects.find(p => p.id === project.id);
    const taskSummary = project.tasks && project.tasks.length > 0
      ? `\n📋 <b>DAFTAR TUGAS:</b>\n` + project.tasks.map((t, i) => `${i + 1}. [${t.isCompleted ? '✓' : ' '}] ${t.title}`).join('\n')
      : "\n⚠️ <i>Belum ada tugas dibuat.</i>";

    if (isNew) {
      onAddProject(project);
      notifyTelegram("🚀 PROYEK BARU DIBUAT", `Status: <b>${project.status}</b>\n${taskSummary}`, project, "Silakan cek di papan Kanban untuk detail tugas.");
    } else {
      const oldProject = projects.find(p => p.id === project.id);
      onUpdateProject(project);

      // Detailed change summary
      let changes = [];
      if (oldProject?.title !== project.title) changes.push(`Judul: ${oldProject?.title} ➔ ${project.title}`);
      if (oldProject?.priority !== project.priority) changes.push(`Prioritas: ${oldProject?.priority} ➔ ${project.priority}`);
      if (oldProject?.status !== project.status) changes.push(`Status: ${oldProject?.status} ➔ ${project.status}`);
      if (oldProject?.deadline !== project.deadline) changes.push(`Deadline: ${oldProject?.deadline} ➔ ${project.deadline}`);

      const changeMsg = (changes.length > 0 ? `🔄 <b>PERUBAHAN:</b>\n- ${changes.join('\n- ')}` : "Detail proyek diperbarui.") + `\n${taskSummary}`;

      notifyTelegram("📝 DATA PROYEK DIPERBARUI", changeMsg, project);
    }
    setShowAddModal(false);
    setEditingProject(null);
  };

  const handleMoveStatus = async (project: Project, newStatus: KanbanStatus) => {
    // Definisi Otoritas
    const isOwner = currentUser.role === UserRole.OWNER;

    if (!isOwner && newStatus === KanbanStatus.DONE) {
      toast.warning("Hanya OWNER yang memiliki otoritas untuk memindahkan proyek ke status SELESAI (DONE). Mohon lapor ke Owner untuk finalisasi.");
      return;
    }

    if (project.status === newStatus) return;

    try {
      await patchProject(project.id, 'MOVE_STATUS', { status: newStatus });

      if (newStatus === KanbanStatus.DONE && onCelebrate) {
        onCelebrate(`Proyek "${project.title}" selesai!`);
      }

      const updated = { ...project, status: newStatus };
      notifyTelegram(
        "📢 UPDATE STATUS KANBAN",
        `ALUR: <b>${project.status}</b> ➔ <b>${newStatus}</b>`,
        updated,
        newStatus === KanbanStatus.DONE ? "🌟 Proyek telah dinyatakan SELESAI!" : undefined
      );
      toast.success(`Status proyek "${project.title}" berhasil diubah menjadi ${newStatus}`);
    } catch (err: any) {
      toast.error(err?.message || 'Gagal mengupdate status proyek. Periksa koneksi dan coba lagi.');
    }
  };

  const handleExportPDF = async () => {
    if (finalProjects.length === 0) {
      toast.warning("Tidak ada proyek untuk di-export.");
      return;
    }

    setIsExporting(true);
    try {
      const { jsPDF } = await import('jspdf');
      // @ts-ignore
      const autoTable = (await import('jspdf-autotable')).default;
      const doc = new jsPDF('p', 'mm', 'a4');
      const pageWidth = doc.internal.pageSize.getWidth();

      // --- HEADER ---
      doc.setFillColor(30, 41, 59); // Slate-800
      doc.rect(0, 0, pageWidth, 40, 'F');

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(22);
      doc.setFont('helvetica', 'bold');
      doc.text('LAPORAN PROGRESS KANBAN', 14, 18);

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`Dicetak Oleh: ${currentUser.name}`, 14, 26);
      doc.text(`Tanggal Cetak: ${new Date().toLocaleString('id-ID')}`, 14, 32);
      doc.text(`Total Proyek: ${finalProjects.length}`, pageWidth - 50, 32);

      let currentY = 50;

      // --- PROJECTS LOOP ---
      finalProjects.forEach((project, index) => {
        // Add new page if space is tight (roughly 60mm needed for project header + some tasks)
        if (currentY > 230) {
          doc.addPage();
          currentY = 20;
        }

        // Project Title Header
        doc.setFillColor(248, 250, 252); // Slate-50
        doc.rect(14, currentY, pageWidth - 28, 12, 'F');
        doc.setDrawColor(226, 232, 240); // Slate-200
        doc.line(14, currentY, 14, currentY + 12);

        doc.setTextColor(30, 41, 59);
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text(`${index + 1}. ${project.title.toUpperCase()}`, 18, currentY + 8);

        doc.setFontSize(8);
        doc.setTextColor(100, 116, 139);
        doc.text(`PRIORITY: ${project.priority} | STATUS: ${project.status}`, pageWidth - 70, currentY + 8);
        currentY += 18;

        // Description
        doc.setTextColor(100, 116, 139);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'italic');
        const splitDesc = doc.splitTextToSize(project.description || 'Tidak ada deskripsi.', pageWidth - 32);
        doc.text(splitDesc, 18, currentY);
        currentY += (splitDesc.length * 5) + 6;

        // Collaborators
        const teamNames = project.collaborators.map(id => users.find(u => u.id === id)?.name || 'Unknown').join(', ');
        doc.setTextColor(30, 41, 59);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.text(`TIM KANBAN: `, 18, currentY);
        doc.setFont('helvetica', 'normal');
        doc.text(teamNames, 42, currentY);
        currentY += 8;

        // Tasks Table
        const taskData = project.tasks.map((task, tIdx) => [
          tIdx + 1,
          task.title,
          task.assignedTo.map(id => users.find(u => u.id === id)?.name || '-').join(', '),
          task.isCompleted ? 'SELESAI' : 'PROSES',
          task.isCompleted && task.completionProof ? (task.completionProof.description + (task.completionProof.link ? `\n[LINK: ${task.completionProof.link}]` : '')) : '-'
        ]);

        autoTable(doc, {
          startY: currentY,
          head: [['No', 'Tugas / Pekerjaan', 'PIC Tugas', 'Status', 'Hasil Kerja & Link Bukti']],
          body: taskData,
          theme: 'grid',
          headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontSize: 8, fontStyle: 'bold' },
          bodyStyles: { fontSize: 7.5, textColor: [30, 41, 59], cellPadding: 3 },
          columnStyles: {
            0: { cellWidth: 8 },
            1: { cellWidth: 50 },
            2: { cellWidth: 35 },
            3: { cellWidth: 15 },
            4: { cellWidth: 'auto' }
          },
          margin: { left: 18 },
          didDrawPage: (data: any) => {
            currentY = data.cursor.y + 8;
          }
        });

        // --- DISCUSSION SECTION ---
        if (project.comments && project.comments.length > 0) {
          if (currentY > 240) { doc.addPage(); currentY = 20; }

          doc.setFillColor(241, 245, 249);
          doc.rect(18, currentY, pageWidth - 36, 6, 'F');
          doc.setTextColor(71, 85, 105);
          doc.setFontSize(8);
          doc.setFont('helvetica', 'bold');
          doc.text('CATATAN DISKUSI & INSTRUKSI PROYEK', 22, currentY + 4);
          currentY += 10;

          project.comments.slice(-5).forEach(comment => {
            const userName = users.find(u => u.id === comment.userId)?.name || 'System';
            const date = new Date(comment.createdAt).toLocaleDateString('id-ID');

            doc.setTextColor(30, 41, 59);
            doc.setFont('helvetica', 'bold');
            doc.text(`${userName} (${date}):`, 22, currentY);

            doc.setFont('helvetica', 'normal');
            doc.setTextColor(100, 116, 139);
            const splitComment = doc.splitTextToSize(comment.text, pageWidth - 50);
            doc.text(splitComment, 22, currentY + 4);
            currentY += (splitComment.length * 4) + 4;
          });
          currentY += 4;
        }

        // Add separator between projects
        if (index < finalProjects.length - 1) {
          doc.setDrawColor(241, 245, 249);
          doc.line(14, currentY - 5, pageWidth - 14, currentY - 5);
        }
      });

      doc.save(`Laporan_Kanban_${currentUser.name}_${new Date().toISOString().split('T')[0]}.pdf`);
      toast.success("Laporan PDF berhasil di-generate!");
    } catch (e) {
      console.error(e);
      toast.error("Gagal membuat PDF.");
    } finally {
      setIsExporting(false);
    }
  };

  const onDragStart = (e: React.DragEvent, id: string) => {
    setDraggedProjectId(id);
    e.dataTransfer.setData("projectId", id);
  };

  const onDrop = (e: React.DragEvent, status: KanbanStatus) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("projectId");
    const project = projects.find(p => p.id === id);
    if (project && project.status !== status) {
      handleMoveStatus(project, status);
    }
    setDraggedProjectId(null);
  };

  return (
    <div className="space-y-6">
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="text-xl font-bold text-slate-800">Papan Proyek {currentUser.tenantId.toUpperCase()}</h3>
            <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">DRAG & DROP UNTUK UPDATE STATUS</p>
          </div>
          <div className="flex gap-3 w-full md:w-auto">
            <button
              onClick={handleExportPDF}
              disabled={isExporting}
              className="bg-rose-50 text-rose-600 px-5 py-3 rounded-2xl flex items-center justify-center space-x-2 hover:bg-rose-600 hover:text-white transition flex-1 md:flex-none shadow-sm font-black text-xs uppercase tracking-widest disabled:opacity-50"
            >
              {isExporting ? (
                <div className="w-4 h-4 border-2 border-rose-600 border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <FileText size={18} />
              )}
              <span>{isExporting ? 'EXPORTING...' : 'EXPORT PDF'}</span>
            </button>
            <button onClick={() => router.push(`/${currentUser.tenantId || 'sdm'}/${currentUser.role.toLowerCase()}/projects`)} className="bg-slate-100 text-slate-600 px-5 py-3 rounded-2xl flex items-center justify-center space-x-2 hover:bg-slate-200 transition flex-1 md:flex-none">
              <LayoutGrid size={20} /> <span className="font-black text-xs uppercase tracking-widest">DETAIL VIEW</span>
            </button>
            <button onClick={() => setShowAddModal(true)} className="bg-blue-600 text-white px-5 py-3 rounded-2xl flex items-center justify-center space-x-2 hover:bg-blue-700 transition shadow-xl shadow-blue-200 flex-1 md:flex-none">
              <Plus size={20} /> <span className="font-black text-xs uppercase tracking-widest">PROYEK BARU</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
          <div className="flex p-1 bg-slate-100 rounded-2xl w-full md:w-auto">
            {(['priority', 'deadline', 'search'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 md:flex-none px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === tab
                  ? 'bg-white text-blue-600 shadow-md transform scale-105'
                  : 'text-slate-400 hover:text-slate-600'
                  }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Search Input Area */}
          {activeTab === 'search' && (
            <div className="relative w-full md:w-96 animate-in slide-in-from-left duration-300">
              <input
                className="w-full p-3 pl-10 bg-white border border-slate-200 rounded-2xl text-xs font-bold outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition"
                placeholder="Ketik minimal 3 huruf..."
                value={searchQuery}
                onChange={handleSearchChange}
              />
              <div className="absolute left-3 top-3 text-slate-400">
                <EyeOff size={16} className="rotate-180" />
              </div>

              {/* Autocomplete Dropdown */}
              {searchResults.length > 0 && searchQuery.length >= 3 && (
                <div className="absolute top-12 left-0 right-0 bg-white border border-slate-100 shadow-2xl rounded-2xl p-2 z-50 max-h-60 overflow-y-auto custom-scrollbar">
                  {searchResults.map(p => (
                    <div
                      key={p.id}
                      onClick={() => { setSearchQuery(p.title); setSearchResults([]); }}
                      className="p-3 hover:bg-blue-50 rounded-xl cursor-pointer"
                    >
                      <p className="text-xs font-black text-slate-800">{p.title}</p>
                      <p className="text-[9px] text-slate-400 uppercase tracking-widest mt-1">Status: {p.status}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex overflow-x-auto pb-6 gap-4 md:gap-6 snap-x custom-scrollbar min-h-[70vh]">
        {KANBAN_COLUMNS.map(col => (
          <div
            key={col.id}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => onDrop(e, col.id)}
            className="flex-shrink-0 w-[85vw] md:w-80 snap-center md:snap-start bg-slate-100/50 rounded-[2.5rem] p-4 md:p-5 flex flex-col space-y-4 md:space-y-5 border-2 border-transparent hover:border-blue-100 transition-colors"
          >
            <div className={`px-5 py-3 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] ${col.color} flex justify-between items-center shadow-sm`}>
              <span>{col.label}</span>
              <span className="bg-white/40 px-2.5 py-1 rounded-lg">
                {finalProjects.filter(p => p.status === col.id).length}
              </span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 pr-1 custom-scrollbar min-h-[400px]">
              {finalProjects
                .filter(p => p.status === col.id)
                .map(project => (
                  <div
                    key={project.id}
                    draggable
                    onDragStart={(e) => onDragStart(e, project.id)}
                    className={`bg-white p-6 rounded-[2rem] shadow-sm border border-slate-200 cursor-grab active:cursor-grabbing hover:border-blue-500 hover:shadow-xl transition-all group relative overflow-hidden ${project.collaborators?.includes(currentUser.id) ? 'ring-2 ring-blue-500 ring-offset-2' : ''}`}
                  >
                    {/* Action Buttons (Top Right) */}
                    <div className="absolute top-4 right-4 flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => { e.stopPropagation(); setHistoryProject(project); }}
                        className="p-2 rounded-xl text-slate-400 hover:bg-blue-50 hover:text-blue-600 transition"
                        title="Lihat Riwayat & Log Aktivitas"
                      >
                        <HistoryIcon size={16} />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setSelectedProject(project); }}
                        className="p-2 rounded-xl text-slate-400 hover:bg-amber-50 hover:text-amber-600 transition"
                        title="Edit & Detail Proyek"
                      >
                        <Edit2 size={16} />
                      </button>
                      {/* DELETE PROJECT BUTTON for ALL ROLES */}
                      {/* DELETE PROJECT BUTTON - MANAGEMENT LEVEL */}
                      {[UserRole.OWNER, UserRole.MANAGER, UserRole.FINANCE].includes(currentUser.role) && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (window.confirm(`Apakah Anda yakin ingin menghapus proyek "${project.title}"? Tindakan ini tidak dapat dibatalkan.`)) {
                              deleteProject(project.id);
                              toast.success('Proyek berhasil dihapus');
                            }
                          }}
                          className="p-2 rounded-xl text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition"
                          title="Hapus Proyek"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /></svg>
                        </button>
                      )}
                    </div>

                    <div className="flex justify-between items-start mb-4 pr-16 bg-white">
                      <div className="flex flex-col gap-2 items-start w-full">
                        {(project.collaborators.includes(currentUser.id) || project.tasks.some(t => t.assignedTo.includes(currentUser.id))) && (
                          <div className="flex gap-2 flex-wrap mb-1">
                            {project.collaborators.includes(currentUser.id) && (
                              <span className="bg-blue-600 text-white text-[8px] font-black px-2 py-1 rounded shadow-sm flex items-center gap-1">
                                <UserCheck size={10} /> TEAM
                              </span>
                            )}
                            {(() => {
                              const myTasks = project.tasks.filter(t => t.assignedTo.includes(currentUser.id)).length;
                              if (myTasks > 0) return (
                                <span className="bg-amber-500 text-white text-[8px] font-black px-2 py-1 rounded shadow-sm flex items-center gap-1">
                                  <CheckCircle2 size={10} /> {myTasks} TUGAS
                                </span>
                              )
                            })()}
                          </div>
                        )}
                        <div className="flex justify-between w-full items-center">
                          <span className={`text-[9px] font-black uppercase px-2.5 py-1 rounded-lg ${project.priority === 'High' ? 'bg-rose-500 text-white shadow-lg shadow-rose-100' :
                            project.priority === 'Medium' ? 'bg-amber-500 text-white shadow-lg shadow-amber-100' : 'bg-blue-500 text-white shadow-lg shadow-blue-100'
                            }`}>{project.priority}</span>
                          {!!project.isManagementOnly && <EyeOff size={12} className="text-slate-300" />}
                        </div>
                      </div>
                    </div>
                    <h4 className="font-black text-slate-800 text-sm mb-2 group-hover:text-blue-600 transition leading-tight">{project.title}</h4>
                    <p className="text-[10px] font-bold text-slate-400 line-clamp-2 leading-relaxed mb-4">{project.description}</p>
                    <div className="flex justify-between items-center pt-4 border-t border-slate-50">
                      <div className="flex -space-x-2">
                        {project.collaborators.slice(0, 3).map(id => {
                          const u = users.find(user => user.id === id);
                          return (
                            <div key={id} className="w-8 h-8 rounded-full bg-blue-50 border-2 border-white flex items-center justify-center overflow-hidden" title={u?.name}>
                              {u?.avatarUrl ? (
                                <img src={u.avatarUrl} alt={u.name} className="w-full h-full object-cover" />
                              ) : (
                                <span className="text-[10px] font-black text-blue-600">{u?.name.charAt(0).toUpperCase()}</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      <div className={`text-[9px] font-black px-2 py-1 rounded-lg flex items-center ${new Date(project.deadline) < new Date() && project.status !== KanbanStatus.DONE ? 'bg-rose-100 text-rose-600 animate-pulse' : 'bg-slate-50 text-slate-400'
                        }`}>
                        <Clock size={10} className="mr-1" />
                        {new Date(project.deadline) < new Date() && project.status !== KanbanStatus.DONE ? 'OVERDUE' : new Date(project.deadline).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        ))}
      </div>

      {(showAddModal || editingProject) && (
        <ProjectModal users={users} currentUser={currentUser} initialData={editingProject}
          onClose={() => { setShowAddModal(false); setEditingProject(null); }}
          onSave={handleSaveProject} toast={toast} />
      )}

      {selectedProject && (
        <TaskDetailModal project={selectedProject} users={users} currentUser={currentUser} settings={settings}
          onClose={() => setSelectedProject(null)} onEditProject={() => { setEditingProject(selectedProject); setSelectedProject(null); }}
          onUpdate={(p) => { onUpdateProject(p); setSelectedProject(p); }} // Sync local state
          patchProject={patchProject} // Inject atomic updater
          onMoveStatus={handleMoveStatus} toast={toast} />
      )}

      {historyProject && (
        <ProjectLogModal
          project={historyProject}
          logs={logs}
          fetchLogs={fetchLogs}
          onClose={() => setHistoryProject(null)}
        />
      )}
    </div>
  );
};

// --- MODAL COMPONENTS ---

interface ProjectLogModalProps {
  project: Project;
  logs: SystemLog[];
  fetchLogs?: (target?: string) => Promise<void>;
  onClose: () => void;
}

const ProjectLogModal: React.FC<ProjectLogModalProps> = ({ project, logs, fetchLogs, onClose }) => {
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (fetchLogs) {
      setLoading(true);
      fetchLogs(project.id).finally(() => setLoading(false));
    }
  }, [project.id]);

  // Filter logs only for this project
  const projectLogs = useMemo(() => {
    return logs.filter(log => log.target === project.id).sort((a, b) => b.timestamp - a.timestamp);
  }, [logs, project.id]);

  const translateAction = (type: string) => {
    switch (type) {
      case SystemActionType.PROJECT_CREATE: return '✨ Proyek dibuat';
      case SystemActionType.PROJECT_UPDATE: return '📝 Detail diperbarui';
      case SystemActionType.PROJECT_MOVE_STATUS: return '🔄 Status berubah';
      case SystemActionType.PROJECT_TASK_COMPLETE: return '✅ Tugas selesai';
      case SystemActionType.PROJECT_COMMENT: return '💬 Komentar baru';
      default: return type.replace(/_/g, ' ');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-[2rem] w-full max-w-md overflow-hidden flex flex-col shadow-2xl">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <div>
            <h4 className="font-black text-slate-800 text-lg flex items-center gap-2">
              <HistoryIcon size={18} className="text-blue-500" />
              RIWAYAT PROYEK
            </h4>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">{project.title}</p>
          </div>
          <button onClick={onClose} className="p-2 bg-white rounded-xl hover:bg-rose-50 text-slate-400 hover:text-rose-500 transition shadow-sm"><X size={18} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-0 custom-scrollbar max-h-[60vh]">
          {loading ? (
            <div className="p-10 text-center space-y-3">
              <div className="w-8 h-8 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin mx-auto"></div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Menarik Data Riwayat...</p>
            </div>
          ) : projectLogs.length > 0 ? (
            <div className="divide-y divide-slate-50">
              {projectLogs.map(log => (
                <div key={log.id} className="p-5 hover:bg-slate-50 transition-colors flex gap-4">
                  <div className="flex flex-col items-center gap-1">
                    <Circle size={10} className="text-blue-300 fill-blue-300" />
                    <div className="w-0.5 h-full bg-slate-100 rounded-full"></div>
                  </div>
                  <div className="flex-1 space-y-1 pb-2">
                    <div className="flex justify-between items-start">
                      <span className="text-[10px] font-black uppercase text-blue-600 bg-blue-50 px-2 py-0.5 rounded-lg tracking-wider">
                        {translateAction(log.actionType)}
                      </span>
                      <span className="text-[9px] text-slate-300 font-bold">{new Date(log.timestamp).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <p className="text-xs font-medium text-slate-600 leading-relaxed">{log.details}</p>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Oleh: {log.actorName}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-10 text-center text-slate-400 flex flex-col items-center gap-2">
              <HistoryIcon size={32} className="opacity-20" />
              <p className="text-xs font-bold">Belum ada riwayat aktivitas tercatat.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}



interface TaskDetailModalProps {
  project: Project;
  users: User[];
  currentUser: User;
  settings: AppSettings;
  onClose: () => void;
  onUpdate: (p: Project) => void;
  patchProject: (id: string, action: string, data: any) => Promise<any>;
  onMoveStatus: (p: Project, s: KanbanStatus) => void;
  onEditProject: () => void;
  toast: ReturnType<typeof useToast>;
}

const TaskDetailModal: React.FC<TaskDetailModalProps> = ({ project, users, currentUser, settings, onClose, onUpdate, patchProject, onMoveStatus, onEditProject, toast }) => {
  const [activeTaskIndex, setActiveTaskIndex] = useState<number | null>(null);
  const [taskComments, setTaskComments] = useState<{ [taskId: string]: string }>({});
  const [proofForm, setProofForm] = useState({ description: '', link: '' });
  const [showHistory, setShowHistory] = useState<string | null>(null);
  const [showEditTask, setShowEditTask] = useState<string | null>(null);

  // Loading States Map: taskId -> actionType ('comment', 'finish', 'reopen', 'title', 'pic', 'status')
  const [loadingAction, setLoadingAction] = useState<{ [key: string]: string }>({});
  const [projectCommentLoading, setProjectCommentLoading] = useState(false);

  const setLoading = (id: string, action: string | null) => {
    setLoadingAction(prev => {
      const next = { ...prev };
      if (action) next[id] = action;
      else delete next[id];
      return next;
    });
  };

  const isLoading = (id: string, action?: string) => {
    if (!action) return !!loadingAction[id];
    return loadingAction[id] === action;
  };

  const officeLabel = settings.companyProfile?.name ? settings.companyProfile.name.toUpperCase() : currentUser.tenantId.toUpperCase() + " ERP";

  const handleAddComment = async (idx: number) => {
    const taskId = project.tasks[idx].id;
    if (isLoading(taskId)) return;

    const text = taskComments[taskId];
    if (!text) return;

    setLoading(taskId, 'comment');
    try {
      const currentTask = project.tasks[idx];
      const newComment = { id: Date.now().toString(), userId: currentUser.id, text, createdAt: Date.now() };
      const newHistory = { id: Math.random().toString(36).substr(2, 9), userId: currentUser.id, userName: currentUser.name, action: `Komentar: ${text}`, timestamp: Date.now() };

      const updatedTask = {
        ...currentTask,
        comments: [...currentTask.comments, newComment],
        history: [...currentTask.history, newHistory]
      };

      // Optimistic update via store action
      const updatedProject = await patchProject(project.id, 'UPDATE_TASK', { taskId, task: updatedTask });
      setTaskComments(prev => ({ ...prev, [taskId]: '' }));
      if (onUpdate) onUpdate(updatedProject);
      toast.success("Komentar terkirim");

      // Telegram (Fire and forget, don't await blocking UI)
      const targetChatId = project.isManagementOnly ? settings.telegramOwnerChatId : settings.telegramGroupId;
      let finalChatId = targetChatId;
      if (finalChatId) {
        if (finalChatId.includes('_')) {
          const parts = finalChatId.split('_');
          if (!parts[0].startsWith('-')) finalChatId = `-100${parts[0]}_${parts[1]}`;
        } else if (!finalChatId.startsWith('-') && /^\d+$/.test(finalChatId)) {
          finalChatId = `-100${finalChatId}`;
        }
      }
      const msg = `🏢 <b>${escapeHTML(officeLabel)}</b>\n` +
        `💬 <b>KOMENTAR TUGAS</b>\n\n` +
        `📌 PROYEK: <b>${escapeHTML(project.title)}</b>\n` +
        `✅ TUGAS: <b>${escapeHTML(project.tasks[idx].title)}</b>\n\n` +
        `<blockquote>"${escapeHTML(text)}"</blockquote>\n` +
        `👤 OLEH: <b>${escapeHTML(currentUser.name)}</b>`;
      sendTelegramNotification(settings.telegramBotToken, finalChatId, msg);
    } catch (e) {
      toast.error("Gagal mengirim komentar");
    } finally {
      setLoading(taskId, null);
    }
  };

  const finishTask = async (idx: number) => {
    const currentTask = project.tasks[idx];
    if (isLoading(currentTask.id)) return;

    if (!proofForm.description) {
      toast.warning("Harap isi deskripsi penyelesaian tugas.");
      return;
    }

    setLoading(currentTask.id, 'finish');
    try {
      const newHistory = { id: Math.random().toString(36).substr(2, 9), userId: currentUser.id, userName: currentUser.name, action: 'Tugas Selesai', timestamp: Date.now() };

      const updatedTask = {
        ...currentTask,
        isCompleted: true,
        completionProof: { ...proofForm },
        history: [...currentTask.history, newHistory]
      };

      const updatedProject = await patchProject(project.id, 'UPDATE_TASK', { taskId: currentTask.id, task: updatedTask });
      if (onUpdate) onUpdate(updatedProject);
      toast.success(`Tugas "${updatedTask.title}" berhasil diselesaikan!`);

      // Telegram
      const collaborators = users.filter(u => updatedTask.assignedTo.includes(u.id));
      const tagString = collaborators.map(u => u.telegramUsername || u.name).join(', ');

      const msg = `🏢 <b>${escapeHTML(officeLabel)}</b>\n` +
        `✅ <b>TUGAS DISELESAIKAN</b>\n\n` +
        `📌 PROYEK: <b>${escapeHTML(project.title)}</b>\n` +
        `📝 TUGAS: <b>${escapeHTML(updatedTask.title)}</b>\n` +
        `📖 PENYELESAIAN: <i>${escapeHTML(proofForm.description)}</i>\n` +
        (proofForm.link ? `🔗 LINK: <a href="${escapeHTML(proofForm.link)}">Klik di sini</a>\n` : '') +
        `\n👤 OLEH: <b>${escapeHTML(currentUser.name)}</b>\n` +
        `👥 TEAM PIC: ${escapeHTML(tagString)}`;

      const targetChatId = project.isManagementOnly ? settings.telegramOwnerChatId : settings.telegramGroupId;
      sendTelegramNotification(settings.telegramBotToken, targetChatId, msg);

      setActiveTaskIndex(null);
      setProofForm({ description: '', link: '' });
    } catch (err: any) {
      console.error('Error finishing task:', err);
      toast.error(err?.message || 'Gagal menyelesaikan tugas.');
    } finally {
      setLoading(currentTask.id, null);
    }
  };

  const reopenTask = async (idx: number) => {
    const currentTask = project.tasks[idx];
    if (isLoading(currentTask.id)) return;

    if (!window.confirm("Apakah Anda yakin ingin membatalkan status selesai tugas ini (Revisi)?")) return;

    setLoading(currentTask.id, 'reopen');
    try {
      const newHistory = { id: Math.random().toString(36).substr(2, 9), userId: currentUser.id, userName: currentUser.name, action: 'Status dibatalkan (Revisi)', timestamp: Date.now() };

      const updatedTask = {
        ...currentTask,
        isCompleted: false,
        history: [...currentTask.history, newHistory]
      };

      const updatedProject = await patchProject(project.id, 'UPDATE_TASK', { taskId: currentTask.id, task: updatedTask });
      if (onUpdate) onUpdate(updatedProject);
      toast.success('Status tugas dikembalikan ke proses.');

      // Telegram
      const targetChatId = project.isManagementOnly ? settings.telegramOwnerChatId : settings.telegramGroupId;
      let finalChatId = targetChatId;
      if (finalChatId) {
        if (finalChatId.includes('_')) {
          const parts = finalChatId.split('_');
          if (!parts[0].startsWith('-')) finalChatId = `-100${parts[0]}_${parts[1]}`;
        } else if (!finalChatId.startsWith('-') && /^\d+$/.test(finalChatId)) {
          finalChatId = `-100${finalChatId}`;
        }
      }
      const msg = `⚠️ <b>Tugas Dibuka Kembali (Revisi)</b>\n\n` +
        `Proyek: <b>${escapeHTML(project.title)}</b>\n` +
        `Tugas: <b>${escapeHTML(updatedTask.title)}</b>\n` +
        `Oleh: <b>${escapeHTML(currentUser.name)}</b>`;
      sendTelegramNotification(settings.telegramBotToken, finalChatId, msg);

    } catch (e) {
      toast.error("Gagal membuka kembali tugas");
    } finally {
      setLoading(currentTask.id, null);
    }
  };

  const handleTitleEdit = async (e: React.KeyboardEvent<HTMLInputElement>, idx: number) => {
    const currentTask = project.tasks[idx];
    if (isLoading(currentTask.id)) {
      if (e.key === 'Enter') e.preventDefault(); // Block enter if loading
      return;
    }

    if (e.key === 'Enter') {
      const val = (e.target as HTMLInputElement).value;
      if (val && val !== currentTask.title) {
        setLoading(currentTask.id, 'title');
        try {
          const newHistory = { id: Math.random().toString(36).substr(2, 9), userId: currentUser.id, userName: currentUser.name, action: `Edit Judul: "${currentTask.title}" -> "${val}"`, timestamp: Date.now() };
          const updatedTask = { ...currentTask, title: val, history: [...currentTask.history, newHistory] };

          const updatedProject = await patchProject(project.id, 'UPDATE_TASK', { taskId: currentTask.id, task: updatedTask });
          if (onUpdate) onUpdate(updatedProject);
          toast.success('Judul tugas diperbarui');
          setShowEditTask(null);

          // Telegram
          const targetChatId = project.isManagementOnly ? settings.telegramOwnerChatId : settings.telegramGroupId;
          let finalChatId = targetChatId;
          if (finalChatId) {
            if (finalChatId.includes('_')) {
              const parts = finalChatId.split('_');
              if (!parts[0].startsWith('-')) finalChatId = `-100${parts[0]}_${parts[1]}`;
            } else if (!finalChatId.startsWith('-') && /^\d+$/.test(finalChatId)) {
              finalChatId = `-100${finalChatId}`;
            }
          }
          const msg = `🛠️ <b>JUDUL TUGAS DIUBAH</b>\n\n` +
            `📌 PROYEK: <b>${escapeHTML(project.title)}</b>\n` +
            `❌ LAMA: <s>${escapeHTML(currentTask.title)}</s>\n` +
            `✅ BARU: <b>${escapeHTML(val)}</b>\n` +
            `👤 OLEH: <b>${escapeHTML(currentUser.name)}</b>`;
          sendTelegramNotification(settings.telegramBotToken, finalChatId, msg);

        } catch (e) { toast.error("Gagal update judul"); }
        finally { setLoading(currentTask.id, null); }
      } else {
        setShowEditTask(null);
      }
    } else if (e.key === 'Escape') {
      setShowEditTask(null);
    }
  };

  const togglePIC = async (u: User, idx: number) => {
    const currentTask = project.tasks[idx];
    if (isLoading(currentTask.id)) return;

    setLoading(currentTask.id, 'pic');
    try {
      const currentPICS = currentTask.assignedTo;
      let actionType = '';
      let newPICS = [];

      if (currentPICS.includes(u.id)) {
        newPICS = currentPICS.filter(id => id !== u.id);
        actionType = 'removed';
      } else {
        newPICS = [...currentPICS, u.id];
        actionType = 'added';
      }

      const logAction = actionType === 'removed' ? `Hapus PIC: ${u.name}` : `Tambah PIC: ${u.name}`;
      const newHistory = { id: Math.random().toString(36).substr(2, 9), userId: currentUser.id, userName: currentUser.name, action: logAction, timestamp: Date.now() };

      const updatedTask = { ...currentTask, assignedTo: newPICS, history: [...currentTask.history, newHistory] };

      const updatedProject = await patchProject(project.id, 'UPDATE_TASK', { taskId: currentTask.id, task: updatedTask });
      if (onUpdate) onUpdate(updatedProject);

      // Notify Telegram
      const targetChatId = project.isManagementOnly ? settings.telegramOwnerChatId : settings.telegramGroupId;
      let finalChatId = targetChatId;
      if (finalChatId) {
        if (finalChatId.includes('_')) {
          const parts = finalChatId.split('_');
          if (!parts[0].startsWith('-')) finalChatId = `-100${parts[0]}_${parts[1]}`;
        } else if (!finalChatId.startsWith('-') && /^\d+$/.test(finalChatId)) {
          finalChatId = `-100${finalChatId}`;
        }
      }
      const msg = `👥 <b>UPDATE TIM TUGAS</b>\n\n` +
        `📌 PROYEK: <b>${escapeHTML(project.title)}</b>\n` +
        `📝 TUGAS: <b>${escapeHTML(currentTask.title)}</b>\n` +
        `⚡ ACTION: ${actionType === 'added' ? '✅ Menambahkan' : '❌ Menghapus'} <b>${escapeHTML(u.name)}</b>\n` +
        `\n👤 OLEH: <b>${escapeHTML(currentUser.name)}</b>`;
      sendTelegramNotification(settings.telegramBotToken, finalChatId, msg);

    } catch (e) { toast.error("Gagal update PIC"); }
    finally { setLoading(currentTask.id, null); }
  };

  const handleProjectComment = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    if (projectCommentLoading) return;

    const el = e.target as HTMLInputElement;
    const text = el.value;
    if (!text) return;

    setProjectCommentLoading(true);
    try {
      const newComment = { id: Date.now().toString(), userId: currentUser.id, text, createdAt: Date.now() };
      const updatedComments = [...(project.comments || []), newComment];

      if (onUpdate) onUpdate({ ...project, comments: updatedComments });

      el.value = '';
    } finally {
      setProjectCommentLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/90 backdrop-blur-md p-2 md:p-4 overflow-y-auto">
      <div className="bg-white rounded-[2rem] md:rounded-[3rem] w-full max-w-5xl md:max-h-[90vh] min-h-[50vh] overflow-hidden flex flex-col shadow-2xl border border-white/20 animate-in fade-in zoom-in duration-500 my-auto">
        <div className="p-6 md:p-8 border-b bg-slate-50/50 flex flex-col md:flex-row justify-between items-start gap-4 md:gap-6 shrink-0">
          <div className="space-y-3 w-full">
            <div className="flex flex-wrap items-center gap-3 justify-between md:justify-start">
              <h3 className="text-2xl md:text-3xl font-black text-slate-800 leading-none truncate max-w-[200px] md:max-w-md">{project.title}</h3>
              <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest shrink-0 ${project.priority === 'High' ? 'bg-rose-500 text-white shadow-lg' : 'bg-blue-500 text-white'}`}>{project.priority}</span>
            </div>
            <p className="text-slate-500 text-sm max-w-2xl leading-relaxed line-clamp-2 md:line-clamp-none">{project.description}</p>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-[10px] bg-slate-100 px-2 py-1 rounded text-slate-500 uppercase font-bold tracking-widest">{project.comments?.length || 0} KOMENTAR PROYEK</span>
            </div>
          </div>
          <div className="flex gap-3 w-full md:w-auto shrink-0">
            <button onClick={onEditProject} className="flex-1 md:flex-none p-4 bg-white border border-slate-200 rounded-2xl text-xs font-black text-slate-600 hover:border-blue-500 hover:text-blue-600 transition shadow-sm flex items-center justify-center gap-2">
              <Edit2 size={16} /> <span>EDIT</span>
            </button>
            <button onClick={onClose} className="p-4 bg-slate-200 rounded-2xl hover:bg-rose-500 hover:text-white transition shadow-sm"><Plus size={24} className="rotate-45" /></button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto flex flex-col md:flex-row custom-scrollbar">
          <div className="flex-1 p-6 md:p-8 space-y-10">
            <section className="space-y-6">
              <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.3em]">PROGRESS TUGAS</h4>
              <div className="space-y-4">
                {project.tasks.map((task: Task, idx: number) => (
                  <div key={task.id} className={`p-8 rounded-[2rem] border-2 transition-all ${task.isCompleted ? 'bg-emerald-50/50 border-emerald-100 opacity-80' : 'bg-white border-slate-100 shadow-sm hover:shadow-xl'}`}>
                    <div className="flex justify-between items-start gap-4 mb-4">
                      {/* Task Content or Edit Form */}
                      {activeTaskIndex === idx && !task.isCompleted && showEditTask === task.id ? (
                        <div className="flex-1 space-y-3">
                          <input
                            className="w-full p-3 border-2 border-blue-500 rounded-xl text-sm font-bold outline-none"
                            autoFocus
                            defaultValue={task.title}
                            disabled={isLoading(task.id)}
                            onKeyDown={(e) => handleTitleEdit(e, idx)}
                          />
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-slate-400 uppercase">EDIT PIC:</span>
                            {isLoading(task.id, 'title') && <span className="text-[9px] text-blue-500 font-bold animate-pulse">Menyimpan...</span>}
                            <div className="flex flex-wrap gap-2">
                              {users.map(u => (
                                <button
                                  key={u.id}
                                  onClick={() => togglePIC(u, idx)}
                                  disabled={isLoading(task.id)}
                                  className={`px-3 py-1 rounded-full text-[9px] font-black uppercase transition border ${task.assignedTo.includes(u.id)
                                    ? 'bg-blue-600 text-white border-blue-600'
                                    : 'bg-white text-slate-400 border-slate-200 hover:border-blue-400'
                                    } ${isLoading(task.id) ? 'opacity-50 cursor-not-allowed' : ''}`}
                                >
                                  {u.name}
                                </button>
                              ))}
                            </div>
                            <button onClick={() => !isLoading(task.id) && setShowEditTask(null)} disabled={isLoading(task.id)} className="ml-auto text-[9px] font-black text-blue-600 underline disabled:opacity-50">SELESAI</button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center space-x-4 flex-1">
                          <button onClick={() => {
                            if (isLoading(task.id)) return;
                            if (!task.isCompleted) {
                              setActiveTaskIndex(idx);
                              setProofForm({ description: '', link: '' });
                            } else {
                              reopenTask(idx);
                            }
                          }} className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-colors ${task.isCompleted ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-300 text-transparent hover:border-blue-400'} ${isLoading(task.id, 'reopen') ? 'animate-pulse opacity-50' : ''}`}>
                            {isLoading(task.id, 'reopen') ? <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" /> : <CheckCircle size={16} fill="currentColor" />}
                          </button>
                          <div className="flex-1 cursor-pointer" onClick={() => !task.isCompleted && !isLoading(task.id) && setShowEditTask(task.id)}>
                            <h5 className={`font-bold text-sm ${task.isCompleted ? 'text-slate-400 line-through' : 'text-slate-800'}`}>{task.title}</h5>
                            {/* PIC Avatars */}
                            <div className="flex -space-x-1 mt-2">
                              {task.assignedTo.map(uid => {
                                const u = users.find(x => x.id === uid);
                                if (!u) return null;
                                return (
                                  <div key={uid} className="w-5 h-5 rounded-full border border-white bg-slate-200 flex items-center justify-center overflow-hidden" title={u.name}>
                                    {u.avatarUrl ? <img src={u.avatarUrl} className="w-full h-full object-cover" /> : <span className="text-[8px] font-black">{u.name[0]}</span>}
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex space-x-1">
                      {!task.isCompleted && (
                        <button
                          onClick={() => { if (!isLoading(task.id)) { setActiveTaskIndex(idx); setShowEditTask(showEditTask === task.id ? null : task.id); } }}
                          disabled={isLoading(task.id)}
                          className={`p-2 rounded-xl transition ${showEditTask === task.id ? 'bg-blue-50 text-blue-600' : 'text-slate-300 hover:bg-slate-50 hover:text-blue-500'} ${isLoading(task.id) ? 'opacity-50 cursor-not-allowed' : ''}`}
                          title="Edit Judul & PIC Tugas"
                        >
                          <Edit2 size={16} />
                        </button>
                      )}
                      <button onClick={() => setShowHistory(showHistory === task.id ? null : task.id)} className="p-2 text-slate-300 hover:text-blue-600 transition" title="Riwayat Tugas"><HistoryIcon size={18} /></button>
                    </div>

                    {showHistory === task.id && (
                      <div className="mb-6 bg-slate-50 p-6 rounded-2xl space-y-3 border border-slate-100 animate-in slide-in-from-top-2">
                        <h5 className="text-[9px] font-black text-slate-400 uppercase tracking-widest">LOG AKTIVITAS</h5>
                        {task.history.slice().reverse().map(h => (
                          <div key={h.id} className="text-[10px] flex flex-col md:flex-row md:justify-between border-l-2 border-blue-300 pl-4 py-1">
                            <span className="text-slate-700 font-bold uppercase tracking-tight">{h.userName}: <span className="font-normal italic text-slate-500">"{h.action}"</span></span>
                            <span className="text-slate-300 font-black">{new Date(h.timestamp).toLocaleString('id-ID')}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {task.isCompleted && task.completionProof && (
                      <div className="mb-6 bg-white p-6 rounded-[1.5rem] border border-emerald-100 shadow-sm flex items-center justify-between">
                        <p className="text-slate-600 italic text-xs leading-relaxed max-w-lg">"{task.completionProof.description}"</p>
                        {task.completionProof.link && (
                          <a href={task.completionProof.link} target="_blank" className="p-3 bg-blue-50 text-blue-600 rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-blue-600 hover:text-white transition">LINK BUKTI</a>
                        )}
                      </div>
                    )}

                    <div className="space-y-4">
                      {task.comments.map(c => (
                        <div key={c.id} className="bg-slate-50/50 p-5 rounded-2xl border border-slate-100">
                          <div className="flex justify-between mb-1">
                            <span className="text-[9px] font-black text-slate-800 uppercase tracking-[0.2em]">{users.find(u => u.id === c.userId)?.name}</span>
                            <span className="text-[8px] font-bold text-slate-300 uppercase tracking-widest">{new Date(c.createdAt).toLocaleTimeString()}</span>
                          </div>
                          <p className="text-xs text-slate-600 font-medium leading-relaxed">{c.text}</p>
                        </div>
                      ))}
                      <div className="flex gap-2 bg-slate-100 p-2 rounded-2xl">
                        <input
                          className="flex-1 bg-white p-3 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Instruksi perbaikan..."
                          value={taskComments[task.id] || ''}
                          disabled={isLoading(task.id, 'comment')}
                          onChange={e => setTaskComments(prev => ({ ...prev, [task.id]: e.target.value }))}
                        />
                        <button
                          onClick={() => handleAddComment(idx)}
                          disabled={isLoading(task.id, 'comment')}
                          className={`bg-slate-900 text-white px-5 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-blue-600 transition ${isLoading(task.id, 'comment') ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          {isLoading(task.id, 'comment') ? 'SENDING...' : 'SEND'}
                        </button>
                      </div>
                    </div>

                    {activeTaskIndex === idx && !task.isCompleted && !showEditTask && (
                      <div className="mt-8 bg-blue-600 p-8 rounded-[2.5rem] text-white shadow-2xl animate-in slide-in-from-top duration-300">
                        <h5 className="text-[10px] font-black uppercase tracking-[0.3em] mb-6">SUBMIT PENYELESAIAN</h5>
                        <textarea
                          className="w-full p-5 bg-white/10 border-2 border-white/20 rounded-[1.5rem] outline-none focus:bg-white focus:text-slate-900 transition mb-4 text-xs font-bold disabled:opacity-50"
                          placeholder="Apa yang Anda kerjakan?"
                          value={proofForm.description}
                          onChange={e => setProofForm({ ...proofForm, description: e.target.value })}
                          disabled={isLoading(task.id, 'finish')}
                        />
                        <input
                          className="w-full p-4 bg-white/10 border-2 border-white/20 rounded-xl outline-none focus:bg-white focus:text-slate-900 transition mb-6 text-xs font-bold disabled:opacity-50"
                          placeholder="Link Lampiran (Gdrive/File)"
                          value={proofForm.link}
                          onChange={e => setProofForm({ ...proofForm, link: e.target.value })}
                          disabled={isLoading(task.id, 'finish')}
                        />
                        <div className="flex justify-end gap-3">
                          <button
                            onClick={() => { setActiveTaskIndex(null); setProofForm({ description: '', link: '' }); }}
                            className="px-6 py-3 font-black text-[10px] uppercase tracking-widest opacity-60 hover:opacity-100"
                            disabled={isLoading(task.id, 'finish')}
                          >
                            BATAL
                          </button>
                          <button
                            onClick={() => finishTask(idx)}
                            className={`bg-white text-blue-600 px-10 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl flex items-center justify-center gap-2 ${isLoading(task.id, 'finish') ? 'opacity-75 cursor-not-allowed' : ''}`}
                            disabled={isLoading(task.id, 'finish')}
                          >
                            {isLoading(task.id, 'finish') ? (
                              <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                            ) : 'SIMPAN BUKTI'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section >
          </div >

          <div className="w-full md:w-96 bg-slate-50 p-8 border-t md:border-t-0 md:border-l flex flex-col space-y-10">
            <div className="space-y-6">
              <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">UPDATE STATUS PROYEK</h5>
              <div className="space-y-2">
                {KANBAN_COLUMNS.map(col => (
                  <button key={col.id} onClick={() => onMoveStatus(project, col.id)} className={`w-full p-5 rounded-2xl text-[10px] font-black text-left flex justify-between items-center transition-all ${project.status === col.id ? col.color + ' shadow-xl scale-[1.05] border-2 border-current' : 'bg-white border border-slate-100 text-slate-400 hover:shadow-lg'}`}>
                    <span>PINDAH KE {col.label.toUpperCase()}</span>
                    {project.status === col.id && <CheckCircle size={18} />}
                  </button>
                ))}
              </div>
            </div>


            <div className="space-y-6">
              <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">DISKUSI PROYEK</h5>
              <div className="bg-white rounded-2xl border border-slate-100 p-4 space-y-4 max-h-80 overflow-y-auto custom-scrollbar">
                {project.comments?.map((c: any) => (
                  <div key={c.id} className="space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="text-[9px] font-black uppercase text-slate-800">{users.find(u => u.id === c.userId)?.name}</span>
                      <span className="text-[8px] text-slate-400">{new Date(c.createdAt).toLocaleDateString()}</span>
                    </div>
                    <p className="text-[10px] text-slate-600 leading-relaxed bg-slate-50 p-2 rounded-lg">{c.text}</p>
                  </div>
                ))}
                {(!project.comments || project.comments.length === 0) && <p className="text-[9px] text-slate-300 text-center italic">Belum ada diskusi.</p>}
              </div>
              <div className="flex gap-2">
                <input className="flex-1 bg-white border border-slate-200 p-3 rounded-xl text-[10px] outline-none focus:border-blue-500" placeholder="Ketik pesan..."
                  onKeyDown={handleProjectComment}
                  disabled={projectCommentLoading}
                />
              </div>
            </div>
          </div>
        </div >
      </div >
    </div >
  );
};

export default Kanban;
