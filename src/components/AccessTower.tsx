
import React, { useState, useEffect } from 'react';
import { useStore } from '../store';
import { Shield, Users, Search, ChevronRight, Lock, Unlock, CheckCircle2, AlertCircle, Building, Filter, ArrowRight } from 'lucide-react';
import { UserRole, Tenant } from '../types';
import { useToast } from './Toast';

export const AccessTower: React.FC<{ store: ReturnType<typeof useStore> }> = ({ store }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(false);
    const [selectedUser, setSelectedUser] = useState<any | null>(null);
    const [userAccess, setUserAccess] = useState<any[]>([]);
    const toast = useToast();

    const filteredUsers = store.users.filter(u => 
        u.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        u.username.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const loadUserAccess = async (user: any) => {
        setLoading(true);
        setSelectedUser(user);
        try {
            const res = await fetch(`/api/auth/access-control?userId=${user.id}`, {
                headers: { 'Authorization': `Bearer ${store.authToken}` }
            });
            if (res.ok) {
                const data = await res.json();
                setUserAccess(data);
            }
        } catch(e) {
            toast.error("Gagal memuat data akses user");
        } finally {
            setLoading(false);
        }
    };

    const handleToggleAccess = async (tenantId: string, currentRole: UserRole, isActive: boolean) => {
        if (!selectedUser) return;
        setLoading(true);
        try {
            await store.updateAccess(selectedUser.id, tenantId, currentRole, !isActive);
            toast.success("Akses berhasil diperbarui");
            // Reload
            await loadUserAccess(selectedUser);
        } catch(e) {
            toast.error("Gagal memperbarui akses");
        } finally {
            setLoading(false);
        }
    };

    const handleChangeRole = async (tenantId: string, newRole: UserRole, currentActive: boolean) => {
        if (!selectedUser) return;
        setLoading(true);
        try {
            await store.updateAccess(selectedUser.id, tenantId, newRole, currentActive);
            toast.success("Role berhasil diperbarui");
            await loadUserAccess(selectedUser);
        } catch(e) {
            toast.error("Gagal memperbarui role");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* LEFT: USER LIST */}
            <div className="lg:col-span-4 space-y-6">
                <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 sticky top-24">
                    <div className="flex items-center gap-3 mb-8">
                        <div className="p-3 bg-indigo-50 rounded-2xl text-indigo-600">
                            <Users size={24} />
                        </div>
                        <div>
                            <h3 className="text-xl font-black text-slate-800 tracking-tight uppercase">User Directory</h3>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Select user to manage permissions</p>
                        </div>
                    </div>

                    <div className="relative mb-6">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input 
                            type="text" 
                            placeholder="Search names or usernames..." 
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full pl-12 pr-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold text-sm focus:border-indigo-500 outline-none transition-all"
                        />
                    </div>

                    <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                        {filteredUsers.map(user => (
                            <button 
                                key={user.id}
                                onClick={() => loadUserAccess(user)}
                                className={`w-full p-4 rounded-2xl flex items-center justify-between transition-all group ${
                                    selectedUser?.id === user.id 
                                    ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-500/20 translate-x-1' 
                                    : 'hover:bg-slate-50 text-slate-600'
                                }`}
                            >
                                <div className="flex items-center gap-3">
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black ${selectedUser?.id === user.id ? 'bg-white/20' : 'bg-slate-100 text-slate-400 group-hover:bg-white'}`}>
                                        {user.name.charAt(0).toUpperCase()}
                                    </div>
                                    <div className="text-left">
                                        <p className="font-black text-sm">{user.name}</p>
                                        <p className={`text-[10px] font-bold uppercase tracking-widest ${selectedUser?.id === user.id ? 'text-white/60' : 'text-slate-400'}`}>
                                            {user.username}
                                        </p>
                                    </div>
                                </div>
                                <ChevronRight size={18} className={`${selectedUser?.id === user.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity`} />
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* RIGHT: ACCESS DETAILS */}
            <div className="lg:col-span-8 space-y-6">
                {!selectedUser ? (
                    <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-[3rem] p-20 flex flex-col items-center justify-center text-center space-y-4">
                        <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center text-slate-300 shadow-sm">
                            <Shield size={48} />
                        </div>
                        <h4 className="text-xl font-black text-slate-400 uppercase tracking-tighter">Access Tower Standby</h4>
                        <p className="text-slate-400 font-bold text-sm max-w-xs leading-relaxed uppercase tracking-widest text-[10px]">Silahkan pilih user di sebelah kiri untuk mengelola izin akses unit bisnis mereka.</p>
                    </div>
                ) : (
                    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                        <div className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100">
                            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-10">
                                <div className="flex items-center gap-6">
                                    <div className="w-20 h-20 bg-indigo-600 rounded-[2rem] flex items-center justify-center text-white text-3xl font-black shadow-2xl shadow-indigo-500/30">
                                        {selectedUser.name.charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-3">
                                            <h3 className="text-3xl font-black text-slate-800 tracking-tight uppercase">{selectedUser.name}</h3>
                                            <span className="px-3 py-1 bg-slate-100 rounded-full text-[10px] font-black text-slate-400 tracking-widest">ID: {selectedUser.id}</span>
                                        </div>
                                        <p className="text-slate-500 font-bold uppercase text-xs tracking-[0.2em] mt-2 italic">Global Permissions Management</p>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center gap-2 px-6">
                                        <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                                        <span className="text-[10px] font-black uppercase tracking-widest">Authenticated</span>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="bg-slate-900 rounded-[2rem] p-8 text-white relative overflow-hidden group">
                                    <div className="absolute right-0 top-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2" />
                                    <div className="relative z-10">
                                        <h4 className="flex items-center gap-3 font-black text-xs uppercase tracking-[0.3em] text-indigo-400 mb-6 border-b border-white/10 pb-4">
                                            <Building size={16} /> Unit Access Matrix
                                        </h4>
                                        <div className="grid grid-cols-1 gap-4">
                                            {store.tenants.map(tenant => {
                                                const access = userAccess.find(a => a.tenantId === tenant.id);
                                                const isActive = access?.isActive || false;
                                                const role = access?.role || UserRole.STAFF;

                                                return (
                                                    <div key={tenant.id} className="p-6 bg-white/5 rounded-3xl border border-white/5 hover:bg-white/10 transition-all flex flex-col md:flex-row md:items-center justify-between gap-6 group/item">
                                                        <div className="flex items-center gap-4">
                                                            <div className={`p-4 rounded-2xl transition-all ${isActive ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'bg-white/5 text-white/20'}`}>
                                                                <Building size={20} />
                                                            </div>
                                                            <div>
                                                                <h5 className="font-black text-sm uppercase tracking-tight">{tenant.name}</h5>
                                                                <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Identity: {tenant.id}</p>
                                                            </div>
                                                        </div>

                                                        <div className="flex items-center gap-4">
                                                            <div className="flex items-center bg-black/20 p-1 rounded-2xl border border-white/5">
                                                                {[UserRole.STAFF, UserRole.MANAGER, UserRole.FINANCE].map(r => (
                                                                    <button
                                                                        key={r}
                                                                        onClick={() => handleChangeRole(tenant.id, r, isActive)}
                                                                        className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                                                                            role === r 
                                                                            ? 'bg-white text-slate-900 shadow-xl' 
                                                                            : 'text-white/40 hover:text-white/80'
                                                                        }`}
                                                                    >
                                                                        {r}
                                                                    </button>
                                                                ))}
                                                            </div>

                                                            <button 
                                                                onClick={() => handleToggleAccess(tenant.id, role, isActive)}
                                                                disabled={loading}
                                                                className={`p-4 rounded-2xl transition-all ${
                                                                    isActive 
                                                                    ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30' 
                                                                    : 'bg-rose-500/20 text-rose-400 hover:bg-rose-500/30'
                                                                }`}
                                                                title={isActive ? "Disable Access" : "Enable Access"}
                                                            >
                                                                {isActive ? <Unlock size={20} /> : <Lock size={20} />}
                                                            </button>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="bg-amber-50 border border-amber-100 p-8 rounded-[2.5rem] flex items-start gap-4 animate-in slide-in-from-bottom-2 duration-700">
                            <AlertCircle className="text-amber-500 mt-1 shrink-0" size={20} />
                            <div className="text-xs">
                                <h5 className="font-black text-amber-900 uppercase tracking-widest mb-1">Security Protocol Warning</h5>
                                <p className="text-amber-700 font-bold leading-relaxed italic">
                                    Perubahan akses akan langsung menghapus atau memberikan izin secara real-time. User harus melakukan refresh halaman atau "Switch Tenant" untuk melihat perubahan. Role OWNER tidak dapat diubah di sini karena alasan keamanan integritas sistem.
                                </p>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
