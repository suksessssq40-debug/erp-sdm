import React, { useState, useEffect } from 'react';
import { useAppStore } from '../context/StoreContext';
import { 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Briefcase, 
  Calendar, 
  Timer, 
  ArrowRight,
  FileText,
  MessageSquare,
  AlertTriangle
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Project, RequestStatus } from '../types';

export const StaffDashboard = () => {
  const { currentUser, attendance, projects, dailyReports, requests } = useAppStore();
  const router = useRouter();
  
  // 1. Time & Attendance Logic (Enhanced for Cross-Day Shifts)
  const todayStr = new Date().toDateString(); 
  
  // Find Active Session (Logic mirrored from Attendance.tsx)
  const todayAttendance = React.useMemo(() => {
    const myLogs = attendance.filter(a => a.userId === currentUser?.id);
    // Sort desc by time
    myLogs.sort((a, b) => {
        const tA = a.createdAt ? Number(a.createdAt) : new Date(a.date!).getTime();
        const tB = b.createdAt ? Number(b.createdAt) : new Date(b.date!).getTime();
        return tB - tA;
    });

    const latest = myLogs[0];
    if (!latest) return undefined;

    // A. If still Open (active session), check validity usually < 24h
    if (!latest.timeOut) {
        let tStart = latest.createdAt ? Number(latest.createdAt) : 0;
        // Fallback info if createdAt missing
        if (!tStart && latest.date) { 
             const d = new Date(latest.date);
             if (!isNaN(d.getTime()) && latest.timeIn) {
                const [h, m] = latest.timeIn.replace('.', ':').split(':').map(Number);
                d.setHours(h||0, m||0);
                tStart = d.getTime();
             }
        }
        
        if (tStart > 0) {
             const diffHours = (Date.now() - tStart) / (1000 * 60 * 60);
             if (diffHours < 24) return latest; // Found active session (even if yesterday)
        }
    }

    // B. If Closed, check if it belongs to 'Today' strictly
    if (new Date(latest.date!).toDateString() === todayStr) {
        return latest;
    }

    return undefined;
  }, [attendance, currentUser?.id, todayStr]);

  const isCheckedIn = !!todayAttendance;
  const isCheckedOut = !!todayAttendance?.timeOut;

  // Timer Effect
  const [elapsedTime, setElapsedTime] = useState<string>('00:00:00');
  const [greeting, setGreeting] = useState('');

  useEffect(() => {
    const updateTimer = () => {
        if (todayAttendance && todayAttendance.timeIn) {
            try {
                // 1. Determine Start Time accurately
                let startTimeTime = 0;
                
                // Priority: Use createdAt timestamp if available (Most Accurate)
                if (todayAttendance.createdAt) {
                    startTimeTime = Number(todayAttendance.createdAt);
                } else {
                    // Fallback: Parse String Date + TimeIn
                    const d = new Date(todayAttendance.date);
                    if (!isNaN(d.getTime())) {
                        const [hrs, mins, secs] = todayAttendance.timeIn.split(':').map(Number);
                        d.setHours(hrs || 0, mins || 0, secs || 0, 0);
                        startTimeTime = d.getTime();
                    }
                }

                if (!startTimeTime) return; // Cannot calculate

                // 2. Determine End Time (Now or fixed checkout time)
                const now = new Date().getTime();
                let endTimeTime = now;

                if (isCheckedOut && todayAttendance.timeOut) {
                    // Issues arise if checkout was 'next day' but date string is 'yesterday'. 
                    // Ideally we should have checkOutTimestamp. 
                    // But for displayed elapsed time on a closed session, it's static.
                    // If we assume checkout happened on same "logical shift day" or we just rely on current time if not feasible.
                    // Ideally: Backend should store checkOutTimestamp. 
                    // Hack for now: If checkout time < starttime (crossed midnight?), add 24h?
                    // Better: If we are here, session is DONE. Just show static duration if possible? 
                    // But 'elapsedTime' is for running timer. If closed, maybe just stop?
                }
                
                // If checking out, we stop timer?
                // Actually the logic below "isCheckedIn ? ... : ..." handles text.
                // If isCheckedOut, we strictly don't need running timer, but let's keep it robust.

                let diff = endTimeTime - startTimeTime;
                
                // Safety 
                if (diff < 0) diff = 0;

                if (diff >= 0) { // Allow 0
                    const h = Math.floor(diff / 3600000);
                    const m = Math.floor((diff % 3600000) / 60000);
                    const s = Math.floor((diff % 60000) / 1000);
                    setElapsedTime(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);
                }
            } catch (e) {
                console.error("Timer Parsing Error", e);
            }
        }
    };

    // Greeting Logic
    const h = new Date().getHours();
    if (h < 12) setGreeting('Selamat Pagi');
    else if (h < 15) setGreeting('Selamat Siang');
    else if (h < 18) setGreeting('Selamat Sore');
    else setGreeting('Selamat Malam');

    const interval = setInterval(updateTimer, 1000);
    updateTimer(); // Initial call
    return () => clearInterval(interval);
  }, [todayAttendance, isCheckedOut]);

  // 2. Performance Stats (Current Month)
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  const monthlyAttendance = attendance.filter(a => {
      const d = new Date(a.date!);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear && a.userId === currentUser?.id;
  });
  
  const totalLate = monthlyAttendance.filter(a => a.isLate).length;
  // REPLACED: Total Kehadiran instead of Sisa Cuti
  const totalPresent = monthlyAttendance.length;

  // 3. Task Priority (Assigned to Me & Incomplete)
  const myTasks = projects.flatMap(p => {
      // Only projects I'm in
      if (!p.collaborators.includes(currentUser?.id || '')) return [];
      if (p.status === 'DONE') return []; // Ignore done projects
      
      return p.tasks
          .filter(t => t.assignedTo.includes(currentUser?.id || '') && !t.isCompleted)
          .map(t => ({
              ...t,
              projectName: p.title,
              projectDeadline: p.deadline,
              priority: p.priority
          }));
  }).sort((a, b) => new Date(a.projectDeadline).getTime() - new Date(b.projectDeadline).getTime());

  const topTasks = myTasks.slice(0, 3);

  // 4. Daily Report Check
  const hasReportedToday = dailyReports.some(r => r.userId === currentUser?.id && r.date === new Date().toISOString().split('T')[0]);

  // 5. Recent Request Status
  const latestRequest = requests.filter(r => r.userId === currentUser?.id).sort((a, b) => b.createdAt - a.createdAt)[0];

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
       
       {/* 1. ZONA VITAL: KOKPIT UTAMA */}
       <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
           {/* Work Timer Card */}
           <div className="lg:col-span-2 bg-gradient-to-r from-slate-900 to-slate-800 rounded-[2.5rem] p-8 text-white relative overflow-hidden shadow-2xl">
               <div className="absolute right-0 top-0 w-64 h-64 bg-blue-500/20 rounded-full blur-3xl translate-x-10 -translate-y-10"></div>
               
               <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                   <div>
                       <div className="flex items-center gap-2 mb-2">
                           <span className="text-2xl animate-wave">👋</span>
                           <span className="text-blue-200 font-bold uppercase tracking-widest text-xs">{greeting}, {currentUser?.name.split(' ')[0]}</span>
                       </div>
                       <h1 className="text-4xl md:text-5xl font-black tracking-tight font-mono">
                           {isCheckedIn ? elapsedTime : '--:--:--'}
                       </h1>
                       <p className="text-slate-400 text-sm font-medium mt-2 flex items-center gap-2">
                           <Timer size={16} /> 
                           {isCheckedIn 
                              ? (isCheckedOut ? 'Sesi kerja selesai hari ini.' : 'Durasi kerja berjalan...') 
                              : 'Anda belum absen masuk hari ini.'}
                       </p>
                   </div>

                   <div>
                       {!isCheckedIn ? (
                           <button 
                             onClick={() => router.push(`/${currentUser?.tenantId || 'sdm'}/${currentUser?.role.toLowerCase()}/attendance`)}
                             className="px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-lg shadow-blue-500/30 transition-all active:scale-95 flex items-center gap-3"
                           >
                               <Clock size={20} /> Absen Masuk
                           </button>
                       ) : (
                           <div className={`px-6 py-3 rounded-xl border flex items-center gap-3 ${isCheckedOut ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-blue-500/10 border-blue-500/30 text-blue-400'}`}>
                               <CheckCircle2 size={20} />
                               <span className="font-bold text-sm uppercase tracking-widest">
                                   {isCheckedOut ? 'Sudah Pulang' : 'Sedang Bekerja'}
                               </span>
                           </div>
                       )}
                   </div>
               </div>
           </div>

           {/* Stats Mini Cards */}
           <div className="grid grid-cols-2 lg:grid-cols-1 gap-4">
               {/* Late Counter */}
               <div className={`p-6 rounded-[2rem] border ${totalLate > 0 ? 'bg-rose-50 border-rose-100' : 'bg-emerald-50 border-emerald-100'} flex flex-col justify-center`}>
                    <div className={`mb-2 font-black text-xs uppercase tracking-widest ${totalLate > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>Keterlambatan</div>
                    <div className={`text-3xl font-black ${totalLate > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                        {totalLate} <span className="text-sm text-slate-400 font-medium">x Bulan Ini</span>
                    </div>
               </div>
               
               {/* Attendance Counter (Replaced Leave Quota) */}
               <div className="p-6 rounded-[2rem] bg-indigo-50 border border-indigo-100 flex flex-col justify-center">
                    <div className="mb-2 font-black text-xs uppercase tracking-widest text-indigo-400">Total Kehadiran</div>
                    <div className="text-3xl font-black text-indigo-600">
                        {totalPresent} <span className="text-sm text-indigo-400 font-medium">Hari</span>
                    </div>
               </div>
           </div>
       </div>

       {/* 2. ZONA FOKUS: TASK & REPORT */}
       <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
           {/* Task List (Dominan) */}
           <div className="lg:col-span-2 space-y-4">
               <div className="flex items-center justify-between">
                   <h2 className="font-black text-lg text-slate-800 flex items-center gap-2">
                       <Briefcase className="text-blue-600" size={20} />
                       TUGAS PRIORITAS SAYA
                   </h2>
                   <button onClick={() => router.push(`/${currentUser?.tenantId || 'sdm'}/${currentUser?.role.toLowerCase()}/kanban`)} className="text-xs font-bold text-blue-600 hover:text-blue-700 uppercase tracking-widest flex items-center gap-1">
                       Lihat Semua <ArrowRight size={14} />
                   </button>
               </div>

               <div className="space-y-3">
                   {topTasks.length > 0 ? topTasks.map((task, idx) => (
                       <div key={idx} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition flex items-center justify-between group">
                           <div className="flex items-center gap-4">
                               <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xs ${task.priority === 'High' ? 'bg-rose-100 text-rose-600' : 'bg-blue-50 text-blue-600'}`}>
                                   {task.priority === 'High' ? 'HP' : task.projectName.substring(0,2).toUpperCase()}
                               </div>
                               <div>
                                   <div className="font-bold text-slate-700 group-hover:text-blue-600 transition">{task.title}</div>
                                   <div className="text-xs text-slate-400 font-medium mt-0.5 flex items-center gap-2">
                                       <span className="uppercase tracking-wider">{task.projectName}</span>
                                       <span>•</span>
                                       <span className={new Date(task.projectDeadline) < new Date() ? 'text-rose-500 font-bold' : ''}>
                                            Deadline: {new Date(task.projectDeadline).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                                       </span>
                                   </div>
                               </div>
                           </div>
                           <button className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-300 hover:bg-emerald-500 hover:text-white transition">
                               <CheckCircle2 size={16} />
                           </button>
                       </div>
                   )) : (
                       <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-100 border-dashed">
                           <p className="text-slate-400 text-sm font-medium">Tidak ada tugas prioritas saat ini. Great job! 🎉</p>
                       </div>
                   )}
               </div>
           </div>

           {/* Side Widgets */}
           <div className="space-y-6">
               {/* Daily Report Status Widget */}
               <div className={`p-6 rounded-[2rem] border ${hasReportedToday ? 'bg-emerald-50 border-emerald-100' : 'bg-white border-slate-200 shadow-sm'}`}>
                   <div className="flex items-center gap-3 mb-4">
                       <FileText size={20} className={hasReportedToday ? 'text-emerald-600' : 'text-slate-400'} />
                       <h3 className="font-black text-sm uppercase tracking-widest text-slate-700">Laporan Harian</h3>
                   </div>
                   
                   {hasReportedToday ? (
                       <div className="flex items-center gap-2 text-emerald-600 font-bold">
                           <CheckCircle2 size={24} />
                           <span>Sudah Dilaporkan</span>
                       </div>
                   ) : (
                       <div>
                           <p className="text-slate-500 text-xs mb-4 font-medium">Anda belum mengisi laporan kinerja hari ini.</p>
                           <button 
                             onClick={() => router.push(`/${currentUser?.tenantId || 'sdm'}/${currentUser?.role.toLowerCase()}/daily-report`)}
                             className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-slate-800 transition shadow-lg"
                           >
                               Buat Laporan
                           </button>
                       </div>
                   )}
               </div>

               {/* Latest Request Status */}
               {latestRequest && (
                   <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
                       <div className="flex items-center gap-3 mb-4">
                           <MessageSquare size={20} className="text-blue-500" />
                           <h3 className="font-black text-sm uppercase tracking-widest text-slate-700">Pengajuan Terakhir</h3>
                       </div>
                       <div className="p-4 bg-slate-50 rounded-xl">
                            <div className="flex justify-between items-start mb-2">
                                <span className="text-xs font-black uppercase text-slate-500 tracking-wider text-[10px]">{latestRequest.type}</span>
                                <span className={`text-[10px] px-2 py-1 rounded font-black uppercase ${
                                    latestRequest.status === RequestStatus.APPROVED ? 'bg-emerald-100 text-emerald-600' :
                                    latestRequest.status === RequestStatus.REJECTED ? 'bg-rose-100 text-rose-600' :
                                    'bg-amber-100 text-amber-600'
                                }`}>
                                    {latestRequest.status}
                                </span>
                            </div>
                            <p className="text-xs text-slate-600 font-medium line-clamp-2">{latestRequest.description}</p>
                            <div className="mt-2 text-[10px] text-slate-400 text-right">
                                {new Date(latestRequest.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                            </div>
                       </div>
                   </div>
               )}
           </div>
       </div>
    </div>
  );
};
