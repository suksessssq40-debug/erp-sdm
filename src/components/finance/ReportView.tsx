import React, { useMemo } from 'react';
import { Transaction, TransactionType } from '../../types';
import { formatCurrency } from '../../utils';
import { PieChart, TrendingUp, TrendingDown, ArrowUp, ArrowDown } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface ReportViewProps {
  transactions: Transaction[];
  summary: any; // Using any for summary structure from API or define interface
  MONTHS: string[];
}

export const ReportView: React.FC<ReportViewProps> = ({ transactions, summary, MONTHS }) => {

  const chartData = useMemo(() => {
     // Config Chart: Group Only current viewed transactions? 
     // Or we want Daily aggregation.
     const dailyStats: Record<string, { date: string; income: number; expense: number }> = {};
     
     transactions.forEach(t => {
         const d = new Date(t.date).getDate(); 
         const key = d.toString();
         if (!dailyStats[key]) dailyStats[key] = { date: key, income: 0, expense: 0 };
         if (t.type === TransactionType.IN) dailyStats[key].income += t.amount;
         else dailyStats[key].expense += t.amount;
     });
     
     // Fill missing days? Optional.
     return Object.values(dailyStats).sort((a,b) => parseInt(a.date) - parseInt(b.date));
  }, [transactions]);
    
  return (
    <div className="space-y-6 animate-in zoom-in duration-500">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-1 bg-white p-8 rounded-[2.5rem] shadow-xl border border-slate-50 flex flex-col justify-between group hover:border-blue-200 transition">
                <div>
                <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-500 mb-6 group-hover:bg-emerald-500 group-hover:text-white transition">
                    <TrendingUp size={24} />
                </div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">TOTAL INCOME (BULAN INI)</p>
                <h3 className="text-3xl font-black text-slate-800 mt-2 tracking-tight">{formatCurrency(summary?.monthStats.income || 0)}</h3>
                </div>
                <div className="mt-8 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-emerald-600 bg-emerald-50 py-2 px-4 rounded-xl w-fit">
                    <ArrowUp size={12} /> <span className="mt-[2px]">CASH FLOW POSITIF</span>
                </div>
            </div>

            <div className="md:col-span-1 bg-white p-8 rounded-[2.5rem] shadow-xl border border-slate-50 flex flex-col justify-between group hover:border-rose-200 transition">
                <div>
                <div className="w-12 h-12 bg-rose-50 rounded-2xl flex items-center justify-center text-rose-500 mb-6 group-hover:bg-rose-500 group-hover:text-white transition">
                    <TrendingDown size={24} />
                </div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">TOTAL EXPENSE (BULAN INI)</p>
                <h3 className="text-3xl font-black text-slate-800 mt-2 tracking-tight">{formatCurrency(summary?.monthStats.expense || 0)}</h3>
                </div>
                <div className="mt-8 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-rose-600 bg-rose-50 py-2 px-4 rounded-xl w-fit">
                    <ArrowDown size={12} /> <span className="mt-[2px]">OUTFLOW</span>
                </div>
            </div>

            <div className="md:col-span-1 bg-slate-900 p-8 rounded-[2.5rem] shadow-2xl text-white relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/30 blur-3xl rounded-full"></div>
                <div className="relative z-10 h-full flex flex-col justify-between">
                <div>
                    <PieChart size={32} className="text-indigo-400 mb-6" />
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">NET PROFIT / LOSS</p>
                    <h3 className={`text-4xl font-black mt-2 tracking-tight ${(summary?.monthStats.income || 0) - (summary?.monthStats.expense || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {formatCurrency((summary?.monthStats.income || 0) - (summary?.monthStats.expense || 0))}
                    </h3>
                </div>
                <p className="text-[10px] text-slate-400 font-bold leading-relaxed mt-4">
                    "Laporan ini menunjukkan kinerja keuangan bersih Anda periode ini. Jaga Expense tetap rendah."
                </p>
                </div>
            </div>
        </div>

        <div className="bg-white p-8 rounded-[3rem] shadow-xl border border-slate-100">
            <h4 className="text-xl font-black text-slate-800 uppercase italic mb-8 ml-4">Analitik Harian (Income vs Expense)</h4>
            <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94a3b8', fontWeight: 900}} dy={10} />
                        <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94a3b8', fontWeight: 900}} tickFormatter={(val) => `${val/1000}k`} />
                        <Tooltip 
                            cursor={{fill: '#f8fafc'}}
                            contentStyle={{borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}}
                            itemStyle={{fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase'}}
                        />
                        <Bar dataKey="income" name="Pemasukan" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={40} />
                        <Bar dataKey="expense" name="Pengeluaran" fill="#f43f5e" radius={[4, 4, 0, 0]} maxBarSize={40} />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    </div>
  );
};
