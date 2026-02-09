
import React, { useState, useEffect, useMemo } from 'react';
import { useAppStore } from '../context/StoreContext';
import { MultiUnitOverview } from './MultiUnitOverview';
import {
    Users,
    TrendingUp,
    TrendingDown,
    AlertTriangle,
    Wallet,
    CheckCircle2,
    Activity,
    Zap,
    ArrowRight
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    BarChart,
    Bar
} from 'recharts';

export const OwnerDashboard = () => {
    // OPTIMIZED: Remove heavy data dependencies (attendance, projects, requests)
    const { currentUser, users, dailyReports, authToken } = useAppStore();
    const router = useRouter();

    // --- 1. SERVER-SIDE OPERATIONAL STATS (TURBO MODE) ---
    const [stats, setStats] = useState({
        employees: 0,
        attendance: 0,
        projects: 0,
        requests: 0,
        lateCount: 0,
        overdueProjects: 0,
        latestReports: [] as any[],
        projectDistribution: [] as any[],
        recentLeaves: [] as any[]
    });

    useEffect(() => {
        const fetchOpStats = async () => {
            if (!authToken) return;
            try {
                const res = await fetch('/api/dashboard/stats', {
                    headers: { 'Authorization': `Bearer ${authToken}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    setStats(prev => ({ ...prev, ...data }));
                }
            } catch (e) {
                console.error("Dashboard Stats Error", e);
            }
        };
        fetchOpStats();
        // Refresh every 30s
        const interval = setInterval(fetchOpStats, 30000);
        return () => clearInterval(interval);
    }, [authToken]);

    // --- 2. FINANCIAL REAL-TIME STATS ---
    const [finStats, setFinStats] = useState({
        totalBalance: 0,
        monthlyIn: 0,
        monthlyOut: 0,
        dailyTrend: [] as any[],
        isLoading: true
    });

    useEffect(() => {
        const fetchStats = async () => {
            if (!authToken) return;
            try {
                const res = await fetch('/api/finance/stats', {
                    headers: { 'Authorization': `Bearer ${authToken}` }
                });
                const data = await res.json();
                if (res.ok) {
                    setFinStats({ ...data, isLoading: false });
                }
            } catch (error) {
                console.error('Failed to fetch finance stats', error);
            }
        };
        fetchStats();
    }, [authToken]);

    const netCashFlow = finStats.monthlyIn - finStats.monthlyOut;

    const formatIDR = (val: number) => {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            maximumFractionDigits: 0
        }).format(val);
    };

    // Derived values for UI compatibility
    const pendingApprovals = stats.requests;
    const lateCount = stats.lateCount || 0;
    const overdueProjectsCount = stats.overdueProjects || 0;
    const activeStaff = users ? users.filter(u => u.role !== 'OWNER' && u.isActive !== false) : [];

    const getHealthScore = () => {
        if (overdueProjectsCount > 5 || netCashFlow < 0) return { label: 'CRITICAL', color: 'text-rose-500', bg: 'bg-rose-500/10' };
        if (overdueProjectsCount > 0 || lateCount > (activeStaff.length * 0.2)) return { label: 'ATTENTION NEEDED', color: 'text-amber-500', bg: 'bg-amber-500/10' };
        return { label: 'EXCELLENT', color: 'text-emerald-500', bg: 'bg-emerald-500/10' };
    };

    const health = getHealthScore();

    return (
        <div className="p-4 md:p-8 space-y-10 bg-[#F8FAFC] min-h-screen animate-in fade-in duration-700 pb-20">

            {/* --- TOP BANNER (GOD MODE PULSE) --- */}
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">

                {/* 1. Operational Overview Card */}
                <div className="xl:col-span-8 bg-slate-900 rounded-[3rem] p-8 md:p-12 text-white relative overflow-hidden shadow-2xl">
                    <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2"></div>
                    <div className="absolute bottom-0 left-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-[100px] translate-y-1/2 -translate-x-1/2"></div>

                    <div className="relative z-10 flex flex-col xl:flex-row justify-between gap-10">
                        <div className="space-y-8 flex-1">
                            <div className="flex items-center gap-4">
                                <div className={`px-5 py-2 rounded-full text-[10px] font-black tracking-[0.2em] ${health.bg} ${health.color} border border-white/5 uppercase`}>
                                    OPERATIONAL HEALTH: {health.label}
                                </div>
                                <div className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse border-2 border-emerald-500/30"></div>
                            </div>

                            <div className="max-w-full">
                                <p className="text-slate-400 text-[10px] lg:text-xs font-black uppercase tracking-[0.3em] mb-3">Net Profitability (Current Month)</p>
                                <div className={`text-4xl lg:text-5xl xl:text-7xl font-black tracking-tighter truncate ${netCashFlow >= 0 ? 'text-white' : 'text-rose-400'}`}>
                                    {finStats.isLoading ? (
                                        <div className="flex gap-2 items-center">
                                            <div className="w-8 h-8 bg-white/10 rounded-lg animate-pulse"></div>
                                            <span className="opacity-20">STABILIZING...</span>
                                        </div>
                                    ) : (netCashFlow >= 0 ? '+' : '') + formatIDR(netCashFlow)}
                                </div>
                                <div className={`mt-4 inline-flex items-center gap-3 px-4 py-2 rounded-2xl text-xs font-black ${netCashFlow >= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                                    {netCashFlow >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                                    {netCashFlow >= 0 ? 'SURPLUS DETECTED' : 'DEFICIT ALERT'}
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-8 pt-8 border-t border-white/10">
                                <div className="space-y-1">
                                    <div className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Active Projects</div>
                                    <div className="text-2xl font-black">{stats.projects}</div>
                                </div>
                                <div className="space-y-1">
                                    <div className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Late Today</div>
                                    <div className={`text-2xl font-black ${lateCount > 0 ? 'text-amber-400' : 'text-slate-200'}`}>{lateCount}</div>
                                </div>
                                <div className="space-y-1">
                                    <div className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Growth Assets</div>
                                    <div className="text-2xl font-black">+{stats.projectDistribution.find(p => p.status === 'DONE')?._count?.id || 0}</div>
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-col justify-between items-start lg:items-end lg:text-right min-w-[280px]">
                            <div className="bg-white/5 backdrop-blur-2xl rounded-[2.5rem] p-8 border border-white/10 w-full space-y-6 shadow-2xl">
                                <div className="flex items-center justify-between">
                                    <div className="p-3 bg-blue-500/20 rounded-2xl text-blue-400"><Activity size={24} /></div>
                                    <div className="text-[10px] font-black text-blue-400 tracking-[0.2em]">TEAM PULSE</div>
                                </div>
                                <div>
                                    <div className="text-4xl xl:text-5xl font-black tracking-tighter">
                                        {stats.employees > 0 ? Math.round((stats.attendance / stats.employees) * 100) : 0}%
                                    </div>
                                    <div className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-2">Daily Attendance</div>
                                </div>
                                <div className="w-full bg-white/10 h-2 rounded-full overflow-hidden">
                                    <div
                                        className="bg-gradient-to-r from-blue-600 to-blue-400 h-full transition-all duration-[2000ms] cubic-bezier(0.4, 0, 0.2, 1)"
                                        style={{ width: `${stats.employees > 0 ? (stats.attendance / stats.employees) * 100 : 0}%` }}
                                    ></div>
                                </div>
                                <p className="text-[9px] text-slate-500 font-bold italic">Based on {stats.employees} active verified staff</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 2. Operations & Finance Hybrid Card */}
                <div className="xl:col-span-4 flex flex-col gap-6">
                    <div className="flex-1 bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-100 flex flex-col justify-between group hover:border-blue-400/30 transition-all duration-500 hover:shadow-xl hover:shadow-blue-500/5">
                        <div className="space-y-6">
                            <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-all duration-500 shadow-inner">
                                <Wallet size={28} />
                            </div>
                            <div className="space-y-2">
                                <h3 className="text-2xl font-black text-slate-800 tracking-tight">Finance Ops</h3>
                                <p className="text-slate-500 text-sm leading-relaxed">Full control over verified cash flows, bank accounts, and asset mutations.</p>
                            </div>
                        </div>
                        <button
                            onClick={() => router.push(`/${currentUser?.tenantId || 'sdm'}/owner/finance`)}
                            className="bg-slate-900 text-white w-full py-5 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-blue-600 transition-all duration-300 shadow-xl active:scale-95"
                        >
                            Executive Finance <ArrowRight size={20} />
                        </button>
                    </div>

                    <div className="bg-emerald-600 rounded-[2.5rem] p-8 text-white shadow-xl relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl translate-x-10 -translate-y-10 group-hover:scale-150 transition-transform duration-1000"></div>
                        <h4 className="text-[10px] font-black uppercase tracking-[0.4em] text-emerald-200 mb-2">System Asset Value</h4>
                        <div className="text-2xl xl:text-3xl font-black tracking-tighter truncate">{finStats.isLoading ? '...' : formatIDR(finStats.totalBalance)}</div>
                    </div>
                </div>
            </div>

            {/* Aggregated View for Multiple Units */}
            <MultiUnitOverview />

            {/* --- NEW SECTION: PERFORMANCE & PULSE --- */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                {/* 1. THE PULSE: Latest Daily Reports */}
                <div className="lg:col-span-2 bg-white rounded-[3rem] p-10 shadow-sm border border-slate-100">
                    <div className="flex justify-between items-center mb-10">
                        <div>
                            <h3 className="text-2xl font-black text-slate-800 tracking-tight italic uppercase flex items-center gap-3">
                                <Zap className="text-blue-500" size={24} />
                                The Pulse
                            </h3>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">LATEST FIELD ACTIVITY REPORTS</p>
                        </div>
                        <button
                            onClick={() => router.push('/sdm/owner/reports')}
                            className="text-[10px] font-black text-blue-600 uppercase tracking-widest hover:underline"
                        >
                            View Archives
                        </button>
                    </div>

                    <div className="space-y-6">
                        {stats.latestReports.length > 0 ? stats.latestReports.map((report: any, idx: number) => (
                            <div key={report.id} className="group flex items-start gap-6 p-6 bg-slate-50 rounded-[2rem] hover:bg-white hover:shadow-lg transition-all duration-300 border border-transparent hover:border-slate-100 animate-in slide-in-from-bottom duration-500" style={{ animationDelay: `${idx * 100}ms` }}>
                                <div className="relative">
                                    <img
                                        src={report.user?.avatarUrl || `https://ui-avatars.com/api/?name=${report.user?.name}&background=random`}
                                        alt={report.user?.name}
                                        className="w-12 h-12 rounded-2xl object-cover ring-2 ring-white shadow-md grayscale group-hover:grayscale-0 transition-all duration-500"
                                    />
                                    <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-lg bg-emerald-500 border-2 border-white"></div>
                                </div>
                                <div className="flex-1 space-y-2">
                                    <div className="flex justify-between items-center">
                                        <h4 className="font-black text-slate-800 tracking-tight">{report.user?.name}</h4>
                                        <span className="text-[9px] font-black text-slate-400 uppercase">{new Date(report.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</span>
                                    </div>
                                    <div className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                                        {(() => {
                                            try {
                                                const activities = JSON.parse(report.activitiesJson || '[]');
                                                return activities.map((a: any) => a.activity).join(' • ');
                                            } catch (e) {
                                                return "Report data synchronized.";
                                            }
                                        })()}
                                    </div>
                                    <div className="flex items-center gap-3 pt-1">
                                        <span className="bg-slate-200 text-slate-600 px-2.5 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-widest">{report.user?.role}</span>
                                        <span className="text-[9px] font-black text-blue-500 italic uppercase">#{report.id.slice(-4)}</span>
                                    </div>
                                </div>
                            </div>
                        )) : (
                            <div className="py-20 text-center space-y-4">
                                <Activity className="mx-auto text-slate-200 animate-pulse" size={48} />
                                <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Waiting for incoming reports...</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* 2. PROJECT DISTRIBUTION PIE/BAR (simplified) */}
                <div className="bg-slate-900 rounded-[3rem] p-10 text-white shadow-2xl flex flex-col justify-between">
                    <div>
                        <h3 className="text-xl font-black italic uppercase tracking-tight mb-8">Workload Matrix</h3>
                        <div className="space-y-8">
                            {['ON_GOING', 'DONE', 'CANCELLED'].map((status) => {
                                const dist = stats.projectDistribution.find(p => p.status === status);
                                const count = dist?._count?.id || 0;
                                const total = stats.projectDistribution.reduce((acc, curr) => acc + curr._count.id, 0);
                                const pct = total > 0 ? (count / total) * 100 : 0;

                                return (
                                    <div key={status} className="space-y-3">
                                        <div className="flex justify-between items-end">
                                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">{status.replace('_', ' ')}</span>
                                            <span className="text-lg font-black">{count}</span>
                                        </div>
                                        <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
                                            <div
                                                className={`h-full transition-all duration-1000 ${status === 'DONE' ? 'bg-emerald-500' : status === 'ON_GOING' ? 'bg-blue-500' : 'bg-slate-600'}`}
                                                style={{ width: `${pct}%` }}
                                            ></div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div className="pt-10 mt-10 border-t border-white/5 space-y-6">
                        <div className="flex items-center gap-4">
                            <div className="p-2 bg-rose-500/20 text-rose-400 rounded-xl"><AlertTriangle size={20} /></div>
                            <div>
                                <p className="text-[10px] font-black text-slate-500 uppercase">Critical Blockers</p>
                                <p className="text-xl font-black text-rose-400">{overdueProjectsCount} OVERDUE</p>
                            </div>
                        </div>
                        <button
                            onClick={() => router.push('/sdm/owner/projects')}
                            className="w-full py-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all"
                        >
                            Open Roadmap
                        </button>
                    </div>
                </div>
            </div>

            {/* --- ROW 4: FINANCE TRENDS & APPROVALS (Slightly Reduced Size) --- */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">

                {/* Financial Trends Chart */}
                <div className="lg:col-span-8 bg-white rounded-[3rem] p-10 shadow-sm border border-slate-100 overflow-hidden relative">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4">
                        <div>
                            <h3 className="text-2xl font-black text-slate-800 tracking-tight italic uppercase">Cash Flow Trends</h3>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">30 DAY LIQUIDITY RADAR</p>
                        </div>
                        <div className="flex items-center gap-6 bg-slate-50 px-6 py-3 rounded-[2rem] border border-slate-100">
                            <div className="flex items-center gap-2">
                                <div className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]"></div>
                                <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Inflow</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-2.5 h-2.5 rounded-full bg-rose-400 shadow-[0_0_10px_rgba(251,113,133,0.5)]"></div>
                                <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Outflow</span>
                            </div>
                        </div>
                    </div>

                    <div className="h-[320px] w-full mt-6">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={finStats.dailyTrend}>
                                <defs>
                                    <linearGradient id="colorIn" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.15} />
                                        <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="colorOut" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#FB7185" stopOpacity={0.1} />
                                        <stop offset="95%" stopColor="#FB7185" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="5 5" vertical={false} stroke="#F1F5F9" />
                                <XAxis
                                    dataKey="date"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fontSize: 9, fill: '#94A3B8', fontWeight: 900 }}
                                    tickFormatter={(str) => {
                                        const date = new Date(str);
                                        return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }).toUpperCase();
                                    }}
                                />
                                <YAxis
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fontSize: 9, fill: '#94A3B8', fontWeight: 900 }}
                                    tickFormatter={(val) => `Rp${val / 1000000}M`}
                                />
                                <Tooltip
                                    cursor={{ stroke: '#3B82F6', strokeWidth: 1, strokeDasharray: '5 5' }}
                                    contentStyle={{ borderRadius: '24px', border: 'none', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.15)', fontWeight: '900', fontSize: '12px' }}
                                    formatter={(value: any) => [typeof value === 'number' ? formatIDR(value) : 'Rp0', '']}
                                />
                                <Area type="monotone" dataKey="income" stroke="#3B82F6" strokeWidth={4} fillOpacity={1} fill="url(#colorIn)" />
                                <Area type="monotone" dataKey="expense" stroke="#FB7185" strokeWidth={3} fillOpacity={1} fill="url(#colorOut)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* 2. Approval Queue Deep Breakdown */}
                <div className="lg:col-span-4 bg-white rounded-[3rem] p-10 shadow-sm border border-slate-100 flex flex-col justify-between">
                    <div>
                        <div className="flex items-center gap-3 mb-10">
                            <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl shadow-inner"><CheckCircle2 size={24} /></div>
                            <h3 className="text-xl font-black text-slate-800 tracking-tight italic uppercase">Approval Queue</h3>
                        </div>

                        <div className="space-y-6">
                            {stats.recentLeaves.length > 0 ? stats.recentLeaves.map((leave: any, idx: number) => (
                                <div key={leave.id} className="p-5 bg-slate-50 rounded-[1.5rem] border border-slate-100 hover:bg-white hover:border-blue-200 transition-all group animate-in zoom-in duration-300" style={{ animationDelay: `${idx * 150}ms` }}>
                                    <div className="flex justify-between items-start mb-3">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-slate-200 overflow-hidden shadow-sm">
                                                <img src={leave.user?.avatarUrl || `https://ui-avatars.com/api/?name=${leave.user?.name}`} alt="" />
                                            </div>
                                            <p className="text-xs font-black text-slate-800">{leave.user?.name}</p>
                                        </div>
                                        <span className="text-[8px] font-black text-slate-400 bg-white px-2 py-0.5 rounded-md border border-slate-100">PENDING</span>
                                    </div>
                                    <p className="text-[10px] text-slate-500 font-bold line-clamp-1 italic mb-2">"{leave.reason}"</p>
                                    <div className="flex justify-between items-center text-[10px] font-black text-blue-600">
                                        <span>{new Date(leave.startDate).toLocaleDateString()}</span>
                                        <ArrowRight size={14} />
                                    </div>
                                </div>
                            )) : (
                                <div className="py-20 text-center space-y-4 opacity-50">
                                    <div className="w-12 h-12 bg-slate-100 rounded-full mx-auto flex items-center justify-center"><CheckCircle2 size={24} className="text-slate-300" /></div>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Everything Signed</p>
                                </div>
                            )}
                        </div>
                    </div>

                    <button
                        onClick={() => router.push(`/${currentUser?.tenantId || 'sdm'}/owner/requests`)}
                        className="mt-10 w-full py-5 bg-slate-100 text-slate-500 rounded-2xl font-black text-[10px] uppercase tracking-[0.3em] hover:bg-slate-900 hover:text-white transition-all shadow-sm active:scale-95"
                    >
                        Process All ({pendingApprovals})
                    </button>
                </div>
            </div>
        </div>
    );
};

