import React, { useState } from 'react';
import { Plus, Bot, Layout as LayoutIcon, Unlock } from 'lucide-react';
import { User, UserRole } from '../types';
import { useToast } from './Toast';

export const UserManagement = ({ users, currentUser, onAddUser, onResetDevice, toast }: { users: User[], currentUser: User | null, onAddUser: (u: User) => void, onResetDevice: (id: string) => Promise<boolean>, toast: ReturnType<typeof useToast> }) => {
  const [showAdd, setShowAdd] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [newUser, setNewUser] = useState({ name: '', username: '', telegramId: '', telegramUsername: '', role: 'STAFF', password: '', passwordConfirm: '' });
  const [filter, setFilter] = useState('');

  const filteredUsers = users.filter(u => u.name.toLowerCase().includes(filter.toLowerCase()) || u.username.toLowerCase().includes(filter.toLowerCase()));

  const handleAddUser = async () => {
    if (!newUser.name.trim() || !newUser.username.trim()) {
      toast.warning("Nama dan Username wajib diisi.");
      return;
    }
    if (users.some(u => u.username === newUser.username)) {
      toast.error("Username sudah digunakan. Silahkan pilih yang lain.");
      return;
    }
    if (!newUser.password || newUser.password.length < 6) {
      toast.warning("Password awal minimal 6 karakter.");
      return;
    }
    if (newUser.password !== newUser.passwordConfirm) {
      toast.error("Konfirmasi password tidak sama.");
      return;
    }

    setIsLoading(true);
    try {
      const userToCreate: User & { password: string } = { 
        id: Date.now().toString(), 
        name: newUser.name,
        username: newUser.username,
        role: newUser.role as UserRole,
        telegramId: newUser.telegramId,
        telegramUsername: newUser.telegramUsername,
        password: newUser.password
      };

      await onAddUser(userToCreate);
      setNewUser({
        name: '',
        username: '',
        role: UserRole.STAFF,
        telegramId: '',
        telegramUsername: '',
        password: '',
        passwordConfirm: ''
      });
      setShowAdd(false);
      toast.success(`Tim "${userToCreate.name}" berhasil didaftarkan ke sistem dengan password awal yang aman.`);
    } catch (err: any) {
      toast.error(err?.message || 'Gagal menambahkan user. Periksa koneksi dan coba lagi.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-10 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h3 className="text-3xl font-black text-slate-800 tracking-tight leading-none italic">Manajemen Tim</h3>
          <p className="text-xs font-black text-slate-400 uppercase tracking-[0.3em] mt-3">Sistem Pengaturan Hak Akses SDM Core</p>
        </div>
        <div className="flex gap-4">
           <input 
             className="bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold w-full md:w-64 outline-none focus:border-blue-500" 
             placeholder="Cari tim..." 
             value={filter} 
             onChange={e => setFilter(e.target.value)} 
           />
           <button onClick={() => setShowAdd(true)} className="bg-slate-900 text-white px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center space-x-2 shadow-xl hover:bg-blue-600 transition shrink-0">
              <Plus size={16} /> <span className="hidden md:inline">TAMBAH ANGGOTA</span>
              <span className="md:hidden">BARU</span>
           </button>
        </div>
      </div>

      <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Anggota</th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Role & Akses</th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Koneksi</th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Status Device</th>
                <th className="px-6 py-5 text-right text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredUsers.map((u: any) => (
                <tr key={u.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white font-black shadow-lg ${
                         u.role === UserRole.OWNER ? 'bg-purple-600' :
                         u.role === UserRole.MANAGER ? 'bg-amber-500' :
                         u.role === UserRole.FINANCE ? 'bg-emerald-500' : 'bg-blue-600'
                      }`}>
                        {u.name.charAt(0)}
                      </div>
                      <div>
                        <p className="font-bold text-slate-800 text-sm">{u.name}</p>
                        <p className="text-[10px] text-slate-400 font-bold">@{u.username}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
                      u.role === UserRole.OWNER ? 'bg-purple-100 text-purple-700' :
                      u.role === UserRole.MANAGER ? 'bg-amber-100 text-amber-700' :
                      u.role === UserRole.FINANCE ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'
                    }`}>{u.role}</span>
                  </td>
                  <td className="px-6 py-5">
                     <div className="flex items-center text-slate-500 bg-slate-100 px-3 py-1.5 rounded-lg w-fit">
                       <Bot size={14} className="mr-2 text-blue-500" />
                       <span className="text-[10px] font-bold">{u.telegramUsername || '-'}</span>
                     </div>
                  </td>
                  <td className="px-6 py-5">
                     {u.deviceId ? (
                       <span className="flex items-center gap-2 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-lg w-fit">
                         <LayoutIcon size={12} /> TERKUNCI
                       </span>
                     ) : (
                       <span className="flex items-center gap-2 text-[10px] font-bold text-slate-400 bg-slate-50 px-3 py-1 rounded-lg w-fit">
                         <Unlock size={12} /> BEBAS
                       </span>
                     )}
                  </td>
                  <td className="px-6 py-5 text-right">
                     {currentUser?.role === UserRole.OWNER && u.deviceId && (
                        <button 
                          onClick={async () => {
                            if (confirm(`Reset kunci perangkat untuk user ${u.name}?`)) {
                              try {
                                await onResetDevice(u.id);
                                toast.success("Device berhasil di-reset!");
                              } catch (e) {
                                toast.error("Gagal reset device.");
                              }
                            }
                          }}
                          className="text-[10px] font-black text-amber-600 hover:bg-amber-50 px-3 py-2 rounded-lg transition"
                        >
                          RESET ID
                        </button>
                      )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredUsers.length === 0 && (
             <div className="p-12 text-center text-slate-300 font-bold uppercase tracking-widest text-xs">
               Tidak ada anggota ditemukan
             </div>
          )}
        </div>
      </div>

      {/* Modal removed to brevity or must be included? Must be included to work. Code continues... */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/90 backdrop-blur-md p-4">
          <div className="bg-white rounded-[3rem] p-10 w-full max-w-md space-y-8 shadow-2xl border border-white/20 animate-in zoom-in duration-300">
            <h3 className="text-3xl font-black text-slate-800 leading-tight uppercase tracking-tighter italic">Registrasi Anggota</h3>
            <div className="space-y-5">
              <div className="space-y-2">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">NAMA LENGKAP</label>
                 <input className="w-full p-4 bg-slate-50 border-2 border-transparent focus:border-blue-600 focus:bg-white rounded-2xl outline-none font-bold transition shadow-sm" placeholder="Andi Kurniawan" value={newUser.name} onChange={e => setNewUser({...newUser, name: e.target.value})} />
              </div>
              <div className="space-y-2">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">USERNAME LOGIN</label>
                 <input className="w-full p-4 bg-slate-50 border-2 border-transparent focus:border-blue-600 focus:bg-white rounded-2xl outline-none font-bold transition shadow-sm" placeholder="andi_sdm" value={newUser.username} onChange={e => setNewUser({...newUser, username: e.target.value})} />
              </div>
              <div className="space-y-2">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">HAK AKSES / ROLE</label>
                 <select className="w-full p-4 bg-slate-50 border-2 border-transparent focus:border-blue-600 focus:bg-white rounded-2xl outline-none font-black text-xs uppercase tracking-widest transition shadow-sm" value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value})}>
                    <option value={UserRole.STAFF}>STAFF OPERASIONAL</option>
                    <option value={UserRole.FINANCE}>TIM KEUANGAN</option>
                    <option value={UserRole.MANAGER}>MANAGER PROYEK</option>
                 </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">TELEGRAM ID</label>
                  <input className="w-full p-4 bg-slate-50 border-2 border-transparent focus:border-blue-600 focus:bg-white rounded-2xl outline-none font-bold transition text-xs" placeholder="ID numerik" value={newUser.telegramId} onChange={e => setNewUser({...newUser, telegramId: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">TELEGRAM USER</label>
                  <input className="w-full p-4 bg-slate-50 border-2 border-transparent focus:border-blue-600 focus:bg-white rounded-2xl outline-none font-bold transition text-xs" placeholder="@username" value={newUser.telegramUsername} onChange={e => setNewUser({...newUser, telegramUsername: e.target.value})} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">PASSWORD AWAL</label>
                  <input
                    type="password"
                    className="w-full p-4 bg-slate-50 border-2 border-transparent focus:border-blue-600 focus:bg-white rounded-2xl outline-none font-bold transition text-xs"
                    placeholder="Minimal 6 karakter"
                    value={newUser.password}
                    onChange={e => setNewUser({ ...newUser, password: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">KONFIRMASI PASSWORD</label>
                  <input
                    type="password"
                    className="w-full p-4 bg-slate-50 border-2 border-transparent focus:border-blue-600 focus:bg-white rounded-2xl outline-none font-bold transition text-xs"
                    placeholder="Ulangi password"
                    value={newUser.passwordConfirm}
                    onChange={e => setNewUser({ ...newUser, passwordConfirm: e.target.value })}
                  />
                </div>
              </div>
            </div>
            <div className="flex gap-4 pt-6 border-t border-slate-50">
               <button onClick={() => setShowAdd(false)} className="flex-1 py-4 text-slate-400 font-black uppercase tracking-widest hover:bg-slate-100 rounded-2xl transition text-xs">BATAL</button>
               <button onClick={handleAddUser} disabled={isLoading} className="flex-1 bg-slate-900 text-white p-4 rounded-2xl font-black uppercase tracking-widest hover:bg-blue-600 transition shadow-xl shadow-slate-200 text-xs disabled:opacity-50 disabled:cursor-not-allowed">
                 {isLoading ? 'MENYIMPAN...' : 'SIMPAN ANGGOTA'}
               </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
