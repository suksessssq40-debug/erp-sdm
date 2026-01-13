import React, { useState, useEffect } from 'react';
import { useAppStore } from '../context/StoreContext';
import { 
  Users, 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  Wallet, 
  CheckCircle2, 
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  Activity
} from 'lucide-react';
import { useRouter } from 'next/navigation';

export const OwnerDashboard = () => {
    const { currentUser, attendance, projects, requests, users } = useAppStore();
    const router = useRouter();
    
    // --- 1. PERSONAL TIMER LOGIC ---
    const [elapsedTime, setElapsedTime] = useState<string>('00:00:00');
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
                } catch(e) { console.error(e) }
            }
        };
        const interval = setInterval(updateTimer, 1000);
        updateTimer();
        return () => clearInterval(interval);
    }, [myAttendance, isCheckedOut]);


    // --- 2. FINANCIAL REAL-TIME STATS ---
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

    // --- 3. SDM & OPS INTELLIGENCE ---
    const activeStaff = users.filter(u => u.role !== 'OWNER' && u.role !== 'SUPERADMIN');
    const todayTeamAttendance = attendance.filter(a => {
        const isToday = new Date(a.date!).toDateString() === todayStr;
        const isStaff = activeStaff.some(u => u.id === a.userId);
        return isToday && isStaff; 
    });
    const lateCount = todayTeamAttendance.filter(a => a.isLate).length;
    const absentCount = activeStaff.length - todayTeamAttendance.length;

    const overdueProjects = projects.filter(p => p.deadline && new Date(p.deadline) < new Date() && p.status !== 'DONE');
    const pendingApprovals = requests.filter(r => r.status === 'PENDING').length;

    const formatIDR = (n: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);

    return (
        <div className="space-y-8 animate-in fade-in duration-500 pb-20">
            {/* ROW 1: GOD MODE HEADER (Timer + Quick Status) */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 rounded-[2.5rem] p-8 text-white relative overflow-hidden shadow-2xl">
                     <div className="absolute right-0 top-0 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl translate-x-10 -translate-y-10"></div>
                     <div className="relative z-10 flex justify-between items-center">
                         <div>
                             <div className="flex items-center gap-2 mb-2 text-blue-400 font-bold uppercase tracking-widest text-xs">
                                 <Activity size={14} /> COMMAND CENTER
                             </div>
                             <h1 className="text-5xl font-black font-mono tracking-tight mb-2">
                                {isCheckedIn ? elapsedTime : '00:00:00'}
                             </h1>
                             <div className="flex items-center gap-4 text-sm text-slate-400 font-medium">
                                 <span>{new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
                                 <span>•</span>
                                 <span className={isCheckedIn ? 'text-emerald-400' : 'text-slate-500'}>
                                     {isCheckedIn ? 'Logged In' : 'Not Logged In'}
                                 </span>
                             </div>
                         </div>
                         <div>
                             {!isCheckedIn ? (
                                <button onClick={() => router.push(`/${currentUser?.role.toLowerCase()}/attendance`)} className="h-14 w-14 rounded-full bg-blue-600 hover:bg-blue-500 flex items-center justify-center shadow-lg shadow-blue-600/20 transition">
                                    <Clock size={24} />
                                </button>
                             ) : (
                                <div className="h-14 w-14 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                                    <CheckCircle2 size={24} />
                                </div>
                             )}
                         </div>
                     </div>
                </div>

                {/* Quick SDM Health */}
                <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col justify-center">
                    <div className="mb-4 flex items-center gap-2 text-slate-400 font-bold text-xs uppercase tracking-widest">
                        <Users size={16} /> Kehadiran Tim
                    </div>
                    <div className="flex items-end gap-3">
                        <div className="text-4xl font-black text-slate-800">{todayTeamAttendance.length}<span className="text-lg text-slate-300">/{activeStaff.length}</span></div>
                    </div>
                    <div className="mt-4 flex gap-2">
                        {lateCount > 0 && <span className="px-3 py-1 bg-rose-50 text-rose-600 rounded-lg text-xs font-bold">{lateCount} Terlambat</span>}
                        {absentCount > 0 && <span className="px-3 py-1 bg-slate-50 text-slate-500 rounded-lg text-xs font-bold">{absentCount} Belum Hadir</span>}
                        {lateCount === 0 && absentCount === 0 && <span className="px-3 py-1 bg-emerald-50 text-emerald-600 rounded-lg text-xs font-bold">Full Team!</span>}
                        <button onClick={() => router.push('/manager/attendance')} className="ml-auto text-xs font-bold text-blue-600">Detail</button>
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
                        <div className="bg-emerald-50 p-2 rounded-full text-emerald-600 opacity-0 group-hover:opacity-100 transition"><ArrowUpRight size={16} /></div>
                    </div>
                    <div className="text-2xl font-black text-slate-800">{finStats.isLoading ? '...' : formatIDR(finStats.monthlyIn)}</div>
                </div>

                <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm group hover:shadow-md transition">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2 text-slate-400 font-bold text-xs uppercase tracking-widest">
                            <TrendingDown size={16} className="text-rose-500" /> Keluar Bln Ini
                        </div>
                        <div className="bg-rose-50 p-2 rounded-full text-rose-600 opacity-0 group-hover:opacity-100 transition"><ArrowDownRight size={16} /></div>
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
