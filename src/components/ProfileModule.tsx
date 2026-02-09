import React, { useState, useEffect } from 'react';
import { User, UserRole } from '../types';
import { User as UserIcon, Camera, Save, Lock, Mail, AtSign, Briefcase, FileText, CheckCircle2 } from 'lucide-react';
import { useToast } from './Toast';

interface ProfileModuleProps {
    currentUser: User;
    onUpdateUser: (user: User) => Promise<void>;
    uploadFile?: (file: File) => Promise<string>;
}

const ProfileModule: React.FC<ProfileModuleProps> = ({ currentUser, onUpdateUser, uploadFile }) => {
    const toast = useToast();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        username: '',
        telegramUsername: '',
        password: '', // Only sent if changed
    });
    const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);

    useEffect(() => {
        if (currentUser) {
            setFormData({
                name: currentUser.name || '',
                username: currentUser.username || '',
                telegramUsername: currentUser.telegramUsername || '',
                password: ''
            });
            setAvatarPreview(currentUser.avatarUrl || null);
        }
    }, [currentUser]);

    // Cleanup blob URLs to prevent memory leaks
    useEffect(() => {
        return () => {
            if (avatarPreview?.startsWith('blob:')) {
                URL.revokeObjectURL(avatarPreview);
            }
        };
    }, [avatarPreview]);

    const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 2 * 1024 * 1024) {
            toast.warning("Ukuran foto maksimal 2MB");
            return;
        }

        if (uploadFile) {
            // Instant Local Preview
            const localUrl = URL.createObjectURL(file);
            setAvatarPreview(localUrl);

            setIsUploading(true);
            try {
                toast.info("Mengunggah foto ke server...");
                const url = await uploadFile(file);
                // Replace local URL with permanent server URL
                setAvatarPreview(url);
                toast.success("Foto berhasil diunggah! Jangan lupa simpan profil.");
            } catch (err) {
                toast.error("Gagal mengunggah foto. Periksa koneksi atau ukuran file.");
                // Revert to current user avatar if upload fails
                setAvatarPreview(currentUser.avatarUrl || null);
            } finally {
                setIsUploading(false);
            }
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const updatedUser: User = {
                ...currentUser,
                name: formData.name,
                telegramUsername: formData.telegramUsername,
                avatarUrl: avatarPreview === null ? null : (avatarPreview || undefined)
            };

            // If password provided
            if (formData.password) {
                updatedUser.password = formData.password;
            }

            await onUpdateUser(updatedUser);
            toast.success("Profil berhasil diperbarui!");
            setFormData(prev => ({ ...prev, password: '' })); // Clear password field
        } catch (err: any) {
            toast.error(err?.message || "Gagal memperbarui profil.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-black text-slate-800 uppercase tracking-tight">Profil Saya</h1>
                    <p className="text-slate-500 font-bold text-sm uppercase tracking-widest mt-1">Kelola Identitas & Informasi Akun</p>
                </div>
                <div className="flex gap-2">
                    <div className="px-4 py-2 bg-slate-100 rounded-xl font-black text-xs uppercase tracking-widest text-slate-500">
                        {currentUser.role}
                    </div>
                    {['OWNER', 'MANAGER', 'FINANCE'].includes(currentUser.role) && (
                        <div className="px-4 py-2 bg-slate-900 text-white rounded-xl font-black text-[10px] uppercase tracking-tighter flex items-center gap-2 border border-slate-700 italic">
                            <CheckCircle2 size={12} className="text-blue-400" /> Authorized Approver
                        </div>
                    )}
                </div>
            </div>

            <form onSubmit={handleSubmit} className="grid md:grid-cols-3 gap-8">
                {/* LEFT COLUMN - AVATAR */}
                <div className="col-span-1">
                    <div className="bg-white p-8 rounded-[2.5rem] shadow-xl shadow-slate-200/50 border border-white/50 flex flex-col items-center text-center space-y-6 relative overflow-hidden group">
                        <div className="absolute top-0 left-0 w-full h-24 bg-gradient-to-r from-blue-600 to-indigo-600 opacity-10"></div>

                        <div className="relative">
                            <div className="w-32 h-32 rounded-full border-4 border-white shadow-2xl overflow-hidden bg-slate-100 flex items-center justify-center relative group-hover:scale-105 transition duration-500">
                                {avatarPreview ? (
                                    <img src={avatarPreview} alt="Profile" className="w-full h-full object-cover" />
                                ) : (
                                    <UserIcon size={48} className="text-slate-300" />
                                )}
                            </div>
                            <label className="absolute bottom-0 right-0 p-2 bg-slate-900 text-white rounded-full cursor-pointer hover:bg-blue-600 transition shadow-lg transform translate-y-2 group-hover:translate-y-0">
                                <Camera size={16} />
                                <input type="file" className="hidden" accept="image/*" onChange={handleAvatarChange} />
                            </label>
                        </div>

                        <div>
                            <h3 className="text-xl font-black text-slate-800">{currentUser.name}</h3>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">{currentUser.username}</p>
                        </div>

                        <div className="w-full pt-6 border-t border-slate-50">
                            <div className="flex items-center justify-center gap-2 text-slate-400">
                                <CheckCircle2 size={14} className="text-emerald-500" />
                                <span className="text-[10px] font-black uppercase tracking-widest">Akun Terverifikasi</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* RIGHT COLUMN - FORM */}
                <div className="col-span-2">
                    <div className="bg-white p-8 md:p-10 rounded-[2.5rem] shadow-xl shadow-slate-200/50 border border-white/50 space-y-8">

                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Display Name</label>
                                <div className="relative group">
                                    <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-500 transition" size={18} />
                                    <input
                                        type="text"
                                        value={formData.name}
                                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                                        className="w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-transparent rounded-2xl font-bold text-sm text-slate-700 outline-none focus:bg-white focus:border-blue-500 transition shadow-sm"
                                        placeholder="Nama Lengkap"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Username (ID)</label>
                                <div className="relative group opacity-60">
                                    <AtSign className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                                    <input
                                        type="text"
                                        value={formData.username}
                                        disabled
                                        className="w-full pl-12 pr-4 py-4 bg-slate-100 border-2 border-transparent rounded-2xl font-bold text-sm text-slate-400 outline-none cursor-not-allowed"
                                    />
                                </div>
                                <p className="text-[9px] text-slate-400 ml-2 font-bold uppercase italic">Username tidak dapat diubah oleh pengguna.</p>
                            </div>
                        </div>

                        <div className="grid md:grid-cols-2 gap-6 pt-6 border-t border-slate-50">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Telegram Username</label>
                                <div className="relative group">
                                    <AtSign className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-500 transition" size={18} />
                                    <input
                                        type="text"
                                        value={formData.telegramUsername}
                                        onChange={e => setFormData({ ...formData, telegramUsername: e.target.value })}
                                        className="w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-transparent rounded-2xl font-bold text-sm text-slate-700 outline-none focus:bg-white focus:border-blue-500 transition shadow-sm"
                                        placeholder="tanpa @"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Ubah Password</label>
                                <div className="relative group">
                                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-500 transition" size={18} />
                                    <input
                                        type="password"
                                        value={formData.password}
                                        onChange={e => setFormData({ ...formData, password: e.target.value })}
                                        className="w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-transparent rounded-2xl font-bold text-sm text-slate-700 outline-none focus:bg-white focus:border-blue-500 transition shadow-sm"
                                        placeholder="Isi jika ingin mengganti"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="pt-6">
                            <button
                                type="submit"
                                disabled={loading || isUploading}
                                className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-[0.2em] shadow-xl hover:bg-blue-600 transition disabled:opacity-50 flex items-center justify-center gap-3"
                            >
                                {loading || isUploading ? <span className="animate-spin text-xl">⏳</span> : <Save size={20} />}
                                {loading ? 'Menyimpan...' : isUploading ? 'MENGUNGGAH FOTO...' : 'SIMPAN PERUBAHAN'}
                            </button>
                        </div>
                    </div>
                </div>
            </form>
        </div>
    );
};

export default ProfileModule;
