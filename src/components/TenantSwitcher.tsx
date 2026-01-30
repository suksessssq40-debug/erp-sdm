
import React, { useState, useEffect } from 'react';
import { useAppStore } from '../context/StoreContext';
import { ChevronDown, Check, Building, Plus } from 'lucide-react';
import { useToast } from './Toast';

interface Tenant {
    id: string;
    name: string;
    role: string;
    current: boolean;
}

export const TenantSwitcher = () => {
    const { currentUser } = useAppStore();
    const [tenants, setTenants] = useState<Tenant[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const toast = useToast();

    useEffect(() => {
        // Standardizing on localStorage key used in store.ts: 'sdm_erp_auth_token'
        const token = localStorage.getItem('sdm_erp_auth_token');
        if (!token) return;

        setLoading(true);
        fetch('/api/auth/my-tenants', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        })
            .then(async res => {
                if (!res.ok) throw new Error(`Server Error ${res.status}`);
                return res.json();
            })
            .then(data => {
                if (Array.isArray(data)) {
                    setTenants(data);
                }
            })
            .catch(err => {
                console.error("[TenantSwitcher] Failed to load tenants:", err);
            })
            .finally(() => {
                setLoading(false);
            });
    }, []);

    const handleSwitch = async (targetId: string) => {
        if (loading) return;
        const current = tenants.find(t => t.id === targetId && t.current);
        if (current) {
            setIsOpen(false);
            return;
        }

        setLoading(true);
        toast.info("Switching unit...");

        try {
            const token = localStorage.getItem('sdm_erp_auth_token');
            const res = await fetch('/api/tenants/switch', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ targetTenantId: targetId })
            });

            const data = await res.json();

            if (res.ok) {
                // 1. Update Local Storage
                localStorage.setItem('sdm_erp_auth_token', data.token);
                localStorage.setItem('sdm_erp_current_user', JSON.stringify(data.user));

                // 2. Hard Reload to flush state and jump directly to new dashboard
                const newTenantId = data.user.tenantId;
                const newRole = data.user.roleSlug;
                window.location.href = `/${newTenantId}/${newRole}/dashboard`;
            } else {
                toast.error(data.error || "Failed to switch");
                setLoading(false);
            }
        } catch (e) {
            toast.error("Network error");
            setLoading(false);
        }
    };

    const currentTenant = tenants.find(t => t.current) || { name: (currentUser?.tenantId || 'SDM').toUpperCase(), role: currentUser?.role || 'User' };
    const canSwitch = tenants.length > 1;

    return (
        <div className="relative">
            <button
                onClick={() => canSwitch && setIsOpen(!isOpen)}
                className={`flex items-center gap-2 p-2 rounded-lg transition-all group ${canSwitch ? 'hover:bg-slate-800 cursor-pointer' : 'cursor-default'}`}
            >
                <div className="text-left">
                    <h1 className="text-xl font-bold tracking-tight text-blue-400 italic flex items-center gap-2">
                        {currentTenant.name.toUpperCase()} <span className="text-white">ERP</span>
                        {canSwitch && (
                            <ChevronDown size={14} className={`text-slate-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                        )}
                    </h1>
                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest group-hover:text-blue-300 transition-colors">
                        {canSwitch ? 'Switch Business Unit' : 'Active Unit'}
                    </p>
                </div>
            </button>

            {isOpen && (
                <div className="absolute top-full left-0 mt-2 w-64 bg-slate-800 rounded-xl shadow-2xl border border-slate-700 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2">
                    <div className="p-3 border-b border-slate-700/50">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">My Access</p>
                    </div>
                    <div className="max-h-[300px] overflow-y-auto custom-scrollbar">
                        {tenants.map(t => (
                            <button
                                key={t.id}
                                onClick={() => handleSwitch(t.id)}
                                disabled={loading}
                                className={`w-full text-left px-4 py-3 flex items-center justify-between hover:bg-slate-700 transition ${t.current ? 'bg-blue-600/10' : ''}`}
                            >
                                <div className="flex items-center gap-3">
                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ${t.current ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300'}`}>
                                        {t.name.substring(0, 2).toUpperCase()}
                                    </div>
                                    <div>
                                        <div className={`font-bold text-sm ${t.current ? 'text-blue-400' : 'text-slate-200'}`}>{t.name}</div>
                                        <div className="text-[10px] text-slate-500 font-black uppercase tracking-wider">{t.role}</div>
                                    </div>
                                </div>
                                {t.current && <Check size={16} className="text-blue-500" />}
                            </button>
                        ))}
                        {loading && (
                            <div className="p-4 text-center text-slate-500 text-xs animate-pulse italic">
                                Refreshing business units...
                            </div>
                        )}
                        {!loading && tenants.length === 0 && (
                            <div className="p-4 text-center text-slate-500 text-xs">
                                No business units found.
                            </div>
                        )}
                    </div>

                    {/* Optional: Add Unit Button for Owner */}
                    {currentUser?.role === 'OWNER' && (
                        <div className="p-2 border-t border-slate-700/50 bg-slate-900/30">
                            <button disabled className="w-full py-2 text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center justify-center gap-2 cursor-not-allowed opacity-50">
                                <Plus size={12} /> Create New Unit
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* Backdrop to close */}
            {isOpen && <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />}
        </div>
    );
};
