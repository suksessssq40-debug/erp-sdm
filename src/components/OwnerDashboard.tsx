
import React, { useState, useEffect } from 'react';
import { useAppStore } from '../context/StoreContext';
import { 
  Users, 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  Wallet, 
  CheckCircle2, 
  Activity,
  Zap
} from 'lucide-react';
import { useRouter } from 'next/navigation';

export const OwnerDashboard = () => {
    const { currentUser, attendance, projects, requests, users, dailyReports } = useAppStore();
    const router = useRouter();
    
    // --- 1. FINANCIAL REAL-TIME STATS ---
    const [finStats, setFinStats] = useState({ totalBalance: 0, monthlyIn: 0, monthlyOut: 0, isLoading: true });
    
    useEffect(() => {
        const fetchStats = async () => {
            try {
                const res = await fetch('/api/finance/stats');
                const data = await res.json();
                if (res.ok) {
                    setFinStats({ ...data, isLoading: false });
                }
            } catch (error) {
                console.error('Failed to fetch finance stats', error);
            }
        };
        fetchStats();
    }, []);

    // --- 2. INTELLIGENCE & HEALTH CHECK ---
    const todayStr = new Date().toDateString();
    const activeStaff = users.filter(u => u.role !== 'OWNER' && u.role !== 'SUPERADMIN');
    
    // Attendance Stats
    const todayTeamAttendance = attendance.filter(a => {
        const isToday = new Date(a.date!).toDateString() === todayStr;
        const isStaff = activeStaff.some(u => u.id === a.userId);
        return isToday && isStaff; 
    });
    const lateCount = todayTeamAttendance.filter(a => a.isLate).length;
    // const absentCount = activeStaff.length - todayTeamAttendance.length;

    // Operational Stats
    const overdueProjects = projects.filter(p => p.deadline && new Date(p.deadline) < new Date() && p.status !== 'DONE');
    const pendingApprovals = requests.filter(r => r.status === 'PENDING').length;
    
    // Profit Calculation (Cash Basis)
    const netCashFlow = finStats.monthlyIn - finStats.monthlyOut;

    // Health Score Logic
    let healthStatus = { label: 'EXCELLENT', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30' };
    if (overdueProjects.length > 0 || lateCount > 3) {
        healthStatus = { label: 'ATTENTION NEEDED', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30' };
    }
    if (netCashFlow < 0 && !finStats.isLoading) {
        healthStatus = { label: 'CRITICAL', color: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/30' };
    }

    const formatIDR = (n: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);

    return (
        <div className="space-y-8 animate-in fade-in duration-500 pb-20">
            {/* ROW 1: THE BUSINESS PULSE (EXECUTIVE BANNER) */}
            <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 rounded-[2.5rem] p-8 md:p-10 text-white relative overflow-hidden shadow-2xl border border-slate-700/50">
                 {/* Background Effects */}
                 <div className="absolute right-0 top-0 w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[120px] translate-x-1/3 -translate-y-1/3"></div>
                 <div className="absolute left-0 bottom-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl -translate-x-10 translate-y-10"></div>
                 
                 <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-8 items-center">
                     {/* 1. Health Status */}
                     <div className="space-y-4">
                         <div className="flex items-center gap-3">
                             <div className="h-12 w-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
                                 <Activity className={healthStatus.color} size={24} />
                             </div>
                             <div>
                                 <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Operational Health</p>
                                 <div className={`mt-1 inline-flex items-center px-3 py-1 rounded-full border ${healthStatus.bg} ${healthStatus.border}`}>
                                     <span className={`text-[10px] font-black tracking-widest ${healthStatus.color}`}>{healthStatus.label}</span>
                                 </div>
                             </div>
                         </div>
                         <div className="pl-1">
                            <p className="text-slate-400 text-sm leading-relaxed">
                                {activeStaff.length} Active Staff • {todayTeamAttendance.length} Checked In • {overdueProjects.length} Issues
                            </p>
                         </div>
                     </div>

                     {/* 2. The Bottom Line (Net Cashflow) */}
                     <div className="md:border-l md:border-r border-white/10 md:px-8 text-center space-y-2">
                         <p className="text-slate-400 text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2">
                             <TrendingUp size={14} className={netCashFlow >= 0 ? "text-emerald-400" : "text-rose-400"} />
                             Net Kas Bulan Ini
                         </p>
                         <h2 className={`text-4xl lg:text-5xl font-black tracking-tight ${netCashFlow >= 0 ? 'text-white' : 'text-rose-400'}`}>
                             {finStats.isLoading ? '...' : (netCashFlow >= 0 ? '+' : '') + formatIDR(netCashFlow)}
                         </h2>
                         <p className={`text-xs font-medium ${netCashFlow >= 0 ? 'text-emerald-400/80' : 'text-rose-400/80'}`}>
                             {netCashFlow >= 0 ? 'Surplus Operasional' : 'Defisit - Perlu Perhatian'}
                         </p>
                     </div>

                     {/* 3. Productivity Insight */}
                     <div className="flex flex-col items-center md:items-end space-y-4">
                         <div className="text-right">
                             <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1">Total Saldo (Liquid)</p>
                             <div className="text-2xl font-black">{finStats.isLoading ? '...' : formatIDR(finStats.totalBalance)}</div>
                         </div>
                         <div className="w-full bg-white/5 rounded-xl p-4 border border-white/10 flex items-center justify-between gap-4">
                             <div className="flex items-center gap-3">
                                 <div className="p-2 bg-blue-500/20 rounded-lg text-blue-400"><Zap size={18} /></div>
                                 <div className="text-left">
                                     <div className="text-xs text-slate-400 font-bold uppercase">Work Efficiency</div>
                                     <div className="text-white font-bold">{Math.round((todayTeamAttendance.length / (activeStaff.length || 1)) * 100)}% Attendance</div>
                                 </div>
                             </div>
                             <button onClick={() => router.push('/owner/finance')} className="h-8 w-8 rounded-full bg-white text-slate-900 flex items-center justify-center hover:bg-blue-50 transition">
                                 <TrendingUp size={16} />
                             </button>
                         </div>
                     </div>
                 </div>
            </div>

            {/* ROW 2: FINANCIAL INTELLIGENCE */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-slate-900 text-white p-8 rounded-[2.5rem] relative overflow-hidden group">
                    <div className="absolute right-0 top-0 w-32 h-32 bg-emerald-500/20 rounded-full blur-2xl -translate-y-10 translate-x-10 group-hover:bg-emerald-500/30 transition"></div>
                    <div className="relative z-10">
                        <div className="flex items-center gap-2 mb-4 text-emerald-400 font-bold text-xs uppercase tracking-widest">
                            <Wallet size={16} /> Total Kekayaan (Net)
                        </div>
                        <div className="text-3xl font-black tracking-tight">{finStats.isLoading ? 'Calculating...' : formatIDR(finStats.totalBalance)}</div>
                        <p className="text-slate-400 text-xs mt-2">Saldo Real-time dari semua akun.</p>
                    </div>
                </div>

                <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm group hover:shadow-md transition">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2 text-slate-400 font-bold text-xs uppercase tracking-widest">
                            <TrendingUp size={16} className="text-emerald-500" /> Masuk Bln Ini
                        </div>
                        <div className="bg-emerald-50 p-2 rounded-full text-emerald-600 opacity-0 group-hover:opacity-100 transition"><TrendingUp size={16} /></div>
                    </div>
                    <div className="text-2xl font-black text-slate-800">{finStats.isLoading ? '...' : formatIDR(finStats.monthlyIn)}</div>
                </div>

                <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm group hover:shadow-md transition">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2 text-slate-400 font-bold text-xs uppercase tracking-widest">
                            <TrendingDown size={16} className="text-rose-500" /> Keluar Bln Ini
                        </div>
                        <div className="bg-rose-50 p-2 rounded-full text-rose-600 opacity-0 group-hover:opacity-100 transition"><TrendingDown size={16} /></div>
                    </div>
                    <div className="text-2xl font-black text-rose-600">{finStats.isLoading ? '...' : formatIDR(finStats.monthlyOut)}</div>
                </div>
            </div>

            {/* ROW 3: OPERATIONAL RISKS */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Project Risks */}
                <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="font-black text-slate-800 flex items-center gap-2">
                             <AlertTriangle className={overdueProjects.length > 0 ? "text-rose-600" : "text-slate-300"} size={20} />
                             RISIKO PROYEK
                        </h3>
                        {overdueProjects.length > 0 && <span className="px-3 py-1 bg-rose-100 text-rose-700 rounded-full text-xs font-black animate-pulse">{overdueProjects.length} KRITIS</span>}
                    </div>
                    
                    <div className="space-y-3">
                        {overdueProjects.length > 0 ? overdueProjects.slice(0,3).map(p => (
                            <div key={p.id} className="flex justify-between items-center p-4 bg-rose-50 rounded-2xl border border-rose-100">
                                <div>
                                    <div className="font-bold text-slate-800">{p.title}</div>
                                    <div className="text-xs text-rose-600 font-bold mt-1">Overdue: {new Date(p.deadline).toLocaleDateString()}</div>
                                </div>
                                <button onClick={() => router.push(`/owner/projects`)} className="px-4 py-2 bg-white text-rose-600 rounded-xl text-xs font-bold shadow-sm hover:shadow-md transition">Check</button>
                            </div>
                        )) : (
                            <div className="p-6 bg-emerald-50 rounded-2xl border border-emerald-100 text-center">
                                <CheckCircle2 className="mx-auto text-emerald-500 mb-2" size={32} />
                                <p className="text-emerald-700 font-bold text-sm">Semua Proyek Aman (On Track)</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Pending Actions */}
                <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm relative overflow-hidden"
                     onClick={() => router.push('/owner/requests')}>
                    <div className="absolute top-0 right-0 w-32 h-32 bg-amber-50 rounded-bl-[100px] -mr-4 -mt-4 transition hover:bg-amber-100"></div>
                    <h3 className="font-black text-slate-800 mb-2 relative z-10">APPROVAL</h3>
                    <div className="text-5xl font-black text-amber-500 mb-2 relative z-10">{pendingApprovals}</div>
                    <p className="text-slate-400 font-bold text-sm relative z-10">Permohonan Menunggu Tanda Tangan Digital Anda.</p>
                    
                    {pendingApprovals > 0 && <button className="mt-8 w-full py-4 bg-amber-500 text-white rounded-xl font-black text-sm uppercase tracking-widest shadow-lg shadow-amber-500/20 hover:bg-amber-400 transition">
                        Process Now
                    </button>}
                </div>
            </div>
        </div>
    );
};
