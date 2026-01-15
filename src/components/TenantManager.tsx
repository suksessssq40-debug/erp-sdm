
import React, { useState, useEffect } from 'react';
import { useStore } from '../store';
import { Building, Plus, ArrowRight, CheckCircle, Smartphone } from 'lucide-react';
import { useToast } from './Toast';

export const TenantManager: React.FC<{ store: ReturnType<typeof useStore> }> = ({ store }) => {
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState({ id: '', name: '', description: '' });
  const [loading, setLoading] = useState(false);
  const [switchingId, setSwitchingId] = useState<string | null>(null);
  const [newAdminInfo, setNewAdminInfo] = useState<string | null>(null);
  const toast = useToast();

  useEffect(() => {
    store.fetchTenants();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.id) {
        toast.warning('Nama dan ID Kantor wajib diisi');
        return;
    }
    
    // Validate ID format (slug)
    if (!/^[a-z0-9-]+$/.test(formData.id)) {
        toast.warning('ID Kantor hanya boleh huruf kecil, angka, dan strip (tanpa spasi)');
        return;
    }

    setLoading(true);
    setNewAdminInfo(null);
    try {
        const res = await store.createTenant(formData.id, formData.name, formData.description);
        toast.success('Kantor baru berhasil dibuat!');
        setIsCreating(false);
        setFormData({ id: '', name: '', description: '' });
        
        // Show success info
        if (res.adminUsername) {
            setNewAdminInfo(res.adminUsername);
        }
    } catch(e: any) {
        toast.error(e.message || 'Gagal membuat kantor baru');
    } finally {
        setLoading(false);
    }
  };

  const switchToTenant = async (tenantId: string) => {
      setSwitchingId(tenantId);
      try {
          // Direct API call followed by Hard Reload is safer for Context Switch
          const token = localStorage.getItem('sdm_erp_auth_token');
          const res = await fetch('/api/tenants/switch', {
              method: 'POST',
              headers: { 
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${token}` 
              },
              body: JSON.stringify({ targetTenantId: tenantId }) 
          });

          const data = await res.json();
          if (res.ok) {
              toast.success(`Berhasil pindah ke unit ${tenantId}`);
              localStorage.setItem('sdm_erp_auth_token', data.token);
              localStorage.setItem('sdm_erp_current_user', JSON.stringify(data.user));
              
              // Force Navigation
              window.location.href = `/${data.user.tenantId}/${data.user.roleSlug}/kanban`;
          } else {
              throw new Error(data.error || 'Failed to switch');
          }

      } catch (e: any) {
          toast.error(e.message || 'Gagal berpindah unit');
          setSwitchingId(null);
      }
  };

  // Filter out the current tenant from the list to avoid confusion? Or show all.
  const currentTenantId = (store.currentUser as any)?.tenantId || 'sdm';

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight">BUSINESS UNITS</h2>
          <p className="text-slate-500 font-medium">Kelola kantor cabang dan unit usaha anda.</p>
        </div>
        <button 
          onClick={() => setIsCreating(true)}
          className="bg-slate-900 text-white px-6 py-3 rounded-xl font-bold uppercase tracking-wider hover:bg-slate-800 transition flex items-center gap-2 shadow-lg hover:shadow-xl hover:-translate-y-1 active:translate-y-0"
        >
          <Plus size={18} />
          Tambah Kantor
        </button>
      </div>

      {newAdminInfo && (
          <div className="bg-emerald-50 border border-emerald-200 p-6 rounded-2xl flex items-start gap-4 mb-8">
              <div className="bg-emerald-100 p-3 rounded-xl text-emerald-600">
                  <CheckCircle size={24} />
              </div>
              <div>
                  <h3 className="font-bold text-emerald-800 text-lg">Kantor Berhasil Dibuat!</h3>
                  <p className="text-emerald-700 mt-1">
                      Anda dapat login ke kantor baru menggunakan password anda saat ini.
                  </p>
                  <div className="mt-4 bg-white/50 p-4 rounded-xl border border-emerald-100">
                      <p className="text-xs font-bold uppercase text-emerald-600 mb-1">Username Admin Baru</p>
                      <p className="font-mono text-xl font-black text-slate-700 tracking-wider">{newAdminInfo}</p>
                  </div>
              </div>
          </div>
      )}

      {isCreating && (
        <div className="bg-white p-8 rounded-[2rem] shadow-xl border border-slate-100 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-500 to-indigo-600"></div>
            <h3 className="text-lg font-black uppercase tracking-widest text-slate-800 mb-6">Setup Kantor Baru</h3>
            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-xs font-bold uppercase text-slate-400 mb-2">Nama Kantor / Usaha</label>
                        <input 
                            value={formData.name}
                            onChange={e => {
                                const val = e.target.value;
                                setFormData({
                                    ...formData, 
                                    name: val,
                                    // Auto-generate ID if empty
                                    id: formData.id ? formData.id : val.toLowerCase().replace(/[^a-z0-9]/g, '-')
                                });
                            }}
                            className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl font-bold text-slate-700 focus:border-blue-500 outline-none transition"
                            placeholder="Contoh: Manjada Catering"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold uppercase text-slate-400 mb-2">ID Kantor (URL Slug)</label>
                        <div className="flex items-center">
                            <span className="bg-slate-100 text-slate-400 font-bold px-4 py-3 rounded-l-xl border-y-2 border-l-2 border-slate-100">/</span>
                            <input 
                                value={formData.id}
                                onChange={e => setFormData({...formData, id: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '')})}
                                className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-r-xl font-bold text-slate-700 focus:border-blue-500 outline-none transition"
                                placeholder="manjada-catering"
                            />
                        </div>
                        <p className="text-[10px] text-slate-400 mt-1 font-medium">*Hanya huruf kecil, angka, dan strip. Tanpa spasi.</p>
                    </div>
                </div>
                <div>
                     <label className="block text-xs font-bold uppercase text-slate-400 mb-2">Deskripsi (Opsional)</label>
                     <textarea 
                        value={formData.description}
                        onChange={e => setFormData({...formData, description: e.target.value})}
                        className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl font-bold text-slate-700 focus:border-blue-500 outline-none transition h-24 resize-none"
                        placeholder="Deskripsi singkat usaha ini..."
                     />
                </div>
                
                <div className="flex justify-end gap-3 pt-4">
                    <button 
                        type="button" 
                        onClick={() => setIsCreating(false)}
                        className="px-6 py-3 font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition"
                    >
                        BATAL
                    </button>
                    <button 
                        type="submit" 
                        disabled={loading}
                        className="bg-blue-600 text-white px-8 py-3 rounded-xl font-bold uppercase tracking-wider hover:bg-blue-700 transition shadow-lg hover:shadow-blue-500/30 disabled:opacity-50"
                    >
                        {loading ? 'Memproses...' : 'Buat Kantor Sekarang'}
                    </button>
                </div>
            </form>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {store.tenants.map(tenant => (
          <div key={tenant.id} className="group bg-white rounded-[2rem] p-6 shadow-sm hover:shadow-xl border border-slate-100 transition-all duration-300 hover:-translate-y-1 relative overflow-hidden">
             <div className={`absolute top-0 right-0 p-4 ${tenant.id === currentTenantId ? 'opacity-100' : 'opacity-0'} transition-opacity`}>
                 <div className="bg-emerald-100 text-emerald-600 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1">
                     <CheckCircle size={12} />
                     Active Session
                 </div>
             </div>
             
             <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center mb-4 text-slate-700 group-hover:bg-blue-600 group-hover:text-white transition-colors duration-300 shadow-inner">
                <Building size={28} />
             </div>
             
             <h3 className="text-xl font-black text-slate-800 mb-1">{tenant.name}</h3>
             <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">ID: {tenant.id}</p>
             <p className="text-sm text-slate-500 line-clamp-2 mb-6 h-10">
                 {tenant.description || 'Tidak ada deskripsi usaha.'}
             </p>

             <div className="flex items-center justify-between border-t border-slate-100 pt-4 mt-auto">
                 <div className="flex flex-col">
                     <span className="text-[10px] uppercase font-bold text-slate-400">Status</span>
                     <span className="text-xs font-black text-emerald-500">OPERATIONAL</span>
                 </div>
                 
                 {tenant.id !== currentTenantId ? (
                     <button 
                       onClick={() => switchToTenant(tenant.id)}
                       disabled={switchingId !== null}
                       className="flex items-center gap-2 text-blue-600 font-bold text-sm hover:underline decoration-2 underline-offset-4 disabled:opacity-50"
                     >
                        {switchingId === tenant.id ? 'Memproses...' : 'Buka Dashboard'} <ArrowRight size={16} />
                     </button>
                 ) : (
                     <span className="text-slate-300 font-bold text-xs italic">Sedang Diakses</span>
                 )}
             </div>
          </div>
        ))}
      </div>
    </div>
  );
};
