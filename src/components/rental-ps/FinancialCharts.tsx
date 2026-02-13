
import React from 'react';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    BarChart, Bar, Cell
} from 'recharts';
import { TrendingUp, CreditCard, Banknote, Users } from 'lucide-react';

interface ChartProps {
    trendData: { date: string, value: number }[];
    stats: {
        totalRevenue: number,
        totalCash: number,
        totalTransfer: number,
        count: number
    };
}

export const FinancialCharts: React.FC<ChartProps> = ({ trendData, stats }) => {
    return (
        <div className="space-y-6 animate-in slide-in-from-top duration-700">
            {/* TOP CARDS */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="col-span-2 bg-white p-6 md:p-8 rounded-[2rem] md:rounded-[2.5rem] shadow-xl border border-slate-50 relative overflow-hidden group">
                    <div className="absolute -right-4 -top-4 p-4 opacity-[0.03] group-hover:scale-110 transition-transform duration-700">
                        <TrendingUp size={120} />
                    </div>
                    <p className="text-[10px] md:text-[11px] font-black text-slate-400 uppercase tracking-widest">Total Reservasi</p>
                    <h4 className="text-2xl md:text-3xl font-black text-slate-900 mt-2 italic tracking-tighter">Rp {stats.totalRevenue.toLocaleString()}</h4>
                </div>

                <div className="bg-white p-5 md:p-6 rounded-[2rem] shadow-sm border border-slate-50 flex items-center gap-3">
                    <div className="p-2 md:p-3 bg-emerald-50 text-emerald-500 rounded-xl">
                        <Banknote size={16} className="md:size-[20px]" />
                    </div>
                    <div className="min-w-0">
                        <p className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest truncate">Tunai</p>
                        <h4 className="text-sm md:text-lg font-black text-slate-800 italic">Rp {stats.totalCash.toLocaleString()}</h4>
                    </div>
                </div>

                <div className="bg-white p-5 md:p-6 rounded-[2rem] shadow-sm border border-slate-50 flex items-center gap-3">
                    <div className="p-2 md:p-3 bg-blue-50 text-blue-500 rounded-xl">
                        <CreditCard size={16} className="md:size-[20px]" />
                    </div>
                    <div className="min-w-0">
                        <p className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest truncate">Bank</p>
                        <h4 className="text-sm md:text-lg font-black text-slate-800 italic">Rp {stats.totalTransfer.toLocaleString()}</h4>
                    </div>
                </div>

                <div className="col-span-2 lg:col-span-1 bg-white p-5 md:p-6 rounded-[2rem] shadow-sm border border-slate-50 flex items-center justify-between lg:justify-start lg:gap-3">
                    <div className="flex items-center gap-3">
                        <div className="p-2 md:p-3 bg-slate-50 text-slate-500 rounded-xl">
                            <Users size={16} className="md:size-[20px]" />
                        </div>
                        <div>
                            <p className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest">Transaksi</p>
                            <h4 className="text-sm md:text-lg font-black text-slate-800 italic">{stats.count} Sesi</h4>
                        </div>
                    </div>
                    {/* Visual indicator for mobile */}
                    <div className="lg:hidden flex -space-x-2">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="w-6 h-6 rounded-full border-2 border-white bg-slate-100 flex items-center justify-center text-[8px] font-black text-slate-400">
                                {i}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* CHART AREA */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-white p-6 md:p-10 rounded-[2.5rem] md:rounded-[3rem] shadow-xl border border-slate-100 italic transition-all">
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h3 className="text-xs md:text-sm font-black text-slate-800 uppercase">Trend Pendapatan</h3>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Grafik fluktuasi harian</p>
                        </div>
                        <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-blue-50 text-blue-600 rounded-lg text-[9px] font-black uppercase">
                            <TrendingUp size={12} /> Live Data
                        </div>
                    </div>

                    <div className="h-[200px] md:h-[280px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={trendData}>
                                <defs>
                                    <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis
                                    dataKey="date"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fontSize: 9, fontWeight: '800', fill: '#94a3b8' }}
                                    tickFormatter={(val: string) => val.split('-').slice(1).reverse().join('/')}
                                />
                                <YAxis hide />
                                <Tooltip
                                    contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', fontSize: '12px', fontWeight: 'bold' }}
                                />
                                <Area type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={4} fillOpacity={1} fill="url(#colorValue)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="bg-white p-8 md:p-10 rounded-[2.5rem] md:rounded-[3rem] shadow-xl border border-slate-100 flex flex-col items-center justify-center">
                    <h3 className="text-xs md:text-sm font-black text-slate-800 uppercase italic mb-8">Komposisi Kas</h3>
                    <div className="h-[180px] md:h-[220px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={[
                                { name: 'Cash', value: stats.totalCash, color: '#10b981' },
                                { name: 'TF', value: stats.totalTransfer, color: '#3b82f6' }
                            ]}>
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: '800' }} />
                                <Tooltip cursor={{ fill: 'transparent' }} />
                                <Bar dataKey="value" radius={[10, 10, 0, 0]}>
                                    {[0, 1].map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={index === 0 ? '#10b981' : '#3b82f6'} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="mt-8 flex flex-col gap-2 w-full">
                        <div className="flex justify-between items-center text-[10px] font-black uppercase">
                            <span className="text-slate-400">Cash Ratio</span>
                            <span className="text-emerald-500 font-bold tracking-tighter">{Math.round((stats.totalCash / (stats.totalRevenue || 1)) * 100)}%</span>
                        </div>
                        <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                            <div className="bg-emerald-500 h-full transition-all duration-1000" style={{ width: `${(stats.totalCash / (stats.totalRevenue || 1)) * 100}%` }} />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
