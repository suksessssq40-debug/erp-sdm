import React from 'react';
import { useAppStore } from '../context/StoreContext';
import { Users, AlertTriangle, FileText, CheckCircle2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

export const ManagerDashboard = () => {
  const { currentUser, attendance, projects, requests, users } = useAppStore();
  const router = useRouter();

  // Stats
  const today = new Date().toDateString();
  const todayAttendance = attendance.filter(a => new Date(a.date!).toDateString() === today);
  const totalStaff = users.filter(u => u.role === 'STAFF').length;
  const lateStaff = todayAttendance.filter(a => a.isLate).length;
  
  const pendingRequests = requests.filter(r => r.status === 'PENDING').length;
  const overdueProjects = projects.filter(p => p.deadline && new Date(p.deadline) < new Date() && p.status !== 'DONE').length;

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Attendance Stat */}
          <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm relative overflow-hidden group hover:shadow-md transition">
             <div className="absolute right-0 top-0 w-32 h-32 bg-blue-50 rounded-full -translate-y-16 translate-x-10 group-hover:bg-blue-100 transition"></div>
             <div className="relative z-10">
                <div className="flex items-center gap-3 mb-2 text-slate-500">
                    <Users size={18} /> <span className="text-[10px] font-black uppercase tracking-widest">KEHADIRAN HARI INI</span>
                </div>
                <div className="text-3xl font-black text-slate-800">
                    {todayAttendance.length} <span className="text-sm font-medium text-slate-400">/ {totalStaff}</span>
                </div>
                {lateStaff > 0 && <p className="text-xs font-bold text-rose-500 mt-1">{lateStaff} Terlambat</p>}
             </div>
          </div>

          {/* Pending Requests */}
          <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm relative overflow-hidden group hover:shadow-md transition cursor-pointer" onClick={() => router.push(`/${currentUser?.role.toLowerCase()}/requests`)}>
             <div className="absolute right-0 top-0 w-32 h-32 bg-amber-50 rounded-full -translate-y-16 translate-x-10 group-hover:bg-amber-100 transition"></div>
             <div className="relative z-10">
                <div className="flex items-center gap-3 mb-2 text-slate-500">
                    <FileText size={18} /> <span className="text-[10px] font-black uppercase tracking-widest">APPROVAL PENDING</span>
                </div>
                <div className="text-3xl font-black text-amber-600">{pendingRequests}</div>
                <p className="text-xs font-bold text-slate-400 mt-1">Menunggu persetujuan</p>
             </div>
          </div>

          {/* Overdue Projects */}
          <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm relative overflow-hidden group hover:shadow-md transition cursor-pointer" onClick={() => router.push(`/${currentUser?.role.toLowerCase()}/projects`)}>
             <div className="absolute right-0 top-0 w-32 h-32 bg-rose-50 rounded-full -translate-y-16 translate-x-10 group-hover:bg-rose-100 transition"></div>
             <div className="relative z-10">
                <div className="flex items-center gap-3 mb-2 text-slate-500">
                    <AlertTriangle size={18} /> <span className="text-[10px] font-black uppercase tracking-widest">PROYEK OVERDUE</span>
                </div>
                <div className="text-3xl font-black text-rose-600">{overdueProjects}</div>
                <p className="text-xs font-bold text-slate-400 mt-1">Perlu perhatian</p>
             </div>
          </div>
       </div>

       {/* Quick Actions for Manager */}
       <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm">
           <h3 className="font-black text-slate-800 mb-6">Aksi Cepat</h3>
           <div className="flex flex-wrap gap-4">
              <button onClick={() => router.push(`/${currentUser?.role.toLowerCase()}/kanban`)} className="px-6 py-3 bg-blue-50 text-blue-600 rounded-xl font-bold text-sm hover:bg-blue-100 transition">
                  Pantau Proyek
              </button>
              <button onClick={() => router.push(`/${currentUser?.role.toLowerCase()}/requests`)} className="px-6 py-3 bg-amber-50 text-amber-600 rounded-xl font-bold text-sm hover:bg-amber-100 transition">
                  Cek Izin/Cuti
              </button>
              <button onClick={() => router.push(`/${currentUser?.role.toLowerCase()}/daily-report`)} className="px-6 py-3 bg-purple-50 text-purple-600 rounded-xl font-bold text-sm hover:bg-purple-100 transition">
                  Cek Laporan Tim
              </button>
           </div>
       </div>
    </div>
  );
};
