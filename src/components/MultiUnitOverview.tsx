
import React, { useState, useEffect } from 'react';
import { Building, ArrowUpRight, ArrowDownRight, Users, CheckCircle, AlertTriangle, Wallet } from 'lucide-react';

interface UnitMetric {
    tenantId: string;
    name: string;
    metrics: {
        users: number;
        projects: number;
        requests: number;
        attendanceRate: number;
        lateRate: number;
        balance: number;
    }
}

export const MultiUnitOverview = () => {
    const [stats, setStats] = useState<UnitMetric[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch('/api/owner/multi-tenant-metrics')
            .then(res => res.json())
            .then(data => {
                if (Array.isArray(data)) setStats(data);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, []);

    const formatIDR = (val: number) => {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            maximumFractionDigits: 0
        }).format(val);
    };

    if (loading) return (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => (
                <div key={i} className="h-48 bg-white rounded-[2.5rem] p-8 border border-slate-100 animate-pulse">
                    <div className="w-12 h-12 bg-slate-100 rounded-2xl mb-4"></div>
                    <div className="h-4 w-32 bg-slate-100 rounded mb-2"></div>
                    <div className="h-8 w-48 bg-slate-100 rounded"></div>
                </div>
            ))}
        </div>
    );

    if (stats.length <= 1) return null; // Don't show if only 1 unit

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-xl font-black text-slate-800 tracking-tight italic uppercase">Multi-Unit Performance</h3>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">PERBANDINGAN PERFORMA ANTAR KANTOR</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {stats.map(unit => {
                    const health = unit.metrics.lateRate > 0.2 || unit.metrics.projects > 10 ? 'warning' : 'healthy';
                    
                    return (
                        <div key={unit.tenantId} className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-100 hover:border-blue-200 transition group relative overflow-hidden">
                            <div className="flex justify-between items-start mb-6">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <Building size={16} className="text-blue-500" />
                                        <h4 className="font-black text-slate-800 group-hover:text-blue-600 transition truncate max-w-[150px]">{unit.name}</h4>
                                    </div>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{unit.metrics.users} Staff Active</p>
                                </div>
                                <div className={`p-2 rounded-xl ${health === 'healthy' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                                    {health === 'healthy' ? <CheckCircle size={20} /> : <AlertTriangle size={20} />}
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="flex justify-between items-end">
                                    <div>
                                        <p className="text-[9px] font-black text-slate-400 uppercase mb-1">CASH POSITION</p>
                                        <div className={`text-lg font-black tracking-tight ${unit.metrics.balance >= 0 ? 'text-slate-800' : 'text-rose-500'}`}>
                                            {formatIDR(unit.metrics.balance)}
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[9px] font-black text-slate-400 uppercase mb-1">ATTENDANCE</p>
                                        <div className="text-lg font-black text-slate-800">{Math.round(unit.metrics.attendanceRate * 100)}%</div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3 pt-4 border-t border-slate-50">
                                    <div className="bg-slate-50 p-3 rounded-2xl text-center">
                                        <p className="text-[8px] font-black text-slate-400 uppercase mb-1 text-center">OPEN PROJECTS</p>
                                        <p className="text-sm font-black text-slate-700">{unit.metrics.projects}</p>
                                    </div>
                                    <div className="bg-slate-50 p-3 rounded-2xl text-center">
                                        <p className="text-[8px] font-black text-slate-400 uppercase mb-1 text-center">PENDING REQ</p>
                                        <p className="text-sm font-black text-slate-700">{unit.metrics.requests}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Hover Action */}
                            <div className="absolute inset-x-0 bottom-0 h-1 bg-blue-500 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
