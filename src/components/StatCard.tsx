import React from 'react';

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
}

export const StatCard: React.FC<StatCardProps> = ({ icon, label, value, sub }) => (
  <div className="bg-white p-10 rounded-[2.5rem] shadow-sm border border-slate-100 space-y-6 hover:shadow-2xl transition-all group relative overflow-hidden">
    <div className={`w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-blue-600 group-hover:text-white transition-all duration-500`}>{icon}</div>
    <div>
      <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] mb-1">{label}</p>
      <div className="flex items-center gap-3">
        <p className="text-2xl font-black text-slate-800 tracking-tight">{value}</p>
      </div>
      <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest mt-2">{sub}</p>
    </div>
  </div>
);
