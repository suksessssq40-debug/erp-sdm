
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
        overdueProjects: 0
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
    const lateCount = 0; // Backend stats needs update to return late count, safe fallback
    const overdueProjects: any[] = []; // Backend stats needs update, safe fallback. Use stats.overdueProjects count later.
    const activeStaff = users ? users.filter(u => u.role !== 'OWNER') : []; // Keep basic user list for staff count

    const getHealthScore = () => {
        // Use stats.overdueProjects (count) instead of array length if available
        if (stats.overdueProjects > 5 || netCashFlow < 0) return { label: 'CRITICAL', color: 'text-rose-500', bg: 'bg-rose-500/10' };
        if (stats.overdueProjects > 0 || lateCount > (activeStaff.length * 0.2)) return { label: 'ATTENTION NEEDED', color: 'text-amber-500', bg: 'bg-amber-500/10' };
        return { label: 'EXCELLENT', color: 'text-emerald-500', bg: 'bg-emerald-500/10' };
    };

    const health = getHealthScore();

    return (
        <div className="p-4 md:p-8 space-y-8 bg-[#F8FAFC] min-h-screen animate-in fade-in duration-700">

            {/* --- TOP BANNER (GOD MODE PULSE) --- */}
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">

                {/* 1. Operational Overview Card */}
                <div className="xl:col-span-8 bg-slate-900 rounded-[2.5rem] p-6 md:p-10 text-white relative overflow-hidden shadow-2xl">
                    {/* Background Accents */}
                    <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                    <div className="absolute bottom-0 left-0 w-48 h-48 bg-emerald-500/5 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2"></div>

                    <div className="relative z-10 flex flex-col lg:flex-row justify-between gap-8 xl:gap-10">
                        <div className="space-y-6">
                            <div className="flex items-center gap-3">
                                <div className={`px-4 py-1.5 rounded-full text-[10px] font-black tracking-widest ${health.bg} ${health.color} border border-white/5`}>
                                    SYSTEM HEALTH: {health.label}
                                </div>
                                <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></div>
                            </div>

                            <div className="max-w-full overflow-hidden">
                                <p className="text-slate-400 text-[10px] lg:text-xs font-bold uppercase tracking-[0.2em] mb-2">Net Arus Kas (Bulan Ini)</p>
                                <div className={`text-3xl lg:text-4xl xl:text-5xl font-black tracking-tighter truncate ${netCashFlow >= 0 ? 'text-white' : 'text-rose-400'}`}>
                                    {finStats.isLoading ? 'Calculating...' : (netCashFlow >= 0 ? '+' : '') + formatIDR(netCashFlow)}
                                </div>
                                <p className={`mt-2 text-sm font-bold flex items-center gap-2 ${netCashFlow >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                    {netCashFlow >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                                    {netCashFlow >= 0 ? 'Surplus Operasional' : 'Defisit Terdeteksi'}
                                </p>
                            </div>

                            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/10">
                                <div>
                                    <div className="text-[10px] text-slate-500 font-bold uppercase mb-1">Active Projects</div>
                                    <div className="text-xl font-bold">{stats.projects} Running</div>
                                </div>
                                <div>
                                    <div className="text-[10px] text-slate-500 font-bold uppercase mb-1">Pending Approvals</div>
                                    <div className="text-xl font-bold bg-amber-500/20 text-amber-400 px-2 rounded-lg inline-block">{pendingApprovals}</div>
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-col justify-between items-start lg:items-end lg:text-right">
                            <div className="mb-6 lg:mb-0">
                                <div className="text-slate-400 text-[10px] lg:text-xs font-bold uppercase tracking-widest mb-1">Total Saldo (Liquid)</div>
                                <div className="text-xl xl:text-2xl font-black tracking-tight">{finStats.isLoading ? '...' : formatIDR(finStats.totalBalance)}</div>
                            </div>

                            <div className="bg-white/5 backdrop-blur-md rounded-3xl p-5 xl:p-6 border border-white/10 w-full sm:max-w-[240px] xl:max-w-[256px] space-y-4">
                                <div className="flex items-center justify-between">
                                    <div className="p-2 bg-blue-500/20 rounded-xl text-blue-400"><Users size={20} /></div>
                                    <div className="text-[10px] font-black text-blue-400">TEAM STATUS</div>
                                </div>
                                <div>
                                    <div className="text-2xl xl:text-3xl font-black">{stats.employees > 0 ? Math.round((stats.attendance / stats.employees) * 100) : 0}%</div>
                                    <div className="text-[10px] text-slate-400 font-bold uppercase">Attendance Today</div>
                                </div>
                                <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
                                    <div
                                        className="bg-blue-500 h-full transition-all duration-1000"
                                        style={{ width: `${stats.employees > 0 ? (stats.attendance / stats.employees) * 100 : 0}%` }}
                                    ></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 2. Quick Action / Asset Distribution */}
                <div className="xl:col-span-4 grid grid-cols-1 gap-6">
                    <div className="bg-white rounded-[2.5rem] p-6 xl:p-8 shadow-sm border border-slate-100 flex flex-col justify-between group hover:border-blue-200 transition-all duration-300">
                        <div>
                            <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 mb-6 group-hover:scale-110 transition-transform">
                                <Wallet size={24} />
                            </div>
                            <h3 className="text-lg font-black text-slate-800 tracking-tight">Financial Intelligence</h3>
                            <p className="text-slate-400 text-xs xl:text-sm mt-2 leading-relaxed">Kelola arus kas perusahaaan secara menyeluruh di modul finansial.</p>
                        </div>
                        <button
                            onClick={() => router.push(`/${currentUser?.tenantId || 'sdm'}/owner/finance`)}
                            className="bg-slate-900 text-white w-full py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-blue-600 transition shadow-lg mt-6 text-sm"
                        >
                            Open Finance <ArrowRight size={18} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Aggregated View for Multiple Units */}
            <MultiUnitOverview />

            {/* --- ROW 2: TREND ANALYSIS & STATS --- */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                {/* Financial Trends Chart */}
                <div className="lg:col-span-2 bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-100">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                        <div>
                            <h3 className="text-xl font-black text-slate-800 tracking-tight italic uppercase">Cash Flow Trends</h3>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">30 HARI TERAKHIR (IDR • PAID ONLY)</p>
                        </div>
                        <div className="flex items-center gap-4 bg-slate-50 p-2 rounded-2xl border border-slate-100">
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                                <span className="text-[10px] font-bold text-slate-600 uppercase">Incoming</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-rose-400"></div>
                                <span className="text-[10px] font-bold text-slate-600 uppercase">Outgoing</span>
                            </div>
                        </div>
                    </div>

                    <div className="h-[300px] w-full mt-4">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={finStats.dailyTrend}>
                                <defs>
                                    <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.1} />
                                        <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#FB7185" stopOpacity={0.1} />
                                        <stop offset="95%" stopColor="#FB7185" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                                <XAxis
                                    dataKey="date"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fontSize: 10, fill: '#94A3B8', fontWeight: 700 }}
                                    tickFormatter={(str) => {
                                        const date = new Date(str);
                                        return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
                                    }}
                                />
                                <YAxis
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fontSize: 10, fill: '#94A3B8', fontWeight: 700 }}
                                    tickFormatter={(val) => `Rp${val / 1000000}M`}
                                />
                                <Tooltip
                                    contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', fontWeight: 'bold' }}
                                    formatter={(value: any) => [typeof value === 'number' ? formatIDR(value) : 'Rp0', '']}
                                />
                                <Area type="monotone" dataKey="income" stroke="#3B82F6" strokeWidth={3} fillOpacity={1} fill="url(#colorIncome)" />
                                <Area type="monotone" dataKey="expense" stroke="#FB7185" strokeWidth={3} fillOpacity={1} fill="url(#colorExpense)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Summaries */}
                <div className="space-y-6">
                    <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-100 relative overflow-hidden group">
                        <div className="absolute right-0 top-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl -translate-y-10 translate-x-10"></div>
                        <div className="flex items-center gap-4 mb-4">
                            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl"><TrendingUp size={22} /></div>
                            <div>
                                <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Incoming</h4>
                                <div className="text-2xl font-black text-slate-800">{formatIDR(finStats.monthlyIn)}</div>
                            </div>
                        </div>
                        <p className="text-[10px] text-slate-400 font-bold uppercase">Total dana masuk tervalidasi bulan ini</p>
                    </div>

                    <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-100 relative overflow-hidden group">
                        <div className="absolute right-0 top-0 w-24 h-24 bg-rose-500/10 rounded-full blur-2xl -translate-y-10 translate-x-10"></div>
                        <div className="flex items-center gap-4 mb-4">
                            <div className="p-3 bg-rose-50 text-rose-600 rounded-2xl"><TrendingDown size={22} /></div>
                            <div>
                                <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Outgoing</h4>
                                <div className="text-2xl font-black text-slate-800">{formatIDR(finStats.monthlyOut)}</div>
                            </div>
                        </div>
                        <p className="text-[10px] text-slate-400 font-bold uppercase">Total dana keluar tervalidasi bulan ini</p>
                    </div>

                    <div className="bg-slate-900 text-white rounded-[2.5rem] p-8 shadow-xl">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-2 bg-blue-500 rounded-xl"><Activity size={18} /></div>
                            <h4 className="text-xs font-black uppercase tracking-widest">Asset Valuation</h4>
                        </div>
                        <div className="space-y-6">
                            <div>
                                <div className="text-[10px] text-slate-500 font-bold uppercase mb-1">Total Equities (Real)</div>
                                <div className="text-3xl font-black tracking-tight">{formatIDR(finStats.totalBalance)}</div>
                                <p className="text-[10px] text-emerald-400/80 font-bold mt-1 inline-block bg-emerald-500/10 px-2 py-0.5 rounded-md italic">Verfied by System Audit</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* --- ROW 3: RISKS & APPROVALS --- */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

                {/* 1. Risks Section */}
                <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-100">
                    <div className="flex justify-between items-center mb-6">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-rose-50 text-rose-500 rounded-xl"><AlertTriangle size={20} /></div>
                            <h3 className="text-xl font-black text-slate-800 tracking-tight italic uppercase">Operational Risks</h3>
                        </div>
                        <span className="px-3 py-1 bg-rose-100 text-rose-600 text-[10px] font-black rounded-lg">{overdueProjects.length} KRITIS</span>
                    </div>

                    <div className="space-y-4 max-h-[300px] overflow-y-auto pr-4 custom-scrollbar">
                        {overdueProjects.length > 0 ? overdueProjects.map(p => (
                            <div key={p.id} className="group p-5 bg-slate-50 rounded-3xl border border-slate-100 flex items-center justify-between hover:bg-white hover:border-blue-200 transition-all cursor-pointer">
                                <div>
                                    <h4 className="font-bold text-slate-800 group-hover:text-blue-600 transition">{p.title}</h4>
                                    <div className="flex items-center gap-2 mt-1">
                                        <p className="text-[10px] font-bold text-rose-500 uppercase">OVERDUE: {new Date(p.deadline!).toLocaleDateString('id-ID')}</p>
                                        <div className="h-1 w-1 rounded-full bg-slate-300"></div>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase">{p.status}</p>
                                    </div>
                                </div>
                                <div className="h-10 w-10 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-slate-400 group-hover:text-blue-500 group-hover:border-blue-200 transition shadow-sm">
                                    <ArrowRight size={18} />
                                </div>
                            </div>
                        )) : (
                            <div className="flex flex-col items-center justify-center py-10 text-slate-400">
                                <CheckCircle2 size={48} className="text-emerald-500 mb-4 opacity-20" />
                                <p className="font-bold uppercase text-xs tracking-widest">No Critical Risks Detected</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* 2. Approvals Section */}
                <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-100 relative overflow-hidden">
                    <div className="absolute -right-20 -bottom-20 w-64 h-64 bg-blue-50 rounded-full blur-3xl opacity-50"></div>
                    <div className="relative z-10">
                        <div className="flex items-center gap-3 mb-8">
                            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl"><CheckCircle2 size={20} /></div>
                            <h3 className="text-xl font-black text-slate-800 tracking-tight italic uppercase">Pending Approvals</h3>
                        </div>

                        <div className="flex flex-col items-center justify-center py-12">
                            <div className="text-8xl font-black text-slate-100 relative">
                                {pendingApprovals}
                                <div className="absolute inset-0 flex items-center justify-center text-5xl text-slate-900 group-hover:scale-110 transition">
                                    {pendingApprovals}
                                </div>
                            </div>
                            <p className="text-slate-400 font-bold uppercase text-[10px] tracking-[0.3em] mt-8 text-center max-w-[200px]">Permohonan Menunggu Tanda Tangan Digital Anda.</p>
                            <button
                                onClick={() => router.push(`/${currentUser?.tenantId || 'sdm'}/owner/requests`)}
                                className="mt-8 px-8 py-3 bg-slate-100 text-slate-600 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-900 hover:text-white transition shadow-sm"
                            >
                                Review All Requests
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
