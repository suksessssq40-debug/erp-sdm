import React, { useMemo } from 'react';
import { Transaction, TransactionType } from '../../types';
import { formatCurrency } from '../../utils';
import { PieChart, TrendingUp, TrendingDown, ArrowUp, ArrowDown } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface ReportViewProps {
    transactions: Transaction[];
    summary: any;
    MONTHS: string[];
}

export const ReportView: React.FC<ReportViewProps> = ({ transactions, summary }) => {

    const { revenueItems, expenseItems, totalRevenue, totalExpense } = useMemo(() => {
        const revs: Record<string, number> = {};
        const exps: Record<string, number> = {};
        let totalRev = 0;
        let totalExp = 0;

        transactions.forEach(t => {
            const amount = Number(t.amount);
            const coaType = t.coa?.type;
            const isRevenue = coaType === 'REVENUE' || coaType === 'INCOME';
            const isExpense = coaType === 'EXPENSE';

            if (isRevenue) {
                const cat = t.category || 'Lain-lain';
                const val = t.type === TransactionType.IN ? amount : -amount;
                revs[cat] = (revs[cat] || 0) + val;
                totalRev += val;
            } else if (isExpense) {
                const cat = t.category || 'Lain-lain';
                const val = t.type === TransactionType.OUT ? amount : -amount;
                exps[cat] = (exps[cat] || 0) + val;
                totalExp += val;
            } else if (!coaType) {
                if (t.type === TransactionType.IN) {
                    const cat = t.category || 'Pemasukan';
                    revs[cat] = (revs[cat] || 0) + amount;
                    totalRev += amount;
                } else {
                    const cat = t.category || 'Pengeluaran';
                    exps[cat] = (exps[cat] || 0) + amount;
                    totalExp += amount;
                }
            }
        });

        return { revenueItems: revs, expenseItems: exps, totalRevenue: totalRev, totalExpense: totalExp };
    }, [transactions]);

    const chartData = useMemo(() => {
        const dailyStats: Record<string, { date: string; income: number; expense: number }> = {};
        transactions.forEach(t => {
            const d = new Date(t.date).getDate();
            const key = d.toString();
            if (!dailyStats[key]) dailyStats[key] = { date: key, income: 0, expense: 0 };

            const amount = Number(t.amount);
            const coaType = t.coa?.type;
            if (coaType === 'REVENUE' || coaType === 'INCOME' || (!coaType && t.type === TransactionType.IN)) {
                dailyStats[key].income += amount;
            } else if (coaType === 'EXPENSE' || (!coaType && t.type === TransactionType.OUT)) {
                dailyStats[key].expense += amount;
            }
        });
        return Object.values(dailyStats).sort((a, b) => parseInt(a.date) - parseInt(b.date));
    }, [transactions]);

    const netProfit = totalRevenue - totalExpense;

    return (
        <div className="space-y-6 animate-in zoom-in duration-500">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-1 bg-white p-8 rounded-[2.5rem] shadow-xl border border-slate-50 flex flex-col justify-between group hover:border-emerald-200 transition">
                    <div>
                        <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-500 mb-6 group-hover:bg-emerald-500 group-hover:text-white transition">
                            <TrendingUp size={24} />
                        </div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">TOTAL REVENUE</p>
                        <h3 className="text-3xl font-black text-slate-800 mt-3 tracking-tighter tabular-nums">{formatCurrency(totalRevenue)}</h3>
                    </div>
                    <div className="mt-8 flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-emerald-600 bg-emerald-50 py-2.5 px-4 rounded-xl w-fit">
                        <ArrowUp size={12} /> <span className="mt-[2px]">INCOME STREAMS</span>
                    </div>
                </div>

                <div className="md:col-span-1 bg-white p-8 rounded-[2.5rem] shadow-xl border border-slate-50 flex flex-col justify-between group hover:border-rose-200 transition">
                    <div>
                        <div className="w-12 h-12 bg-rose-50 rounded-2xl flex items-center justify-center text-rose-500 mb-6 group-hover:bg-rose-500 group-hover:text-white transition">
                            <TrendingDown size={24} />
                        </div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">TOTAL OPERATING EXPENSE</p>
                        <h3 className="text-3xl font-black text-slate-800 mt-3 tracking-tighter tabular-nums">{formatCurrency(totalExpense)}</h3>
                    </div>
                    <div className="mt-8 flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-rose-600 bg-rose-50 py-2.5 px-4 rounded-xl w-fit">
                        <ArrowDown size={12} /> <span className="mt-[2px]">COST CONTROL</span>
                    </div>
                </div>

                <div className="md:col-span-1 bg-slate-900 p-8 rounded-[2.5rem] shadow-2xl text-white relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-48 h-48 bg-blue-600/20 blur-3xl rounded-full group-hover:bg-blue-600/30 transition-all duration-700"></div>
                    <div className="relative z-10 h-full flex flex-col justify-between">
                        <div>
                            <PieChart size={32} className="text-blue-400 mb-6" />
                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none">LABA / RUGI BERSIH (EBIT)</p>
                            <h3 className={`text-4xl font-black mt-3 tracking-tighter tabular-nums ${netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {formatCurrency(netProfit)}
                            </h3>
                        </div>
                        <div className="mt-6 p-4 bg-white/5 rounded-2xl border border-white/5">
                            <p className="text-[9px] text-slate-400 font-bold leading-relaxed italic">
                                "Laporan laba rugi ini mencerminkan kinerja operasional dari seluruh unit bisnis yang terdaftar."
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-white p-10 rounded-[3rem] shadow-xl border border-slate-100">
                <div className="flex justify-between items-center mb-10">
                    <div>
                        <h4 className="text-xl font-black text-slate-800 uppercase italic leading-none">Perbandingan Harian</h4>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">VISUALISASI ARUS KAS MASUK VS KELUAR</p>
                    </div>
                </div>
                <div className="h-80 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#cbd5e1', fontWeight: 900 }} dy={10} />
                            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#cbd5e1', fontWeight: 900 }} tickFormatter={(val) => `${val / 1000}k`} />
                            <Tooltip
                                cursor={{ fill: '#f8fafc' }}
                                contentStyle={{ borderRadius: '1.5rem', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', padding: '1.5rem' }}
                                itemStyle={{ fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '4px' }}
                            />
                            <Bar dataKey="income" name="Pemasukan" fill="#10b981" radius={[6, 6, 0, 0]} maxBarSize={30} />
                            <Bar dataKey="expense" name="Pengeluaran" fill="#f43f5e" radius={[6, 6, 0, 0]} maxBarSize={30} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            <div className="bg-white rounded-[3rem] shadow-xl border border-slate-100 p-12 overflow-hidden">
                <div className="flex justify-between items-end mb-12 border-b-2 border-slate-50 pb-8">
                    <div>
                        <h4 className="text-2xl font-black text-slate-800 uppercase italic tracking-tighter">Laporan Laba Rugi</h4>
                        <p className="text-[10px] font-black text-slate-400 mt-2 uppercase tracking-[0.3em]">REKAPITULASI POS KEUANGAN</p>
                    </div>
                    <div className="text-right">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">HASIL OPERASIONAL BERSIH</p>
                        <h3 className={`text-4xl font-black italic tracking-tighter ${netProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {formatCurrency(netProfit)}
                        </h3>
                    </div>
                </div>

                <div className="space-y-12">
                    <section>
                        <h5 className="text-[11px] font-black text-slate-900 uppercase tracking-[0.2em] mb-6 flex items-center gap-3">
                            <div className="w-2 h-2 bg-emerald-500 rounded-full shadow-lg shadow-emerald-200"></div>
                            A. PENDAPATAN OPERASIONAL
                        </h5>
                        <div className="space-y-2 border-l-4 border-emerald-50 pl-6">
                            {Object.entries(revenueItems).map(([cat, amount]) => (
                                <div key={cat} className="flex justify-between py-3 px-4 hover:bg-emerald-50/50 rounded-2xl transition items-center group">
                                    <span className="text-[11px] font-black text-slate-500 uppercase tracking-wide group-hover:text-emerald-700 transition-colors">{cat}</span>
                                    <span className="text-xs font-black text-slate-900 tabular-nums">{formatCurrency(amount as number)}</span>
                                </div>
                            ))}
                            {Object.keys(revenueItems).length === 0 && <p className="text-[10px] text-slate-300 italic pl-4">Tidak ada catatan pendapatan.</p>}
                            <div className="flex justify-between py-5 px-6 bg-emerald-50/50 rounded-2xl items-center mt-4 border border-emerald-100">
                                <span className="text-[11px] font-black text-emerald-800 uppercase italic">SUBTOTAL PENDAPATAN</span>
                                <span className="text-lg font-black text-emerald-600 tabular-nums">{formatCurrency(totalRevenue)}</span>
                            </div>
                        </div>
                    </section>

                    <section>
                        <h5 className="text-[11px] font-black text-slate-900 uppercase tracking-[0.2em] mb-6 flex items-center gap-3">
                            <div className="w-2 h-2 bg-rose-500 rounded-full shadow-lg shadow-rose-200"></div>
                            B. BEBAN & BIAYA OPERASIONAL
                        </h5>
                        <div className="space-y-2 border-l-4 border-rose-50 pl-6">
                            {Object.entries(expenseItems).map(([cat, amount]) => (
                                <div key={cat} className="flex justify-between py-3 px-4 hover:bg-rose-50/50 rounded-2xl transition items-center group">
                                    <span className="text-[11px] font-black text-slate-500 uppercase tracking-wide group-hover:text-rose-700 transition-colors">{cat}</span>
                                    <span className="text-xs font-black text-slate-900 tabular-nums">({formatCurrency(amount as number)})</span>
                                </div>
                            ))}
                            {Object.keys(expenseItems).length === 0 && <p className="text-[10px] text-slate-300 italic pl-4">Tidak ada catatan beban.</p>}
                            <div className="flex justify-between py-5 px-6 bg-rose-50/50 rounded-2xl items-center mt-4 border border-rose-100">
                                <span className="text-[11px] font-black text-rose-800 uppercase italic">SUBTOTAL BEBAN</span>
                                <span className="text-lg font-black text-rose-600 tabular-nums">({formatCurrency(totalExpense)})</span>
                            </div>
                        </div>
                    </section>

                    <div className="pt-10">
                        <div className="bg-slate-900 p-10 rounded-[3rem] flex flex-col md:flex-row justify-between items-center gap-6 shadow-2xl shadow-blue-900/10 border border-white/5 group overflow-hidden relative">
                            <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-r from-blue-600/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
                            <div className="relative z-10">
                                <h5 className="text-[11px] font-black text-blue-400 uppercase tracking-[0.4em] mb-2 leading-none">LABA / RUGI BERSIH AKHIR</h5>
                                <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest italic tracking-tight underline-offset-4 decoration-blue-500/30 decoration-2">"Laporan ini bersifat final untuk periode yang ditampilkan"</p>
                            </div>
                            <div className="relative z-10 text-right">
                                <span className={`text-5xl font-black italic tracking-tighter tabular-nums ${netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                    {formatCurrency(netProfit)}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
