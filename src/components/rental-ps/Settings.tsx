
import React, { useState } from 'react';
import { MapPin, Save, Plus, Trash2, Settings as SettingsIcon, AlertCircle, ToggleLeft, ToggleRight } from 'lucide-react';
import { RentalPsPrice, RentalPsOutlet } from './types';
import { useToast } from '../Toast';
import { formatCurrency } from '../../utils';

interface SettingsProps {
    prices: RentalPsPrice[];
    onRefresh: () => void;
    outlets: RentalPsOutlet[];
    onRefreshOutlets: () => void;
    selectedOutletId: string;
    setSelectedOutletId: (v: string) => void;
    currentUser: any;
}

export const Settings: React.FC<SettingsProps> = ({
    prices, onRefresh, outlets, onRefreshOutlets,
    selectedOutletId, setSelectedOutletId, currentUser
}) => {
    const toast = useToast();
    const [isSaving, setIsSaving] = useState(false);
    const [newPrice, setNewPrice] = useState({ name: '', pricePerHour: '' });
    const [newOutletName, setNewOutletName] = useState('');
    const [finSettings, setFinSettings] = useState({
        rentalPsCashAccountId: '',
        rentalPsTransferAccountId: '',
        rentalPsReceivableCoaId: '',
        rentalPsSalesCoaId: '',
        rentalPsTargetTenantId: 'sdm',
        rentalPsTargetBusinessUnitId: 'eke1tjt1u'
    });
    const [accounts, setAccounts] = useState<any[]>([]);
    const [coas, setCoas] = useState<any[]>([]);
    const [tenants, setTenants] = useState<any[]>([]);
    const [businessUnits, setBusinessUnits] = useState<any[]>([]);
    const [isFetchingFin, setIsFetchingFin] = useState(false);

    const sortedPrices = [...prices].sort((a, b) => a.name.localeCompare(b.name));

    const fetchFinancialSettings = async (targetTenant?: string) => {
        setIsFetchingFin(true);
        try {
            const token = localStorage.getItem('sdm_erp_auth_token');
            const url = targetTenant
                ? `/api/rental-ps/settings?target=${targetTenant}`
                : '/api/rental-ps/settings';

            const res = await fetch(url, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();

                // Only update the main settings if we are loading for the first time
                if (!targetTenant) {
                    setFinSettings({
                        rentalPsCashAccountId: data.settings?.rentalPsCashAccountId || '',
                        rentalPsTransferAccountId: data.settings?.rentalPsTransferAccountId || '',
                        rentalPsReceivableCoaId: data.settings?.rentalPsReceivableCoaId || '',
                        rentalPsSalesCoaId: data.settings?.rentalPsSalesCoaId || '',
                        rentalPsTargetTenantId: data.settings?.rentalPsTargetTenantId || 'sdm',
                        rentalPsTargetBusinessUnitId: data.settings?.rentalPsTargetBusinessUnitId || 'eke1tjt1u'
                    });
                }

                setAccounts(data.financialAccounts || []);
                setCoas(data.coas || []);
                setBusinessUnits(data.businessUnits || []);
                setTenants(data.tenants || []);
            } else {
                const errData = await res.json();
                toast.error(`Gagal memuat data: ${errData.message || 'Error internal'}`);
                console.error("Fetch Error Detail:", errData);
            }
        } catch (e) {
            console.error("Failed to fetch financial settings");
        } finally {
            setIsFetchingFin(false);
        }
    };

    React.useEffect(() => {
        const rolesAllowed = ['OWNER', 'FINANCE', 'SUPERADMIN'];
        if (rolesAllowed.includes(currentUser.role)) {
            fetchFinancialSettings();
        }
    }, [currentUser.role]);

    const handleSaveFinSettings = async () => {
        setIsSaving(true);
        try {
            const token = localStorage.getItem('sdm_erp_auth_token');
            const res = await fetch('/api/rental-ps/settings', {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(finSettings)
            });
            if (res.ok) {
                toast.success("Pemetaan Akun Keuangan Disimpan");
            }
        } catch (e) {
            toast.error("Gagal menyimpan pemetaan akun");
        } finally {
            setIsSaving(false);
        }
    };

    const handleUpdate = async (name: string, value: string) => {
        if (!value || isNaN(Number(value)) || !selectedOutletId) return;

        setIsSaving(true);
        try {
            const token = localStorage.getItem('sdm_erp_auth_token');
            const res = await fetch('/api/rental-ps/prices', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ name, pricePerHour: Number(value), outletId: selectedOutletId })
            });
            if (res.ok) {
                toast.success(`Harga ${name} diperbarui`);
                onRefresh();
            }
        } catch (e) {
            toast.error("Gagal memperbarui harga");
        } finally {
            setIsSaving(false);
        }
    };

    const handleAddPrice = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newPrice.name || !newPrice.pricePerHour || !selectedOutletId) return;

        setIsSaving(true);
        try {
            const token = localStorage.getItem('sdm_erp_auth_token');
            const res = await fetch('/api/rental-ps/prices', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name: newPrice.name.toUpperCase(),
                    pricePerHour: Number(newPrice.pricePerHour),
                    outletId: selectedOutletId
                })
            });
            if (res.ok) {
                toast.success("Tipe PS baru ditambahkan");
                setNewPrice({ name: '', pricePerHour: '' });
                onRefresh();
            }
        } catch (e) {
            toast.error("Gagal menambah data");
        } finally {
            setIsSaving(false);
        }
    };

    const handleAddOutlet = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newOutletName.trim()) return;

        setIsSaving(true);
        try {
            const token = localStorage.getItem('sdm_erp_auth_token');
            const res = await fetch('/api/rental-ps/outlets', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ name: newOutletName })
            });
            if (res.ok) {
                toast.success("Outlet berhasil ditambahkan");
                setNewOutletName('');
                onRefreshOutlets();
            }
        } catch (e) {
            toast.error("Gagal menambah outlet");
        } finally {
            setIsSaving(false);
        }
    };

    const toggleOutlet = async (outlet: RentalPsOutlet) => {
        try {
            const token = localStorage.getItem('sdm_erp_auth_token');
            const res = await fetch('/api/rental-ps/outlets', {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ id: outlet.id, isActive: !outlet.isActive, name: outlet.name })
            });
            if (res.ok) {
                toast.success(`Outlet ${outlet.name} ${!outlet.isActive ? 'diaktifkan' : 'dinonaktifkan'}`);
                onRefreshOutlets();
            }
        } catch (e) {
            toast.error("Gagal mengubah status outlet");
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* OUTLET MANAGEMENT */}
            <div className="bg-white p-5 md:p-8 rounded-[2rem] md:rounded-[2.5rem] shadow-xl border border-slate-100">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl">
                            <MapPin size={20} />
                        </div>
                        <div>
                            <h3 className="text-lg font-black uppercase italic tracking-tighter text-slate-900 leading-none">Manajemen Outlet</h3>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Kelola cabang & ketersediaan</p>
                        </div>
                    </div>

                    <form onSubmit={handleAddOutlet} className="flex gap-2">
                        <input
                            type="text"
                            value={newOutletName}
                            onChange={e => setNewOutletName(e.target.value)}
                            className="flex-1 bg-slate-50 border-none rounded-xl px-4 py-3 text-xs font-bold text-slate-700 focus:ring-2 focus:ring-emerald-500 placeholder:text-slate-300 transition-all"
                            placeholder="Nama Outlet Baru..."
                            required
                        />
                        <button
                            type="submit"
                            disabled={isSaving}
                            className="bg-emerald-600 text-white p-3 rounded-xl hover:bg-emerald-700 transition-all shrink-0"
                        >
                            <Plus size={18} />
                        </button>
                    </form>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {outlets.map(o => (
                        <div key={o.id} className={`p-4 md:p-5 rounded-3xl border-2 transition-all flex items-center justify-between ${o.id === selectedOutletId ? 'border-blue-500 bg-blue-50/30' : 'border-slate-50 bg-slate-50/30 hover:border-slate-200'}`}>
                            <div className="flex items-center gap-3 cursor-pointer grow" onClick={() => setSelectedOutletId(o.id)}>
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black shrink-0 ${o.isActive ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                                    {o.name.charAt(0).toUpperCase()}
                                </div>
                                <div className="min-w-0">
                                    <p className="text-xs font-black text-slate-900 uppercase truncate">{o.name}</p>
                                    <p className={`text-[9px] font-bold uppercase tracking-widest ${o.isActive ? 'text-emerald-500' : 'text-slate-400'}`}>
                                        {o.isActive ? 'AKTIF' : 'NON-AKTIF'}
                                    </p>
                                </div>
                            </div>
                            <button onClick={() => toggleOutlet(o)} className={`p-2 rounded-lg transition-all shrink-0 ${o.isActive ? 'text-emerald-500 hover:bg-emerald-50' : 'text-slate-300 hover:bg-slate-100'}`}>
                                {o.isActive ? <ToggleRight size={24} /> : <ToggleLeft size={24} />}
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* PRICE LIST */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-white p-5 md:p-8 rounded-[2rem] md:rounded-[2.5rem] shadow-xl border border-slate-100 h-full">
                        <div className="flex items-center justify-between mb-8">
                            <div className="flex items-center gap-3">
                                <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
                                    <SettingsIcon size={20} />
                                </div>
                                <div>
                                    <h3 className="text-lg font-black uppercase italic tracking-tighter text-slate-900 leading-none">Manajemen Harga</h3>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Tarif Khusus: <span className="text-blue-600 font-black">{outlets.find(o => o.id === selectedOutletId)?.name || 'N/A'}</span></p>
                                </div>
                            </div>
                        </div>

                        {!selectedOutletId ? (
                            <div className="py-16 md:py-20 text-center space-y-4">
                                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto text-slate-300">
                                    <MapPin size={32} />
                                </div>
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest leading-relaxed">Pilih outlet di atas untuk<br />mengelola daftar harga</p>
                            </div>
                        ) : (
                            <div className="space-y-3 md:space-y-4">
                                {sortedPrices.map(p => (
                                    <div key={p.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-5 md:p-6 bg-slate-50 rounded-3xl gap-4 border border-transparent hover:border-blue-100 transition-all group">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center font-black text-blue-600 shadow-sm shrink-0">
                                                {p.name.includes('3') ? '3' : p.name.includes('4') ? '4' : p.name.includes('5') ? '5' : '?'}
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-xs font-black text-slate-900 uppercase truncate">{p.name}</p>
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">TARIF: {formatCurrency(p.pricePerHour)}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 justify-end">
                                            <div className="relative flex-1 sm:flex-none">
                                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">Rp</span>
                                                <input
                                                    type="number"
                                                    defaultValue={p.pricePerHour}
                                                    onBlur={(e) => {
                                                        if (Number(e.target.value) !== p.pricePerHour) {
                                                            handleUpdate(p.name, e.target.value);
                                                        }
                                                    }}
                                                    className="pl-10 pr-4 py-3 bg-white border-2 border-slate-100 rounded-xl text-xs font-black text-slate-700 w-full sm:w-32 focus:border-blue-500 outline-none transition-all"
                                                />
                                            </div>
                                            <div className="p-3 text-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity hidden sm:block">
                                                <Save size={16} />
                                            </div>
                                        </div>
                                    </div>
                                ))}

                                {prices.length === 0 && (
                                    <div className="py-12 text-center space-y-3">
                                        <AlertCircle size={48} className="text-slate-200 mx-auto" />
                                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Belum ada harga di outlet ini</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* ADD NEW TYPE */}
                <div className="space-y-6">
                    <div className="bg-slate-900 p-6 md:p-8 rounded-[2rem] md:rounded-[2.5rem] shadow-xl text-white relative overflow-hidden group">
                        <div className="absolute -right-10 -bottom-10 opacity-10 group-hover:scale-110 transition-transform duration-700">
                            <Plus size={200} />
                        </div>
                        <div className="relative z-10">
                            <h3 className="text-xl font-black uppercase italic mb-6">Tambah Unit</h3>
                            <form onSubmit={handleAddPrice} className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Nama Unit (e.g. PS 5)</label>
                                    <input
                                        type="text"
                                        value={newPrice.name}
                                        onChange={e => setNewPrice({ ...newPrice, name: e.target.value })}
                                        className="w-full bg-white/10 border-none rounded-2xl p-4 font-bold text-white focus:ring-2 focus:ring-blue-500 placeholder:text-slate-600 transition-all uppercase text-sm"
                                        placeholder="CONTOH: PS 5"
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Harga Per Jam</label>
                                    <input
                                        type="number"
                                        value={newPrice.pricePerHour}
                                        onChange={e => setNewPrice({ ...newPrice, pricePerHour: e.target.value })}
                                        className="w-full bg-white/10 border-none rounded-2xl p-4 font-bold text-white focus:ring-2 focus:ring-blue-500 placeholder:text-slate-600 transition-all text-sm"
                                        placeholder="15000"
                                        required
                                    />
                                </div>
                                <button
                                    type="submit"
                                    disabled={isSaving || !selectedOutletId}
                                    className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-blue-500/20 hover:bg-blue-700 active:scale-[0.98] transition-all flex items-center justify-center gap-2 mt-4 disabled:opacity-50 disabled:bg-slate-700"
                                >
                                    {isSaving ? 'MEMPROSES...' : <><Plus size={16} /> TAMBAH HARGA</>}
                                </button>
                                {!selectedOutletId && <p className="text-[9px] text-center text-red-400 font-bold uppercase mt-2">Pilih outlet dulu</p>}
                            </form>
                        </div>
                    </div>

                    <div className="bg-emerald-50 p-6 md:p-8 rounded-[2rem] md:rounded-[2.5rem] border border-emerald-100 shrink-0">
                        <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-600 mb-4">Skalabilitas Outlet</h4>
                        <p className="text-[11px] font-bold text-emerald-800/70 leading-relaxed italic">
                            Sistem dirancang untuk mendukung banyak cabang. Setiap cabang bisa memiliki tarif berbeda-beda sesuai dengan strategi operasional masing-masing lokasi.
                        </p>
                    </div>
                </div>
            </div>
            {/* FINANCIAL MAPPING (ONLY OWNER/FINANCE/SUPERADMIN) - FULL WIDTH */}
            {(['OWNER', 'FINANCE', 'SUPERADMIN'].includes(currentUser.role)) && (
                <div className="bg-white p-5 md:p-10 rounded-[2rem] md:rounded-[2.5rem] shadow-xl border border-slate-100 animate-in fade-in slide-in-from-bottom-8 duration-700">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-5 mb-10 border-b border-slate-50 pb-8">
                        <div className="p-4 bg-slate-900 text-white rounded-2xl shadow-lg shadow-slate-200 w-fit">
                            <SettingsIcon size={24} />
                        </div>
                        <div>
                            <h3 className="text-xl font-black uppercase italic tracking-tighter text-slate-800">Pemetaan Akun Keuangan</h3>
                            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-1">Sinkronisasi Otomatis Kas & Bank ke Kantor Pusat SDM</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                        {/* TARGET TENANT SELECTION (ENTERPRISE SCALABILITY) */}
                        <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 flex flex-col">
                            <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 ml-1 mb-3">
                                <div className="w-2 h-2 rounded-full bg-slate-800"></div>
                                Target Kantor Keuangan
                            </label>
                            <div className="relative group">
                                <select
                                    value={finSettings.rentalPsTargetTenantId}
                                    onChange={(e) => {
                                        const newTarget = e.target.value;
                                        setFinSettings({
                                            ...finSettings,
                                            rentalPsTargetTenantId: newTarget,
                                            rentalPsCashAccountId: '',
                                            rentalPsTransferAccountId: '',
                                            rentalPsReceivableCoaId: '',
                                            rentalPsSalesCoaId: '',
                                            rentalPsTargetBusinessUnitId: ''
                                        });
                                        fetchFinancialSettings(newTarget);
                                    }}
                                    className="w-full appearance-none bg-white border-2 border-slate-200 rounded-2xl p-4 pr-10 font-black text-[11px] text-slate-800 focus:ring-4 focus:ring-slate-200 focus:border-slate-300 transition-all cursor-pointer uppercase truncate"
                                >
                                    <option value="">-- PILIH KANTOR --</option>
                                    {isFetchingFin ? (
                                        <option value="" disabled>Memuat...</option>
                                    ) : (
                                        tenants.map(t => (
                                            <option key={t.id} value={t.id}>{t.name}</option>
                                        ))
                                    )}
                                </select>
                                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                    <ToggleRight size={16} className="rotate-90" />
                                </div>
                            </div>
                        </div>

                        {/* TARGET BUSINESS UNIT SELECTION */}
                        <div className="bg-blue-50/30 p-6 rounded-3xl border border-blue-100 flex flex-col">
                            <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-blue-500 ml-1 mb-3">
                                <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                                Target Unit Bisnis
                            </label>
                            <div className="relative group">
                                <select
                                    value={finSettings.rentalPsTargetBusinessUnitId}
                                    onChange={(e) => setFinSettings({ ...finSettings, rentalPsTargetBusinessUnitId: e.target.value })}
                                    className="w-full appearance-none bg-white border-2 border-blue-100 rounded-2xl p-4 pr-10 font-black text-[11px] text-slate-800 focus:ring-4 focus:ring-blue-100 focus:border-blue-200 transition-all cursor-pointer uppercase truncate"
                                >
                                    <option value="">-- PILIH UNIT BISNIS --</option>
                                    {businessUnits.map(bu => (
                                        <option key={bu.id} value={bu.id}>{bu.name}</option>
                                    ))}
                                </select>
                                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-blue-300">
                                    <ToggleRight size={16} className="rotate-90" />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12">
                        {/* CASH & BANK */}
                        <div className="space-y-6">
                            <div className="space-y-2">
                                <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">
                                    AKUN KAS (TUNAI)
                                </label>
                                <div className="relative group">
                                    <select
                                        value={finSettings.rentalPsCashAccountId}
                                        onChange={(e) => setFinSettings({ ...finSettings, rentalPsCashAccountId: e.target.value })}
                                        className="w-full appearance-none bg-slate-50 border-2 border-transparent rounded-2xl p-4 pr-10 font-bold text-xs text-slate-700 focus:ring-4 focus:ring-slate-200 focus:bg-white focus:border-slate-200 transition-all cursor-pointer hover:bg-slate-100 truncate"
                                    >
                                        <option value="">-- PILIH AKUN KAS --</option>
                                        {accounts.map(acc => (
                                            <option key={acc.id} value={acc.id}>{acc.name}</option>
                                        ))}
                                    </select>
                                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                        <ToggleRight size={16} className="rotate-90" />
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">
                                    AKUN BANK (TRANSFER)
                                </label>
                                <div className="relative group">
                                    <select
                                        value={finSettings.rentalPsTransferAccountId}
                                        onChange={(e) => setFinSettings({ ...finSettings, rentalPsTransferAccountId: e.target.value })}
                                        className="w-full appearance-none bg-slate-50 border-2 border-transparent rounded-2xl p-4 pr-10 font-bold text-xs text-slate-700 focus:ring-4 focus:ring-slate-200 focus:bg-white focus:border-slate-200 transition-all cursor-pointer hover:bg-slate-100 truncate"
                                    >
                                        <option value="">-- PILIH AKUN BANK --</option>
                                        {accounts.map(acc => (
                                            <option key={acc.id} value={acc.id}>{acc.name}</option>
                                        ))}
                                    </select>
                                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                        <ToggleRight size={16} className="rotate-90" />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* COA MAPPING */}
                        <div className="space-y-6">
                            <div className="space-y-2">
                                <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-blue-500 ml-1">
                                    AKUN PIUTANG (RECEIVABLE)
                                </label>
                                <div className="relative group">
                                    <select
                                        value={finSettings.rentalPsReceivableCoaId}
                                        onChange={(e) => setFinSettings({ ...finSettings, rentalPsReceivableCoaId: e.target.value })}
                                        className="w-full appearance-none bg-blue-50/30 border-2 border-transparent rounded-2xl p-4 pr-10 font-bold text-xs text-slate-700 focus:ring-4 focus:ring-blue-100 focus:bg-white focus:border-blue-200 transition-all cursor-pointer hover:bg-blue-50 truncate"
                                    >
                                        <option value="">-- PILIH COA PIUTANG --</option>
                                        {coas.map(c => (
                                            <option key={c.id} value={c.id}>{c.code} - {c.name}</option>
                                        ))}
                                    </select>
                                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-blue-300">
                                        <ToggleRight size={16} className="rotate-90" />
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500 ml-1">
                                    AKUN PENJUALAN (REVENUE)
                                </label>
                                <div className="relative group">
                                    <select
                                        value={finSettings.rentalPsSalesCoaId}
                                        onChange={(e) => setFinSettings({ ...finSettings, rentalPsSalesCoaId: e.target.value })}
                                        className="w-full appearance-none bg-emerald-50/30 border-2 border-transparent rounded-2xl p-4 pr-10 font-bold text-xs text-slate-700 focus:ring-4 focus:ring-emerald-100 focus:bg-white focus:border-emerald-200 transition-all cursor-pointer hover:bg-emerald-50 truncate"
                                    >
                                        <option value="">-- PILIH COA PENJUALAN --</option>
                                        {coas.map(c => (
                                            <option key={c.id} value={c.id}>{c.code} - {c.name}</option>
                                        ))}
                                    </select>
                                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-emerald-300">
                                        <ToggleRight size={16} className="rotate-90" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="mt-10 pt-8 border-t border-slate-50 flex justify-center sm:justify-end">
                        <button
                            onClick={handleSaveFinSettings}
                            disabled={isSaving || isFetchingFin}
                            className="w-full sm:w-auto bg-slate-900 text-white px-8 py-5 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-blue-600 transition-all shadow-xl shadow-slate-200 hover:shadow-blue-200 active:scale-95 group"
                        >
                            {isSaving ? 'MEMPROSES...' : <><Save size={16} className="group-hover:rotate-12 transition-transform" /> SIMPAN KONFIGURASI</>}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
