import React, { useState } from 'react';
import { User, Attendance } from '../types';
import { useAppStore } from '../context/StoreContext';
import { Clock, CheckCircle2, AlertCircle, Briefcase, Calendar } from 'lucide-react';
import { useRouter } from 'next/navigation';

export const StaffDashboard = () => {
  const { currentUser, attendance, projects, dailyReports, addAttendance } = useAppStore();
  const router = useRouter();
  
  // Calculate Stats
  const today = new Date().toDateString();
  const todayAttendance = attendance.find(a => new Date(a.date!).toDateString() === today && a.userId === currentUser?.id);
  const isCheckedIn = !!todayAttendance;
  const isCheckedOut = !!todayAttendance?.timeOut;

  const myProjects = projects.filter(p => !p.isManagementOnly && p.collaborators.includes(currentUser?.id || ''));
  const activeProjects = myProjects.filter(p => p.status === 'ON_GOING' || p.status === 'DOING');
  
  // Recent Reports
  const myReports = dailyReports.filter(r => r.userId === currentUser?.id).slice(0, 3);

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
       {/* Welcome Banner */}
       <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-8 rounded-[2rem] text-white shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-10 translate-x-10"></div>
          <div className="relative z-10">
             <h1 className="text-3xl font-black mb-2">Halo, {currentUser?.name.split(' ')[0]}! 👋</h1>
             <p className="text-blue-100 font-medium">Semangat bekerja! Jangan lupa jaga kesehatan.</p>
             
             {/* Quick Attendance Status */}
             <div className="mt-8 flex items-center gap-4">
                <div className={`px-4 py-2 rounded-xl backdrop-blur-md border border-white/20 flex items-center gap-2 ${isCheckedIn ? 'bg-emerald-500/20 text-emerald-100' : 'bg-rose-500/20 text-rose-100'}`}>
                    {isCheckedIn ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                    <span className="font-bold text-sm">{isCheckedIn ? (isCheckedOut ? 'Sudah Pulang' : 'Sudah Absen Masuk') : 'Belum Absen Masuk'}</span>
                </div>
                {!isCheckedIn && (
                   <button 
                     onClick={() => router.push(`/${currentUser?.role.toLowerCase()}/attendance`)}
                     className="px-6 py-2 bg-white text-blue-600 rounded-xl font-black text-xs uppercase tracking-wider hover:bg-blue-50 transition shadow-lg shadow-blue-900/20"
                   >
                     Absen Sekarang
                   </button>
                )}
             </div>
          </div>
       </div>

       <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Active Projects Card */}
          <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-md transition">
             <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mb-4">
                <Briefcase size={24} />
             </div>
             <h3 className="text-2xl font-black text-slate-800">{activeProjects.length}</h3>
             <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mt-1">Proyek Aktif</p>
          </div>
          
          {/* Reports Card */}
          <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-md transition">
             <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-2xl flex items-center justify-center mb-4">
                <Calendar size={24} />
             </div>
             <h3 className="text-2xl font-black text-slate-800">{myReports.length}</h3>
             <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mt-1">Laporan Terkini</p>
          </div>
       </div>

       {/* Quick Actions */}
       <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
           {['Laporan Harian', 'Ajukan Izin', 'Lihat Tugas', 'Profil Saya'].map((action, i) => (
               <button 
                 key={i}
                 onClick={() => {
                    const r = currentUser?.role.toLowerCase();
                    if(i===0) router.push(`/${r}/daily-report`);
                    if(i===1) router.push(`/${r}/requests`);
                    if(i===2) router.push(`/${r}/kanban`);
                    // if(i===3) router.push(`/${r}/profile`);
                 }}
                 className="p-4 bg-white border border-slate-200 rounded-2xl text-left hover:border-blue-500 hover:ring-1 hover:ring-blue-500 transition group"
               >
                  <span className="font-bold text-slate-700 text-sm group-hover:text-blue-600">{action}</span>
               </button>
           ))}
       </div>
    </div>
  );
};
