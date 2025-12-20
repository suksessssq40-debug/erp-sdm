import React from 'react';
import { Target, Landmark, CheckCircle2, FileText, Users as UsersIcon } from 'lucide-react';
import { formatCurrency } from '../utils';
import { KanbanStatus } from '../types';
import { StatCard } from './StatCard';

export const OwnerDashboard = ({ store, toast }: any) => {
  const totalBalance = store.transactions.reduce((acc: number, curr: any) => curr.type === 'IN' ? acc + curr.amount : acc - curr.amount, 0);
  const activeProjects = store.projects.filter((p: any) => p.status !== KanbanStatus.DONE);
  const totalTasks = store.projects.reduce((acc: any, p: any) => acc + p.tasks.length, 0);
  const completedTasks = store.projects.reduce((acc: any, p: any) => acc + p.tasks.filter((t: any) => t.isCompleted).length, 0);
  const progressPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  return (
    <div className="space-y-10 animate-in fade-in duration-700">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-slate-900 rounded-[3rem] p-10 text-white relative overflow-hidden shadow-2xl">
           <div className="absolute top-0 right-0 w-80 h-80 bg-blue-600/30 blur-[120px] rounded-full -mr-32 -mt-32"></div>
           <div className="relative z-10 space-y-10">
              <div className="space-y-3">
                 <h2 className="text-5xl font-black tracking-tight leading-none italic">Status Perusahaan</h2>
                 <p className="text-slate-400 font-bold text-base uppercase tracking-widest">PERFORMANCE SUMMARY V2.1</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 border-t border-white/5 pt-8">
                 <div className="space-y-2">
                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-400">LIQUID ASSETS</p>
                    <p className="text-3xl font-black tracking-tighter">{formatCurrency(totalBalance)}</p>
                 </div>
                 <div className="space-y-2">
                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-emerald-400">PROGRES PROYEK</p>
                    <p className="text-3xl font-black tracking-tighter">{progressPercent}%</p>
                 </div>
                 <div className="space-y-2">
                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-400">TOTAL AKTIVITAS</p>
                    <p className="text-3xl font-black tracking-tighter">{store.dailyReports.length} DATA</p>
                 </div>
              </div>
           </div>
        </div>
        <div className="bg-blue-600 rounded-[3rem] p-10 text-white shadow-2xl flex flex-col justify-between group overflow-hidden relative">
           <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-1000"></div>
           <div>
              <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center mb-8 shadow-xl"><Target className="text-white" size={32} /></div>
              <h3 className="text-2xl font-black uppercase tracking-widest leading-none mb-3">GOALS UPDATE</h3>
              <p className="text-blue-100 text-sm font-bold leading-relaxed">{activeProjects.length} Proyek sedang berjalan, {store.requests.filter((r: any) => r.status === 'PENDING').length} Izin menunggu approval.</p>
           </div>
           <button className="w-full bg-white text-blue-600 py-5 rounded-[1.5rem] font-black text-xs uppercase tracking-widest mt-8 hover:shadow-2xl transition shadow-xl">MANAGE OPERATIONS</button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
         <StatCard icon={<Landmark />} label="Cash On Bank" value={formatCurrency(totalBalance)} sub="Healthy Runway" />
         <StatCard icon={<CheckCircle2 />} label="Tasks Done" value={completedTasks.toString()} sub={`From ${totalTasks} total`} />
         <StatCard icon={<FileText />} label="Daily Logs" value={store.dailyReports.length.toString()} sub="Team activity" />
         <StatCard icon={<UsersIcon />} label="Team Size" value={store.users.length.toString()} sub="Active personnel" />
      </div>
    </div>
  );
};
