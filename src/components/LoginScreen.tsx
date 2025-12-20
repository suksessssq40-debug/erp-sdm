import React, { useState } from 'react';
import { LogIn, Zap } from 'lucide-react';
import { useStore } from '../store';
import { useRouter } from 'next/navigation'; // Changed from react-router-dom
import { useToast } from './Toast';

export const LoginScreen: React.FC<{ store: ReturnType<typeof useStore> }> = ({ store }) => {
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const toast = useToast();

  const handleLogin = async (usernameOverride?: string, passwordOverride?: string) => {
    const username = usernameOverride ?? loginUsername;
    const password = passwordOverride ?? loginPassword;
    
    if (!username || !password) {
      toast.warning('Username dan password wajib diisi.');
      return;
    }

    setIsLoading(true);
    try {
      const user = await store.login(username, password);
      if (!user) {
        toast.error('Login gagal. Periksa koneksi atau kredensial Anda.');
        setIsLoading(false);
        return;
      }
      toast.success(`Selamat datang, ${user.name}!`);
      const roleSlug = user.role.toLowerCase();
      setTimeout(() => router.push(`/${roleSlug}/kanban`), 500); // Changed navigate
    } catch (err: any) {
      const errorMsg = err?.message || 'Login gagal. Periksa koneksi, username, dan password Anda.';
      toast.error(errorMsg);
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Dynamic Background */}
      <div className="absolute top-0 -left-20 w-96 h-96 bg-blue-600/30 blur-[150px] rounded-full animate-pulse-slow"></div>
      <div className="absolute bottom-0 -right-20 w-96 h-96 bg-indigo-600/30 blur-[150px] rounded-full animate-pulse-slow delay-1000"></div>
      
      {/* Login Card */}
      <div className="w-full max-w-md bg-white/10 backdrop-blur-2xl rounded-[2.5rem] shadow-2xl border border-white/10 relative z-10 overflow-hidden">
        
        {/* Header */}
        <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-12 text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20"></div>
          <div className="relative z-10">
            <div className="w-20 h-20 bg-white/10 backdrop-blur-md rounded-[2rem] flex items-center justify-center mx-auto mb-6 shadow-xl border border-white/20">
              <Zap className="text-white fill-white" size={36} />
            </div>
            <h1 className="text-4xl font-black tracking-tight text-white mb-2 font-sans">
              SDM <span className="text-blue-200">ERP</span>
            </h1>
            <p className="text-blue-100/80 text-[10px] uppercase font-black tracking-[0.3em]">Enterprise Portal V2.1</p>
          </div>
        </div>

        {/* Form Body */}
        <div className="p-10 space-y-8 bg-white/95">
          <div className="space-y-6">
            
            {/* Username Input */}
            <div className="space-y-2 group">
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest group-focus-within:text-blue-600 transition-colors">Username ID</label>
              <div className="relative">
                <LogIn className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-500 transition-colors" size={20} />
                <input
                  className="w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-slate-100 focus:border-blue-500 focus:bg-white rounded-2xl outline-none transition-all font-bold text-slate-700 placeholder-slate-300"
                  placeholder="Masukkan username anda..."
                  value={loginUsername}
                  onChange={e => setLoginUsername(e.target.value)}
                  onKeyPress={e => e.key === 'Enter' && handleLogin()}
                />
              </div>
            </div>

            {/* Password Input */}
            <div className="space-y-2 group">
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest group-focus-within:text-blue-600 transition-colors">Password Keamanan</label>
              <input
                type="password"
                className="w-full px-4 py-4 bg-slate-50 border-2 border-slate-100 focus:border-blue-500 focus:bg-white rounded-2xl outline-none transition-all font-bold text-slate-700 placeholder-slate-300"
                placeholder="••••••••••••"
                value={loginPassword}
                onChange={e => setLoginPassword(e.target.value)}
                onKeyPress={e => e.key === 'Enter' && handleLogin()}
              />
            </div>

            {/* Login Button */}
            <button
              onClick={() => handleLogin()}
              disabled={isLoading}
              className="w-full bg-slate-900 text-white py-5 rounded-[1.5rem] font-black text-xs uppercase tracking-[0.2em] hover:bg-blue-700 hover:shadow-lg hover:shadow-blue-500/30 transition-all transform active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed group relative overflow-hidden"
            >
              <span className="relative z-10 flex items-center justify-center gap-2">
                {isLoading ? 'Memverifikasi...' : 'Akses Portal'}
                {!isLoading && <Zap size={16} className="group-hover:text-yellow-400 transition-colors" />}
              </span>
            </button>
          </div>
          
          <div className="text-center">
             <p className="text-xs text-slate-400 font-medium">Lupa password? Hubungi Administrator.</p>
          </div>
        </div>
      </div>
      
      {/* Footer */}
      <div className="absolute bottom-6 text-slate-500 text-[10px] font-bold tracking-widest opacity-40">
        POWERED BY SUKSES DIGITAL MEDIA
      </div>
    </div>
  );
};
