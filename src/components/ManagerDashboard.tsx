import React, { useState, useEffect } from 'react';
import { useAppStore } from '../context/StoreContext';
import { Users, AlertTriangle, FileText, CheckCircle2, Clock, Timer, ArrowRight, XCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';

export const ManagerDashboard = () => {
  const { currentUser, attendance, projects, requests, users } = useAppStore();
  const router = useRouter();

  // --- 1. PERSONAL TIMER LOGIC (Copied from Staff) ---
  const [elapsedTime, setElapsedTime] = useState<string>('00:00:00');
  const [greeting, setGreeting] = useState('');
  
  const todayStr = new Date().toDateString();
  const myAttendance = attendance.find(a => new Date(a.date!).toDateString() === todayStr && a.userId === currentUser?.id);
  const isCheckedIn = !!myAttendance;
  const isCheckedOut = !!myAttendance?.timeOut;

  useEffect(() => {
    const updateTimer = () => {
        if (myAttendance && myAttendance.timeIn) {
            try {
                const now = new Date();
                const [hrs, mins, secs] = myAttendance.timeIn.split(':').map(Number);
                const startTime = new Date();
                startTime.setHours(hrs || 0, mins || 0, secs || 0, 0);

                const end = isCheckedOut && myAttendance.timeOut 
                    ? (() => {
                        const [outHrs, outMins, outSecs] = myAttendance.timeOut.split(':').map(Number);
                        const endTime = new Date();
                        endTime.setHours(outHrs || 0, outMins || 0, outSecs || 0, 0);
                        return endTime.getTime();
                    })()
                    : now.getTime();

                let diff = end - startTime.getTime();
                if (diff < 0) diff = 0;
                
                const h = Math.floor(diff / 3600000);
                const m = Math.floor((diff % 3600000) / 60000);
                const s = Math.floor((diff % 60000) / 1000);
                setElapsedTime(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);
            } catch (e) {
                console.error(e);
            }
        }
    };

    const h = new Date().getHours();
    if (h < 12) setGreeting('Selamat Pagi');
    else if (h < 15) setGreeting('Selamat Siang');
    else if (h < 18) setGreeting('Selamat Sore');
    else setGreeting('Selamat Malam');

    const interval = setInterval(updateTimer, 1000);
    updateTimer();
    return () => clearInterval(interval);
  }, [myAttendance, isCheckedOut]);
  // ------------------------------------------------

  // --- 2. TEAM MANAGEMENT LOGIC ---
  // Fix "9/8" Error: Target is ALL active users EXCLUDING Owner
  const teamMembers = users.filter(u => u.role !== 'OWNER' && u.role !== 'SUPERADMIN'); 
  const totalTeam = teamMembers.length;
  
  const todayTeamAttendance = attendance.filter(a => {
      const isToday = new Date(a.date!).toDateString() === todayStr;
      const isTeam = teamMembers.some(u => u.id === a.userId); // Ensure we only count team members, not owner
      return isToday && isTeam;
  });

  const presentCount = todayTeamAttendance.length;
  const lateStaff = todayTeamAttendance.filter(a => a.isLate);
  // Who is absent? (In teamMembers but NOT in todayTeamAttendance)
  const absentStaffNames = teamMembers
    .filter(u => !todayTeamAttendance.some(a => a.userId === u.id))
    .slice(0, 3); // Show top 3 names

  // Approval urgency
  const pendingRequests = requests.filter(r => r.status === 'PENDING');
  
  // Project urgency
  const overdueProjects = projects.filter(p => p.deadline && new Date(p.deadline) < new Date() && p.status !== 'DONE');

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
       
       {/* SECTION 1: MY WORKSPACE (PERSONAL) */}
       <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-[2.5rem] p-8 text-white relative overflow-hidden shadow-2xl">
           <div className="absolute right-0 top-0 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl translate-x-20 -translate-y-20"></div>
           <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-6">
               <div>
                   <div className="flex items-center gap-2 mb-2 text-indigo-300 font-bold uppercase tracking-widest text-xs">
                       <Users size={14} /> MANAGER WORKSPACE
                   </div>
                   <h1 className="text-4xl font-black font-mono mb-2">{isCheckedIn ? elapsedTime : '00:00:00'}</h1>
                   <p className="text-slate-400 text-sm flex items-center gap-2">
                       {isCheckedIn ? '⏱️ Durasi kerja Anda hari ini' : '👋 Halo Pak Manager, jangan lupa absen ya!'}
                   </p>
               </div>
               <div>
                   {!isCheckedIn ? (
                       <button onClick={() => router.push(`/${currentUser?.tenantId || 'sdm'}/${currentUser?.role.toLowerCase()}/attendance`)} className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-sm uppercase tracking-widest shadow-lg transition">
                           <Clock className="inline mr-2" size={18}/> Absen Masuk
                       </button>
                   ) : (
                        <div className={`px-6 py-3 rounded-xl border flex items-center gap-3 ${isCheckedOut ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400'}`}>
                            <CheckCircle2 size={20} />
                            <span className="font-bold text-sm uppercase tracking-widest">
                                {isCheckedOut ? 'Sudah Pulang' : 'Sedang Bekerja'}
                            </span>
                        </div>
                   )}
               </div>
           </div>
       </div>

       {/* SECTION 2: MANAGEMENT CONTROL (TEAM) */}
       <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* A. Live Attendance Monitor */}
          <div className="lg:col-span-2 bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
             <div className="flex justify-between items-center mb-6">
                 <h3 className="font-black text-slate-800 flex items-center gap-2">
                     <Users className="text-blue-600" size={20} /> MONITORING TIM
                 </h3>
                 <span className="text-xs font-bold bg-blue-50 text-blue-600 px-3 py-1 rounded-full">
                     {presentCount} / {totalTeam} Hadir
                 </span>
             </div>
             
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 {/* Who is Late? */}
                 <div className="p-4 bg-rose-50 rounded-2xl border border-rose-100">
                     <div className="text-xs font-black text-rose-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                         <AlertTriangle size={14} /> Terlambat Hari Ini ({lateStaff.length})
                     </div>
                     {lateStaff.length > 0 ? (
                         <div className="space-y-2">
                             {lateStaff.map(a => {
                                 const staff = users.find(u => u.id === a.userId);
                                 return (
                                     <div key={a.id} className="flex items-center justify-between text-sm bg-white p-2 rounded-lg shadow-sm">
                                         <span className="font-bold text-slate-700">{staff?.name}</span>
                                         <span className="font-mono text-rose-600 text-xs">{a.timeIn}</span>
                                     </div>
                                 )
                             })}
                         </div>
                     ) : (
                         <p className="text-xs text-rose-300 font-medium italic">Tim disiplin hari ini! 👍</p>
                     )}
                 </div>

                 {/* Who is Absent? */}
                 <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                     <div className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                         <XCircle size={14} /> Belum Hadir
                     </div>
                     {absentStaffNames.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                            {absentStaffNames.map(u => (
                                <span key={u.id} className="text-xs font-bold text-slate-500 bg-white border border-slate-200 px-2 py-1 rounded-lg">
                                    {u.name.split(' ')[0]}
                                </span>
                            ))}
                            {teamMembers.length - presentCount > 3 && <span className="text-xs text-slate-400">+{teamMembers.length - presentCount - 3} others</span>}
                        </div>
                     ) : (
                        <p className="text-xs text-emerald-500 font-medium italic">Semua hadir! 🎉</p>
                     )}
                 </div>
             </div>
          </div>

          {/* B. Approval & Action Center */}
          <div className="space-y-4">
               {/* Pending Approvals */}
               <div className="bg-amber-50 p-6 rounded-[2rem] border border-amber-100 relative group cursor-pointer hover:shadow-md transition"
                    onClick={() => router.push(`/${currentUser?.tenantId || 'sdm'}/${currentUser?.role.toLowerCase()}/requests`)}>
                   <div className="flex justify-between items-start mb-2">
                       <div className="bg-white p-2 rounded-xl text-amber-500 shadow-sm">
                           <FileText size={24} />
                       </div>
                       <div className="text-3xl font-black text-amber-600">{pendingRequests.length}</div>
                   </div>
                   <h3 className="font-bold text-slate-700">Approval Pending</h3>
                   <p className="text-xs text-amber-600/80 mt-1 font-medium">Menunggu persetujuan Anda</p>
               </div>

               {/* Overdue Projects */}
               <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm relative group cursor-pointer hover:shadow-md transition"
                    onClick={() => router.push(`/${currentUser?.tenantId || 'sdm'}/${currentUser?.role.toLowerCase()}/projects`)}>
                   <div className="flex items-center gap-2 mb-2 text-rose-500 font-black text-xs uppercase tracking-widest">
                       <AlertTriangle size={14} /> Butuh Perhatian
                   </div>
                   <div className="text-2xl font-black text-slate-800 mb-1">
                       {overdueProjects.length} <span className="text-sm font-medium text-slate-400">Proyek Overdue</span>
                   </div>
                   <div className="text-xs text-slate-500 line-clamp-1">
                       {overdueProjects.length > 0 ? overdueProjects.map(p => p.title).join(', ') : 'Semua proyek aman terkendali'}
                   </div>
               </div>
          </div>
       </div>
    </div>
  );
};
