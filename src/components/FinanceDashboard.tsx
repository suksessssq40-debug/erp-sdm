import React, { useState, useEffect } from 'react';
import { useAppStore } from '../context/StoreContext';
import { Wallet, TrendingUp, TrendingDown, CreditCard, Clock, CheckCircle2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

export const FinanceDashboard = () => {
    const { currentUser, transactions, financialAccounts, attendance } = useAppStore();
    const router = useRouter();

    // --- 1. PERSONAL TIMER LOGIC ---
    const [elapsedTime, setElapsedTime] = useState<string>('00:00:00');

    const todayStr = new Date().toDateString();
    const myAttendance = attendance.find(a => new Date(a.date!).toDateString() === todayStr && a.userId === currentUser?.id);
    const isCheckedIn = !!myAttendance;
    const isCheckedOut = !!myAttendance?.timeOut;

    useEffect(() => {
        const updateTimer = () => {
            if (myAttendance && myAttendance.timeIn && typeof myAttendance.timeIn === 'string') {
                try {
                    const now = new Date();
                    const timeParts = myAttendance.timeIn.split(':');
                    if (timeParts.length < 2) return;

                    const [hrs, mins, secs] = timeParts.map(Number);
                    const startTime = new Date();
                    startTime.setHours(hrs || 0, mins || 0, secs || 0, 0);

                    const end = isCheckedOut && myAttendance.timeOut && typeof myAttendance.timeOut === 'string'
                        ? (() => {
                            const outParts = myAttendance.timeOut.split(':');
                            const [outHrs, outMins, outSecs] = outParts.map(Number);
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
                    console.error("Timer error:", e);
                }
            }
        };
        const interval = setInterval(updateTimer, 1000);
        updateTimer();
        return () => clearInterval(interval);
    }, [myAttendance, isCheckedOut]);

    // --- 2. FINANCIAL STATS ---
    const todayIso = new Date().toISOString().split('T')[0];
    // Safety: Filter transactions only if they are an array and have valid dates
    const safeTransactions = Array.isArray(transactions) ? transactions : [];
    const todayTrans = safeTransactions.filter(t =>
        t.date &&
        typeof t.date === 'string' &&
        t.date.startsWith(todayIso) &&
        t.status === 'PAID' &&
        t.accountId // Must be Cash/Bank
    );
    const todayIn = todayTrans.filter(t => t.type === 'IN').reduce((s, t) => s + (Number(t.amount) || 0), 0);
    const todayOut = todayTrans.filter(t => t.type === 'OUT').reduce((s, t) => s + (Number(t.amount) || 0), 0);

    const formatIDR = (n: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);

    return (
        <div className="space-y-8 animate-in fade-in duration-500 pb-20">

            {/* SECTION 1: MY WORKSPACE (PERSONAL) */}
            <div className="bg-gradient-to-br from-emerald-900 to-emerald-800 rounded-[2.5rem] p-8 text-white relative overflow-hidden shadow-2xl">
                <div className="absolute right-0 top-0 w-96 h-96 bg-emerald-500/20 rounded-full blur-3xl translate-x-20 -translate-y-20"></div>
                <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-6">
                    <div>
                        <div className="flex items-center gap-2 mb-2 text-emerald-300 font-bold uppercase tracking-widest text-xs">
                            <Wallet size={14} /> FINANCE WORKSPACE
                        </div>
                        <h1 className="text-4xl font-black font-mono mb-2">{isCheckedIn && myAttendance?.timeIn ? elapsedTime : '00:00:00'}</h1>
                        <p className="text-emerald-100/50 text-sm flex items-center gap-2">
                            {isCheckedIn ? '⏱️ Durasi kerja Anda hari ini' : '👋 Halo Finance, absen dulu sebelum urus uang!'}
                        </p>
                    </div>
                    <div>
                        {!isCheckedIn ? (
                            <button onClick={() => router.push(`/${currentUser?.tenantId || 'sdm'}/${currentUser?.role.toLowerCase()}/attendance`)} className="px-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-white rounded-xl font-bold text-sm uppercase tracking-widest shadow-lg transition">
                                <Clock className="inline mr-2" size={18} /> Absen Masuk
                            </button>
                        ) : (
                            <div className={`px-6 py-3 rounded-xl border flex items-center gap-3 ${isCheckedOut ? 'bg-white/10 border-white/20 text-white' : 'bg-emerald-400/20 border-emerald-400/50 text-emerald-200'}`}>
                                <CheckCircle2 size={20} />
                                <span className="font-bold text-sm uppercase tracking-widest">
                                    {isCheckedOut ? 'Sudah Pulang' : 'Sedang Bekerja'}
                                </span>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* SECTION 2: FINANCIAL CONTROL CENTER */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Income Today */}
                <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm relative overflow-hidden">
                    <div className="flex items-center gap-3 mb-4 text-emerald-600">
                        <div className="p-2 bg-emerald-50 rounded-lg"><TrendingUp size={20} /></div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">PEMASUKAN HARI INI</span>
                    </div>
                    <div className="text-3xl font-black text-slate-800">{formatIDR(todayIn)}</div>
                </div>

                {/* Expense Today */}
                <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm relative overflow-hidden">
                    <div className="flex items-center gap-3 mb-4 text-rose-600">
                        <div className="p-2 bg-rose-50 rounded-lg"><TrendingDown size={20} /></div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">PENGELUARAN HARI INI</span>
                    </div>
                    <div className="text-3xl font-black text-slate-800">{formatIDR(todayOut)}</div>
                </div>

                {/* Recent Trans */}
                <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm relative overflow-hidden row-span-2">
                    <div className="flex items-center gap-3 mb-6 text-blue-600">
                        <div className="p-2 bg-blue-50 rounded-lg"><CreditCard size={20} /></div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">TRANSAKSI TERAKHIR</span>
                    </div>
                    <div className="space-y-6">
                        {safeTransactions.slice(0, 5).map(t => (
                            <div key={t.id} className="flex justify-between items-start text-sm group">
                                <div>
                                    <div className="font-bold text-slate-700 w-32 line-clamp-1 group-hover:text-blue-600 transition">{t.description}</div>
                                    <div className="text-[10px] text-slate-400 font-medium uppercase mt-0.5">{t.category}</div>
                                </div>
                                <div className={`font-black ${t.type === 'IN' ? 'text-emerald-600' : 'text-rose-600'}`}>
                                    {t.type === 'IN' ? '+' : '-'}{formatIDR(t.amount)}
                                </div>
                            </div>
                        ))}
                        {safeTransactions.length === 0 && <p className="text-xs text-slate-400 italic">Belum ada transaksi.</p>}
                    </div>
                    <button onClick={() => router.push(`/${currentUser?.tenantId || 'sdm'}/${currentUser?.role.toLowerCase()}/finance`)} className="w-full mt-6 py-3 bg-slate-50 text-slate-600 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-slate-100 transition">
                        Lihat Semua
                    </button>
                </div>
            </div>
        </div>
    );
};
