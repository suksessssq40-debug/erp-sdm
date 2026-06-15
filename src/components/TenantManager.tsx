
import React, { useState, useEffect } from 'react';
import { useStore } from '../store';
import { Building, Plus, ArrowRight, CheckCircle, Smartphone, Edit2, Trash2, Users, Shield, Zap, Info, X } from 'lucide-react';
import { useToast } from './Toast';

export const TenantManager: React.FC<{ store: ReturnType<typeof useStore> }> = ({ store }) => {
    const [view, setView] = useState<'LIST' | 'CREATE' | 'EDIT'>('LIST');
    const [formData, setFormData] = useState({
        id: '',
        name: '',
        description: '',
        isActive: true,
        workStrategy: 'FIXED' as 'FIXED' | 'SHIFT' | 'FLEXIBLE',
        radiusTolerance: 50,
        lateGracePeriod: 15
    });
    const [selectedFeatures, setSelectedFeatures] = useState<string[]>(['projects', 'chat', 'attendance', 'requests', 'daily_report']);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [shifts, setShifts] = useState<any[]>([]);
    const [newShift, setNewShift] = useState({ name: '', startTime: '08:00', endTime: '17:00', isOvernight: false });

    const [loading, setLoading] = useState(false);
    const [switchingId, setSwitchingId] = useState<string | null>(null);
    const [showConfirmDelete, setShowConfirmDelete] = useState<string | null>(null);
    const toast = useToast();

    // ... moduleList ...
    const moduleList = [
        { id: 'projects', label: 'Project Kanban', icon: Zap },
        { id: 'chat', label: 'Team Chat', icon: Zap },
        { id: 'attendance', label: 'Absensi', icon: Zap },
        { id: 'payroll', label: 'Gaji & Slip', icon: Shield },
        { id: 'requests', label: 'Permohonan', icon: Zap },
        { id: 'daily_report', label: 'Daily Report', icon: Zap },
        { id: 'finance', label: 'Arus Kas', icon: Shield },
    ];

    const toggleFeature = (id: string) => {
        setSelectedFeatures(prev =>
            prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]
        );
    };

    useEffect(() => {
        store.fetchTenants();
    }, []);

    const resetForm = () => {
        setFormData({
            id: '',
            name: '',
            description: '',
            isActive: true,
            workStrategy: 'FIXED',
            radiusTolerance: 50,
            lateGracePeriod: 15
        });
        setSelectedFeatures(['projects', 'chat', 'attendance', 'requests', 'daily_report']);
        setEditingId(null);
        setShifts([]);
        setView('LIST');
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name || !formData.id) {
            toast.warning('Nama dan ID Kantor wajib diisi');
            return;
        }

        setLoading(true);
        try {
            await store.createTenant(formData.id, formData.name, formData.description, selectedFeatures, formData.workStrategy, formData.radiusTolerance, formData.lateGracePeriod);

            // If shift mode, create shifts
            if (formData.workStrategy === 'SHIFT' && shifts.length > 0) {
                for (const s of shifts) {
                    await store.createShift(formData.id, s);
                }
            }

            toast.success('Kantor baru berhasil dibuat!');
            resetForm();
        } catch (e: any) {
            toast.error(e.message || 'Gagal membuat kantor baru');
        } finally {
            setLoading(false);
        }
    };

    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingId) return;

        setLoading(true);
        try {
            await store.updateTenant(editingId, formData.name, formData.description, selectedFeatures, formData.isActive, formData.workStrategy, formData.radiusTolerance, formData.lateGracePeriod);
            toast.success('Unit bisnis berhasil diperbarui!');
            resetForm();
        } catch (e: any) {
            toast.error(e.message || 'Gagal memperbarui unit');
        } finally {
            setLoading(false);
        }
    };

    const startEdit = async (tenant: any) => {
        setEditingId(tenant.id);
        setFormData({
            id: tenant.id,
            name: tenant.name,
            description: tenant.description || '',
            isActive: tenant.isActive,
            workStrategy: tenant.workStrategy || 'FIXED',
            radiusTolerance: tenant.radiusTolerance || 50,
            lateGracePeriod: tenant.lateGracePeriod || 15
        });
        try {
            const feats = typeof tenant.featuresJson === 'string' ? JSON.parse(tenant.featuresJson) : (tenant.featuresJson || []);
            setSelectedFeatures(feats);
        } catch (e) { setSelectedFeatures([]); }

        // Fetch Shifts
        const s = await store.fetchShifts(tenant.id);
        setShifts(s);

        setView('EDIT');
    };

    const handleAddShift = async () => {
        if (!newShift.name) return;
        if (view === 'EDIT' && editingId) {
            try {
                const s = await store.createShift(editingId, newShift);
                setShifts(prev => [...prev, s]);
                toast.success('Shift berhasil ditambah');
            } catch (e) {
                toast.error('Gagal tambah shift');
            }
        } else {
            setShifts(prev => [...prev, { ...newShift, id: Math.random().toString() }]);
        }
        setNewShift({ name: '', startTime: '08:00', endTime: '17:00', isOvernight: false });
    };

    const handleDeleteShift = async (shiftId: string) => {
        if (!confirm("Hapus shift ini?")) return;
        if (view === 'EDIT' && editingId) {
            try {
                // If it's a real shift (not a temporary one with Math.random id)
                if (shiftId.startsWith('shf_')) {
                    await store.deleteShift(editingId, shiftId);
                }
                setShifts(prev => prev.filter(s => s.id !== shiftId));
                toast.success('Shift dihapus');
            } catch (e) {
                toast.error('Gagal hapus shift');
            }
        } else {
            setShifts(prev => prev.filter(s => s.id !== shiftId));
        }
    };

    // ... handleDelete ...
    const handleDelete = async () => {
        if (!showConfirmDelete) return;

        setLoading(true);
        try {
            await store.deleteTenant(showConfirmDelete);
            toast.success('Unit bisnis berhasil dihapus.');
            setShowConfirmDelete(null);
        } catch (e: any) {
            toast.error(e.message || 'Gagal menghapus unit');
        } finally {
            setLoading(false);
        }
    };

    const switchToTenant = async (tenantId: string) => {
        setSwitchingId(tenantId);
        try {
            await store.switchTenant(tenantId);
        } catch (e: any) {
            toast.error(e.message || 'Gagal berpindah unit');
            setSwitchingId(null);
        }
    };

    const currentTenantId = (store.currentUser as any)?.tenantId || 'sdm';

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">

            {/* DELETE CONFIRMATION MODAL */}
            {showConfirmDelete && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl max-w-md w-full p-8 border border-slate-100 animate-in zoom-in-95 duration-300">
                        <div className="w-20 h-20 bg-rose-50 rounded-3xl flex items-center justify-center text-rose-500 mb-6 mx-auto">
                            <Trash2 size={40} />
                        </div>
                        <h3 className="text-2xl font-black text-slate-800 text-center mb-2 tracking-tight">Konfirmasi Hapus</h3>
                        <p className="text-slate-500 text-center mb-8 font-medium leading-relaxed">
                            Apakah Anda yakin ingin menghapus unit <span className="font-black text-slate-800">"{store.tenants.find(t => t.id === showConfirmDelete)?.name}"</span>?
                            Semua data seperti User, Proyek, dan Transaksi di unit ini akan hilang selamanya.
                        </p>
                        <div className="flex flex-col gap-3">
                            <button
                                onClick={handleDelete}
                                disabled={loading}
                                className="w-full py-4 bg-rose-500 text-white rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-rose-600 transition-all shadow-lg shadow-rose-500/25 disabled:opacity-50 flex items-center justify-center gap-3"
                            >
                                {loading && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                                Ya, Hapus Sekarang
                            </button>
                            <button
                                onClick={() => setShowConfirmDelete(null)}
                                className="w-full py-4 bg-slate-100 text-slate-600 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-slate-200 transition-all"
                            >
                                Batalkan
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* HEADER */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
                <div>
                    <h2 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-3">
                        <div className="p-3 bg-blue-50 rounded-2xl text-blue-600"><Building size={28} /></div>
                        UNIT MASTER
                    </h2>
                    <p className="text-slate-500 font-bold uppercase text-[10px] tracking-[0.2em] mt-2 ml-14 md:ml-16">Pusat Konfigurasi & Strategi Operasional</p>
                </div>
                {view === 'LIST' && (
                    <button
                        onClick={() => setView('CREATE')}
                        className="bg-slate-900 text-white px-10 py-5 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-blue-600 transition-all flex items-center gap-3 shadow-xl hover:shadow-blue-500/20 hover:-translate-y-1 active:translate-y-0"
                    >
                        <Plus size={20} />
                        Daftarkan Unit Baru
                    </button>
                )}
            </div>

            {/* CREATE / EDIT FORM */}
            {(view === 'CREATE' || view === 'EDIT') && (
                <div className="bg-white p-10 rounded-[3rem] shadow-2xl border border-slate-100 relative overflow-hidden animate-in zoom-in-95 duration-300">
                    <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-600"></div>

                    <div className="flex justify-between items-center mb-10">
                        <h3 className="text-2xl font-black uppercase tracking-widest text-slate-800 italic">
                            {view === 'CREATE' ? 'Setup Unit Bisnis Baru' : `Pengaturan: ${formData.name}`}
                        </h3>
                        <button onClick={resetForm} className="p-3 hover:bg-slate-100 rounded-2xl transition text-slate-400">
                            <X size={28} />
                        </button>
                    </div>

                    <form onSubmit={view === 'CREATE' ? handleCreate : handleUpdate} className="space-y-10">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                            <div className="space-y-8">
                                <div>
                                    <label className="block text-[10px] font-black uppercase text-slate-400 tracking-widest mb-4 italic">Nama Unit Bisnis</label>
                                    <input
                                        value={formData.name}
                                        onChange={e => {
                                            const val = e.target.value;
                                            setFormData(prev => ({
                                                ...prev,
                                                name: val,
                                                id: view === 'CREATE' ? val.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-') : prev.id
                                            }));
                                        }}
                                        className="w-full px-8 py-5 bg-slate-50 border-2 border-slate-100 rounded-3xl font-bold text-slate-700 focus:border-blue-500 focus:bg-white outline-none transition-all shadow-inner text-lg"
                                        placeholder="Contoh: SDM Digital"
                                    />
                                    <div className="mt-3 px-2 flex items-center gap-2">
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">ID SISTEM (URL):</span>
                                        <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-lg border border-blue-100 italic">
                                            {formData.id || '(akan otomatis dibuat)'}
                                        </span>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[10px] font-black uppercase text-slate-400 tracking-widest mb-4 italic">Work Strategy</label>
                                        <select
                                            value={formData.workStrategy}
                                            onChange={e => setFormData({ ...formData, workStrategy: e.target.value as any })}
                                            className="w-full px-8 py-5 bg-slate-50 border-2 border-slate-100 rounded-3xl font-bold text-slate-700 focus:border-blue-500 focus:bg-white outline-none transition-all shadow-inner"
                                        >
                                            <option value="FIXED">FIXED (Kantor)</option>
                                            <option value="SHIFT">SHIFT (Gantian)</option>
                                            <option value="FLEXIBLE">FLEXIBLE (Bebas)</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black uppercase text-slate-400 tracking-widest mb-4 italic">Radius (M)</label>
                                        <input
                                            type="number"
                                            value={formData.radiusTolerance}
                                            onChange={e => setFormData({ ...formData, radiusTolerance: parseInt(e.target.value) })}
                                            className="w-full px-8 py-5 bg-slate-50 border-2 border-slate-100 rounded-3xl font-bold text-slate-700 focus:border-blue-500 focus:bg-white outline-none transition-all shadow-inner"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-[10px] font-black uppercase text-slate-400 tracking-widest mb-4 italic">Late Grace Period (Mins)</label>
                                    <input
                                        type="number"
                                        value={formData.lateGracePeriod}
                                        onChange={e => setFormData({ ...formData, lateGracePeriod: parseInt(e.target.value) })}
                                        className="w-full px-8 py-5 bg-slate-50 border-2 border-slate-100 rounded-3xl font-bold text-slate-700 focus:border-blue-500 focus:bg-white outline-none transition-all shadow-inner"
                                    />
                                </div>

                                {formData.workStrategy === 'SHIFT' && (
                                    <div className="space-y-4 p-6 bg-purple-50 rounded-[2rem] border border-purple-100 animate-in slide-in-from-top duration-300">
                                        <h4 className="text-[10px] font-black uppercase text-purple-600 tracking-widest">Shift Management</h4>
                                        <div className="space-y-2">
                                            {shifts.map((s, idx) => (
                                                <div key={idx} className="flex justify-between items-center bg-white p-3 rounded-xl border border-purple-200">
                                                    <div>
                                                        <span className="text-xs font-bold text-slate-700">{s.name} ({s.startTime} - {s.endTime})</span>
                                                        {s.isOvernight && <span className="ml-2 bg-purple-100 text-purple-600 text-[8px] font-black px-1.5 py-0.5 rounded">OVERNIGHT</span>}
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDeleteShift(s.id)}
                                                        className="p-1.5 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="grid grid-cols-2 gap-2">
                                            <input
                                                placeholder="Shift Name"
                                                className="text-xs p-3 rounded-xl border outline-none"
                                                value={newShift.name}
                                                onChange={e => setNewShift({ ...newShift, name: e.target.value })}
                                            />
                                            <div className="flex gap-1">
                                                <input type="time" className="text-xs p-3 rounded-xl border outline-none flex-1" value={newShift.startTime} onChange={e => setNewShift({ ...newShift, startTime: e.target.value })} />
                                                <input type="time" className="text-xs p-3 rounded-xl border outline-none flex-1" value={newShift.endTime} onChange={e => setNewShift({ ...newShift, endTime: e.target.value })} />
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={handleAddShift}
                                            className="w-full py-3 bg-purple-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-purple-700 transition"
                                        >
                                            Add Shift Definition
                                        </button>
                                    </div>
                                )}

                                <div>
                                    <label className="block text-[10px] font-black uppercase text-slate-400 tracking-widest mb-4 italic">Status Operasional</label>
                                    <div className="flex gap-6">
                                        <button
                                            type="button"
                                            onClick={() => setFormData({ ...formData, isActive: true })}
                                            className={`flex-1 py-5 rounded-3xl font-black text-xs tracking-[0.2em] transition-all border-2 ${formData.isActive ? 'bg-emerald-500 text-white border-emerald-500 shadow-lg shadow-emerald-500/20' : 'bg-slate-50 text-slate-400 border-slate-100'}`}
                                        >
                                            ACTIVE
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setFormData({ ...formData, isActive: false })}
                                            className={`flex-1 py-5 rounded-3xl font-black text-xs tracking-[0.2em] transition-all border-2 ${!formData.isActive ? 'bg-rose-500 text-white border-rose-500 shadow-lg shadow-rose-500/20' : 'bg-slate-50 text-slate-400 border-slate-100'}`}
                                        >
                                            DISABLED
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="block text-[10px] font-black uppercase text-slate-400 tracking-widest mb-4 italic">Konfigurasi Modul & Fitur (Klik untuk Toggle)</label>
                                <div className="grid grid-cols-1 gap-4 max-h-[400px] overflow-y-auto pr-3 custom-scrollbar">
                                    {moduleList.map(mod => (
                                        <button
                                            key={mod.id}
                                            type="button"
                                            onClick={() => toggleFeature(mod.id)}
                                            className={`px-8 py-5 rounded-3xl border-2 font-black text-xs transition-all flex items-center justify-between group ${selectedFeatures.includes(mod.id)
                                                ? 'border-blue-500 bg-blue-50 text-blue-700'
                                                : 'border-slate-100 bg-slate-50 text-slate-400 hover:border-slate-300 hover:bg-slate-100'
                                                }`}
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className={`p-3 rounded-2xl transition-colors ${selectedFeatures.includes(mod.id) ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-400'}`}>
                                                    <mod.icon size={18} />
                                                </div>
                                                <span className="tracking-widest">{mod.label.toUpperCase()}</span>
                                            </div>
                                            <div className={`w-8 h-8 rounded-xl border-2 flex items-center justify-center transition-all ${selectedFeatures.includes(mod.id) ? 'bg-blue-500 border-blue-500 text-white shadow-lg shadow-blue-500/20' : 'border-slate-200 bg-white'}`}>
                                                {selectedFeatures.includes(mod.id) && <CheckCircle size={16} />}
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-col sm:flex-row justify-end gap-6 pt-10 border-t border-slate-100">
                            <button
                                type="button"
                                onClick={resetForm}
                                className="px-10 py-5 font-black text-slate-400 hover:text-rose-500 transition-colors uppercase text-xs tracking-[0.2em]"
                            >
                                Batalkan
                            </button>
                            <button
                                type="submit"
                                disabled={loading}
                                className="bg-slate-900 text-white px-12 py-5 rounded-[2rem] font-black uppercase text-xs tracking-[0.2em] hover:bg-blue-600 transition-all shadow-xl hover:shadow-blue-500/20 disabled:opacity-50 flex items-center justify-center gap-4"
                            >
                                {loading && <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                                {view === 'CREATE' ? 'Konfirmasi Pendaftaran' : 'Simpan Perubahan Unit'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* TENANT GRID */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 pb-12">
                {store.tenants.map(tenant => {
                    const isCurrent = tenant.id === currentTenantId;
                    const features = typeof tenant.featuresJson === 'string' ? JSON.parse(tenant.featuresJson || '[]') : (tenant.featuresJson || []);

                    return (
                        <div key={tenant.id} className="group bg-white rounded-[3.5rem] p-10 shadow-sm hover:shadow-2xl border border-slate-100 transition-all duration-700 hover:-translate-y-2 relative overflow-hidden flex flex-col">
                            {/* Activity Glow */}
                            <div className={`absolute -top-20 -right-20 w-48 h-48 blur-[100px] rounded-full transition-opacity duration-1000 ${tenant.isActive ? 'bg-emerald-400/20' : 'bg-rose-400/20'} opacity-0 group-hover:opacity-100`} />

                            {/* ACTION OVERLAY (BETTER ACCESSIBILITY) */}
                            <div className="absolute top-6 right-6 flex gap-3 z-10">
                                <button
                                    onClick={(e) => { e.stopPropagation(); startEdit(tenant); }}
                                    className="w-12 h-12 bg-white/80 backdrop-blur-md text-slate-400 hover:bg-blue-600 hover:text-white rounded-2xl transition-all shadow-lg border border-slate-50 flex items-center justify-center group/edit hover:scale-110 active:scale-95"
                                    title="Edit Unit"
                                >
                                    <Edit2 size={20} className="group-hover/edit:rotate-12 transition-transform" />
                                </button>
                                {tenant.id !== 'sdm' && (
                                    <button
                                        onClick={(e) => { e.stopPropagation(); setShowConfirmDelete(tenant.id); }}
                                        className="w-12 h-12 bg-white/80 backdrop-blur-md text-slate-400 hover:bg-rose-500 hover:text-white rounded-2xl transition-all shadow-lg border border-slate-50 flex items-center justify-center group/del hover:scale-110 active:scale-95"
                                        title="Delete Unit"
                                    >
                                        <Trash2 size={20} className="group-hover/del:animate-bounce" />
                                    </button>
                                )}
                            </div>

                            <div className="mb-8">
                                <div className={`w-20 h-20 rounded-[2rem] flex items-center justify-center shadow-inner transition-all duration-500 ${isCurrent ? 'bg-blue-600 text-white rotate-6' : 'bg-slate-50 text-slate-400 group-hover:bg-slate-900 group-hover:text-white group-hover:-rotate-6'}`}>
                                    <Building size={36} />
                                </div>
                            </div>

                            <div className="flex-1">
                                <div className="flex items-center gap-3 mb-2">
                                    <h3 className="text-2xl font-black text-slate-800 tracking-tight italic group-hover:text-blue-600 transition-colors uppercase">{tenant.name}</h3>
                                    {isCurrent && <div className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse shadow-lg shadow-emerald-500/50" />}
                                </div>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-6 flex items-center gap-2">
                                    <Shield size={12} className="text-blue-500" /> IDENTITY_{tenant.id}
                                </p>

                                <p className="text-sm text-slate-500 font-medium line-clamp-2 mb-8 min-h-[44px] leading-relaxed">
                                    {tenant.description || 'Enterprise unit operational with global context and secure isolation protocols.'}
                                </p>

                                <div className="grid grid-cols-2 gap-4 mb-10">
                                    <div className="bg-slate-50 p-5 rounded-3xl border border-slate-100 group-hover:bg-white group-hover:border-blue-100 transition-all shadow-sm">
                                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-2">Authenticated Staff</p>
                                        <div className="flex items-center gap-3">
                                            <div className="p-1.5 bg-blue-50 rounded-lg text-blue-500"><Users size={16} /></div>
                                            <span className="text-lg font-black text-slate-800">{tenant._count?.users || 0}</span>
                                        </div>
                                    </div>
                                    <div className="bg-slate-50 p-5 rounded-3xl border border-slate-100 group-hover:bg-white group-hover:border-amber-100 transition-all shadow-sm">
                                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-2">Active Capacities</p>
                                        <div className="flex items-center gap-3">
                                            <div className="p-1.5 bg-amber-50 rounded-lg text-amber-500"><Zap size={16} /></div>
                                            <span className="text-lg font-black text-slate-800">{features.length}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="border-t border-slate-100 pt-8 mt-auto">
                                {isCurrent ? (
                                    <div className="w-full py-5 rounded-[2rem] bg-slate-900 text-white flex items-center justify-center gap-4 font-black text-xs tracking-[0.2em] cursor-default shadow-xl">
                                        <div className="w-2.5 h-2.5 bg-emerald-400 rounded-full animate-pulse" />
                                        SYSTEMS ACTIVE
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => switchToTenant(tenant.id)}
                                        disabled={switchingId !== null}
                                        className="w-full py-5 rounded-[2rem] bg-slate-50 text-slate-800 hover:bg-blue-600 hover:text-white transition-all duration-500 font-black text-xs tracking-[0.2em] flex items-center justify-center gap-4 group/btn hover:shadow-2xl hover:shadow-blue-500/30"
                                    >
                                        {switchingId === tenant.id ? 'SYNCHRONIZING...' : 'ENTER ANALYTICS'}
                                        <ArrowRight size={18} className="group-hover/btn:translate-x-2 transition-transform" />
                                    </button>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="bg-blue-900/5 border border-blue-100 p-10 rounded-[3.5rem] flex flex-col md:flex-row items-center gap-8 relative overflow-hidden group">
                <div className="absolute right-0 top-0 w-64 h-64 bg-blue-500/5 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2" />
                <div className="bg-blue-600 p-6 rounded-[2rem] text-white shadow-2xl shadow-blue-500/40 group-hover:scale-110 transition-transform duration-500">
                    <Info size={36} />
                </div>
                <div className="relative z-10 text-center md:text-left">
                    <h4 className="text-blue-950 font-black tracking-tighter text-2xl uppercase italic">Protocol Manajemen Eksekutif</h4>
                    <p className="text-blue-800/70 font-bold leading-relaxed mt-3 max-w-3xl">
                        Setiap unit bisnis diisolasi secara total untuk keamanan data. Pengaktifan modul bersifat independen; misalnya, Anda dapat memberikan akses "Arus Kas" hanya pada unit tertentu. Sebagai Owner, Anda memegang kunci utama untuk melihat dashboard analytics di seluruh cabang.
                    </p>
                </div>
            </div>
        </div>
    );
};
