
import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import Layout from './components/Layout';
import Kanban from './components/Kanban';
import AttendanceModule from './components/Attendance';
import FinanceModule from './components/Finance';
import DailyReportModule from './components/DailyReport';
import RequestsModule from './components/Requests';
import PayrollModule from './components/Payroll';
import { useStore } from './store';
import { UserRole, KanbanStatus, User, CompanyProfile } from './types';
import { 
  LogIn, Search, Landmark, Plus, 
  ArrowUpRight, Zap, Target, Users as UsersIcon,
  MapPin, Bot, Clock, FileText, CheckCircle2,
  Building, Phone, Image as ImageIcon, AlignLeft, AlignCenter, AlignRight, Trash2, Layout as LayoutIcon, Unlock
} from 'lucide-react';
import { formatCurrency } from './utils';
import { ToastContainer, useToast } from './components/Toast';
import { CelebrationOverlay } from './components/Celebration';

const LoginScreen: React.FC<{ store: ReturnType<typeof useStore> }> = ({ store }) => {
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
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
      setTimeout(() => navigate(`/${roleSlug}/kanban`), 500);
    } catch (err: any) {
      const errorMsg = err?.message || 'Login gagal. Periksa koneksi, username, dan password Anda.';
      toast.error(errorMsg);
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-0 -left-20 w-80 h-80 bg-blue-600/20 blur-[120px] rounded-full"></div>
      <div className="absolute bottom-0 -right-20 w-80 h-80 bg-indigo-600/20 blur-[120px] rounded-full"></div>
      <div className="w-full max-w-md bg-white rounded-[3rem] shadow-2xl overflow-hidden border border-white/10 relative z-10">
        <div className="bg-slate-900 p-10 text-white text-center">
          <div className="w-20 h-20 bg-blue-600 rounded-[2rem] flex items-center justify-center mx-auto mb-6 shadow-xl shadow-blue-500/30">
            <Zap className="text-white fill-white" size={32} />
          </div>
          <h1 className="text-4xl font-black tracking-tight text-white mb-2 italic">
            SDM <span className="text-blue-500">ERP</span>
          </h1>
          <p className="text-slate-400 text-xs uppercase font-black tracking-[0.3em]">Management Portal V2.1</p>
        </div>
        <div className="p-10 space-y-8">
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Username Login</label>
              <div className="relative">
                <LogIn className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                <input
                  className="w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-transparent focus:border-blue-500 focus:bg-white rounded-2xl outline-none transition font-bold"
                  placeholder="username_sdm"
                  value={loginUsername}
                  onChange={e => setLoginUsername(e.target.value)}
                  onKeyPress={e => e.key === 'Enter' && handleLogin()}
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Password</label>
              <input
                type="password"
                className="w-full px-4 py-4 bg-slate-50 border-2 border-transparent focus:border-blue-500 focus:bg-white rounded-2xl outline-none transition font-bold"
                placeholder="••••••••"
                value={loginPassword}
                onChange={e => setLoginPassword(e.target.value)}
                onKeyPress={e => e.key === 'Enter' && handleLogin()}
              />
            </div>
            <button
              onClick={() => handleLogin()}
              disabled={isLoading}
              className="w-full bg-slate-900 text-white py-5 rounded-[1.5rem] font-black text-sm uppercase tracking-widest hover:bg-blue-600 transition transform active:scale-95 shadow-2xl disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'MEMVERIFIKASI...' : 'AUTENTIKASI MASUK'}
            </button>
          </div>
          <div className="pt-8 border-t border-slate-100 text-center">
            <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-6 underline decoration-blue-500 decoration-2">
              Quick Access (Beta)
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => handleLogin('owner', 'owner123')}
                className="bg-slate-50 p-3 rounded-xl text-[9px] font-black text-slate-500 uppercase hover:bg-blue-600 hover:text-white transition shadow-sm"
              >
                OWNER
              </button>
              <button
                onClick={() => handleLogin('manager', 'manager123')}
                className="bg-slate-50 p-3 rounded-xl text-[9px] font-black text-slate-500 uppercase hover:bg-blue-600 hover:text-white transition shadow-sm"
              >
                MANAGER
              </button>
              <button
                onClick={() => handleLogin('finance', 'finance123')}
                className="bg-slate-50 p-3 rounded-xl text-[9px] font-black text-slate-500 uppercase hover:bg-blue-600 hover:text-white transition shadow-sm"
              >
                FINANCE
              </button>
              <button
                onClick={() => handleLogin('staff', 'staff123')}
                className="bg-slate-50 p-3 rounded-xl text-[9px] font-black text-slate-500 uppercase hover:bg-blue-600 hover:text-white transition shadow-sm"
              >
                STAFF
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const ProtectedApp: React.FC<{ store: ReturnType<typeof useStore> }> = ({ store }) => {
  const { role } = useParams<{ role: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const toast = useToast();
  const [showCelebration, setShowCelebration] = useState(false);
  const [celebrationMessage, setCelebrationMessage] = useState('');

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  useEffect(() => {
    if (!store.currentUser) {
      navigate('/login', { replace: true });
    }
  }, [store.currentUser, navigate]);

  if (!store.currentUser) {
    return null;
  }

  const userRoleSlug = store.currentUser.role.toLowerCase();

  // Jika URL role tidak sesuai dengan role user, redirect ke role yang benar
  if (!role || role.toLowerCase() !== userRoleSlug) {
    return <Navigate to={`/${userRoleSlug}/kanban`} replace />;
  }

  const pathParts = location.pathname.split('/');
  const tabSlug = pathParts[2] || 'kanban';

  const activeTab = tabSlug === 'dashboard' ? 'dashboard'
    : tabSlug === 'attendance' ? 'attendance'
    : tabSlug === 'payroll' ? 'payroll'
    : tabSlug === 'finance' ? 'finance'
    : tabSlug === 'daily-report' ? 'daily-report'
    : tabSlug === 'requests' ? 'requests'
    : tabSlug === 'users' ? 'users'
    : tabSlug === 'settings' ? 'settings'
    : 'kanban';

  const handleTabChange = (tab: string) => {
    const target =
      tab === 'dashboard' ? `/${userRoleSlug}/dashboard` :
      tab === 'attendance' ? `/${userRoleSlug}/attendance` :
      tab === 'payroll' ? `/${userRoleSlug}/payroll` :
      tab === 'finance' ? `/${userRoleSlug}/finance` :
      tab === 'daily-report' ? `/${userRoleSlug}/daily-report` :
      tab === 'requests' ? `/${userRoleSlug}/requests` :
      tab === 'users' ? `/${userRoleSlug}/users` :
      tab === 'settings' ? `/${userRoleSlug}/settings` :
      `/${userRoleSlug}/kanban`;
    navigate(target);
  };

  return (
    <>
      <ToastContainer toasts={toast.toasts} onRemove={toast.removeToast} />
      <CelebrationOverlay 
        show={showCelebration} 
        onClose={() => setShowCelebration(false)}
        message={celebrationMessage}
        type="success"
      />
      <Layout
        userRole={store.currentUser.role}
        activeTab={activeTab}
        onTabChange={handleTabChange}
        onLogout={() => {
          store.logout();
          toast.info('Anda telah keluar dari sistem.');
        }}
        userName={store.currentUser.name}
      >
        <div className="max-w-7xl mx-auto">
          <Routes>
            <Route path="dashboard" element={<OwnerDashboard store={store} toast={toast} />} />
            <Route path="kanban" element={<Kanban projects={store.projects} users={store.users} currentUser={store.currentUser} settings={store.settings} onAddProject={store.addProject} onUpdateProject={store.updateProject} toast={toast} onCelebrate={(msg) => { setCelebrationMessage(msg); setShowCelebration(true); }} />} />
            <Route path="attendance" element={<AttendanceModule currentUser={store.currentUser} settings={store.settings} attendanceLog={store.attendance} onAddAttendance={store.addAttendance} onUpdateAttendance={store.updateAttendance} onUpdateSettings={store.updateSettings} toast={toast} uploadFile={store.uploadFile} />} />
            <Route path="payroll" element={<PayrollModule currentUser={store.currentUser} users={store.users} salaryConfigs={store.salaryConfigs} attendance={store.attendance} settings={store.settings} payrollRecords={store.payrollRecords} onUpdateSalary={store.updateSalaryConfig} onAddPayroll={store.addPayrollRecord} toast={toast} />} />
            <Route path="finance" element={<FinanceModule transactions={store.transactions} onAddTransaction={store.addTransaction} toast={toast} uploadFile={store.uploadFile} />} />
            <Route path="daily-report" element={<DailyReportModule currentUser={store.currentUser} users={store.users} reports={store.dailyReports} onAddReport={store.addDailyReport} toast={toast} />} />
            <Route path="requests" element={<RequestsModule currentUser={store.currentUser} requests={store.requests} onAddRequest={store.addRequest} onUpdateRequest={store.updateRequest} toast={toast} uploadFile={store.uploadFile} />} />
            <Route path="users" element={<UserManagement users={store.users} currentUser={store.currentUser} onAddUser={store.addUser} onResetDevice={store.resetDevice} toast={toast} />} />
            <Route path="settings" element={<AppSettings store={store} toast={toast} />} />
            <Route path="*" element={<Navigate to={`/${userRoleSlug}/kanban`} replace />} />
          </Routes>
        </div>
      </Layout>
    </>
  );
};

const AppShell: React.FC = () => {
  const store = useStore();
  const location = useLocation();

  if (!store.loaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white">
        <p className="text-xs font-black tracking-[0.3em] uppercase text-slate-400">Memuat data sistem...</p>
      </div>
    );
  }

  const isLoginRoute = location.pathname === '/login';

  if (!store.currentUser && !isLoginRoute) {
    return <Navigate to="/login" replace />;
  }

  if (store.currentUser && isLoginRoute) {
    const roleSlug = store.currentUser.role.toLowerCase();
    return <Navigate to={`/${roleSlug}/kanban`} replace />;
  }

  return (
    <Routes>
      <Route path="/login" element={<LoginScreen store={store} />} />
      <Route path="/:role/*" element={<ProtectedApp store={store} />} />
      <Route
        path="*"
        element={
          store.currentUser
            ? <Navigate to={`/${store.currentUser.role.toLowerCase()}/kanban`} replace />
            : <Navigate to="/login" replace />
        }
      />
    </Routes>
  );
};

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  );
};

const OwnerDashboard = ({ store, toast }: any) => {
  const totalBalance = store.transactions.reduce((acc: number, curr: any) => curr.type === 'IN' ? acc + curr.amount : acc - curr.amount, 0);
  const activeProjects = store.projects.filter((p: any) => p.status !== KanbanStatus.DONE);
  const totalTasks = store.projects.reduce((acc, p) => acc + p.tasks.length, 0);
  const completedTasks = store.projects.reduce((acc, p) => acc + p.tasks.filter(t => t.isCompleted).length, 0);
  const progressPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  return (
    <div className="space-y-10 animate-in fade-in duration-700">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-slate-900 rounded-[3rem] p-10 text-white relative overflow-hidden shadow-2xl">
           <div className="absolute top-0 right-0 w-80 h-80 bg-blue-600/30 blur-[120px] rounded-full -mr-32 -mt-32"></div>
           <div className="relative z-10 space-y-10">
              <div className="space-y-3">
                 <h2 className="text-5xl font-black tracking-tight leading-none italic">Status Perusahaan</h2>
                 <p className="text-slate-400 font-bold text-base uppercase tracking-widest">PERFORMANCE SUMMARY V2.1</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 border-t border-white/5 pt-8">
                 <div className="space-y-2">
                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-400">LIQUID ASSETS</p>
                    <p className="text-3xl font-black tracking-tighter">{formatCurrency(totalBalance)}</p>
                 </div>
                 <div className="space-y-2">
                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-emerald-400">PROGRES PROYEK</p>
                    <p className="text-3xl font-black tracking-tighter">{progressPercent}%</p>
                 </div>
                 <div className="space-y-2">
                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-400">TOTAL AKTIVITAS</p>
                    <p className="text-3xl font-black tracking-tighter">{store.dailyReports.length} DATA</p>
                 </div>
              </div>
           </div>
        </div>
        <div className="bg-blue-600 rounded-[3rem] p-10 text-white shadow-2xl flex flex-col justify-between group overflow-hidden relative">
           <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-1000"></div>
           <div>
              <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center mb-8 shadow-xl"><Target className="text-white" size={32} /></div>
              <h3 className="text-2xl font-black uppercase tracking-widest leading-none mb-3">GOALS UPDATE</h3>
              <p className="text-blue-100 text-sm font-bold leading-relaxed">{activeProjects.length} Proyek sedang berjalan, {store.requests.filter((r: any) => r.status === 'PENDING').length} Izin menunggu approval.</p>
           </div>
           <button className="w-full bg-white text-blue-600 py-5 rounded-[1.5rem] font-black text-xs uppercase tracking-widest mt-8 hover:shadow-2xl transition shadow-xl">MANAGE OPERATIONS</button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
         <StatCard icon={<Landmark />} label="Cash On Bank" value={formatCurrency(totalBalance)} sub="Healthy Runway" />
         <StatCard icon={<CheckCircle2 />} label="Tasks Done" value={completedTasks.toString()} sub={`From ${totalTasks} total`} />
         <StatCard icon={<FileText />} label="Daily Logs" value={store.dailyReports.length.toString()} sub="Team activity" />
         <StatCard icon={<UsersIcon />} label="Team Size" value={store.users.length.toString()} sub="Active personnel" />
      </div>
    </div>
  );
};

const StatCard = ({ icon, label, value, sub }: any) => (
  <div className="bg-white p-10 rounded-[2.5rem] shadow-sm border border-slate-100 space-y-6 hover:shadow-2xl transition-all group relative overflow-hidden">
    <div className={`w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-blue-600 group-hover:text-white transition-all duration-500`}>{icon}</div>
    <div>
      <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] mb-1">{label}</p>
      <div className="flex items-center gap-3">
        <p className="text-2xl font-black text-slate-800 tracking-tight">{value}</p>
      </div>
      <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest mt-2">{sub}</p>
    </div>
  </div>
);

const UserManagement = ({ users, currentUser, onAddUser, onResetDevice, toast }: { users: User[], currentUser: User | null, onAddUser: (u: User) => void, onResetDevice: (id: string) => Promise<boolean>, toast: ReturnType<typeof useToast> }) => {
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
        role: newUser.role,
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
                 <select className="w-full p-4 bg-slate-50 border-2 border-transparent focus:border-blue-600 focus:bg-white rounded-2xl outline-none font-black text-xs uppercase tracking-widest transition shadow-sm" value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value as UserRole})}>
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

const AppSettings = ({ store, toast }: any) => {
  const [botToken, setBotToken] = useState(store.settings.telegramBotToken);
  const [groupId, setGroupId] = useState(store.settings.telegramGroupId);
  const [ownerChatId, setOwnerChatId] = useState(store.settings.telegramOwnerChatId);
  const [officeLoc, setOfficeLoc] = useState(store.settings.officeLocation);
  const [companyProfile, setCompanyProfile] = useState<CompanyProfile>(store.settings.companyProfile);
  const [mapActive, setMapActive] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (mapActive) {
      import('leaflet').then(L => {
        const container = document.getElementById('map-picker');
        if (!container) return;
        if ((container as any)._leaflet_id) return;
        const map = L.map('map-picker').setView([officeLoc.lat, officeLoc.lng], 15);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
        let marker = L.marker([officeLoc.lat, officeLoc.lng], { draggable: true }).addTo(map);
        marker.on('dragend', () => {
          const pos = marker.getLatLng();
          setOfficeLoc({ lat: pos.lat, lng: pos.lng });
        });
        map.on('click', (e) => {
          marker.setLatLng(e.latlng);
          setOfficeLoc({ lat: e.latlng.lat, lng: e.latlng.lng });
        });
      });
    }
  }, [mapActive]);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setCompanyProfile({...companyProfile, logoUrl: reader.result as string});
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await store.updateSettings({ 
        telegramBotToken: botToken, 
        telegramGroupId: groupId, 
        telegramOwnerChatId: ownerChatId, 
        officeLocation: officeLoc,
        companyProfile: companyProfile
      });
      toast.success("Konfigurasi Sistem Berhasil Diperbarui!");
    } catch (err: any) {
      toast.error(err?.message || 'Gagal menyimpan konfigurasi. Periksa koneksi dan coba lagi.');
    } finally {
      setIsSaving(false);
    }
  };

  if (store.currentUser.role !== UserRole.OWNER) {
    return (
      <div className="p-20 text-center bg-white rounded-[4rem] shadow-xl border border-slate-100">
        <h3 className="text-2xl font-black text-rose-500 uppercase tracking-tighter">Akses Terbatas</h3>
        <p className="text-slate-400 font-bold mt-2">Tab Pengaturan hanya tersedia untuk Owner.</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-10 pb-20 animate-in fade-in duration-500">
       <div className="bg-white p-12 rounded-[3rem] shadow-xl border border-slate-100 space-y-12 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 blur-3xl rounded-full -mr-16 -mt-16"></div>
          <div className="flex items-center justify-between relative z-10">
             <div className="flex items-center space-x-6">
                <div className="w-16 h-16 bg-indigo-600 rounded-[1.5rem] flex items-center justify-center text-white shadow-2xl"><Building size={32} /></div>
                <div><h3 className="text-3xl font-black text-slate-800 tracking-tight leading-none uppercase italic">Profil & Kop Perusahaan</h3><p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mt-2">PENGATURAN IDENTITAS RESMI SLIP GAJI</p></div>
             </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">LOGO PERUSAHAAN</label>
                <div className="flex gap-4">
                  {!companyProfile.logoUrl ? (
                    <label className="flex-1 h-32 bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl flex flex-col items-center justify-center cursor-pointer hover:bg-blue-50 hover:border-blue-300 transition group">
                      <ImageIcon className="text-slate-300 group-hover:text-blue-500 mb-2" size={24} />
                      <span className="text-[9px] font-black text-slate-400 uppercase">UPLOAD LOGO</span>
                      <input type="file" className="hidden" accept="image/*" onChange={handleLogoUpload} />
                    </label>
                  ) : (
                    <div className="relative flex-1 h-32 bg-slate-50 rounded-3xl border border-slate-100 overflow-hidden group">
                      <img src={companyProfile.logoUrl} alt="Logo" className="w-full h-full object-contain p-4" />
                      <button onClick={() => setCompanyProfile({...companyProfile, logoUrl: ''})} className="absolute top-2 right-2 p-2 bg-rose-500 text-white rounded-xl opacity-0 group-hover:opacity-100 transition shadow-lg">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">POSISI LOGO</label>
                    <div className="flex bg-slate-100 p-1 rounded-2xl">
                       <button onClick={() => setCompanyProfile({...companyProfile, logoPosition: 'top'})} className={`flex-1 py-3 rounded-xl transition text-[9px] font-black uppercase ${companyProfile.logoPosition === 'top' ? 'bg-white shadow text-blue-600' : 'text-slate-400'}`}>ATAS</button>
                       <button onClick={() => setCompanyProfile({...companyProfile, logoPosition: 'left'})} className={`flex-1 py-3 rounded-xl transition text-[9px] font-black uppercase ${companyProfile.logoPosition === 'left' ? 'bg-white shadow text-blue-600' : 'text-slate-400'}`}>KIRI</button>
                       <button onClick={() => setCompanyProfile({...companyProfile, logoPosition: 'right'})} className={`flex-1 py-3 rounded-xl transition text-[9px] font-black uppercase ${companyProfile.logoPosition === 'right' ? 'bg-white shadow text-blue-600' : 'text-slate-400'}`}>KANAN</button>
                    </div>
                 </div>
                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">ALIGMENT TEKS</label>
                    <div className="flex bg-slate-100 p-1.5 rounded-2xl">
                       <button onClick={() => setCompanyProfile({...companyProfile, textAlignment: 'left'})} className={`flex-1 flex items-center justify-center py-3 rounded-xl transition ${companyProfile.textAlignment === 'left' ? 'bg-white shadow text-blue-600' : 'text-slate-400'}`}>
                          <AlignLeft size={18} />
                       </button>
                       <button onClick={() => setCompanyProfile({...companyProfile, textAlignment: 'center'})} className={`flex-1 flex items-center justify-center py-3 rounded-xl transition ${companyProfile.textAlignment === 'center' ? 'bg-white shadow text-blue-600' : 'text-slate-400'}`}>
                          <AlignCenter size={18} />
                       </button>
                       <button onClick={() => setCompanyProfile({...companyProfile, textAlignment: 'right'})} className={`flex-1 flex items-center justify-center py-3 rounded-xl transition ${companyProfile.textAlignment === 'right' ? 'bg-white shadow text-blue-600' : 'text-slate-400'}`}>
                          <AlignRight size={18} />
                       </button>
                    </div>
                 </div>
              </div>

              <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">NAMA PERUSAHAAN</label>
                  <input className="w-full p-4 bg-slate-50 border-2 border-transparent focus:border-indigo-600 rounded-2xl outline-none font-black transition" value={companyProfile.name} onChange={e => setCompanyProfile({...companyProfile, name: e.target.value})} />
              </div>
              <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">ALAMAT LENGKAP</label>
                  <textarea className="w-full p-4 bg-slate-50 border-2 border-transparent focus:border-indigo-600 rounded-2xl outline-none font-bold text-sm h-24 transition" value={companyProfile.address} onChange={e => setCompanyProfile({...companyProfile, address: e.target.value})} />
              </div>
              <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">TELEPON / KONTAK</label>
                  <input className="w-full p-4 bg-slate-50 border-2 border-transparent focus:border-indigo-600 rounded-2xl outline-none font-black transition" value={companyProfile.phone} onChange={e => setCompanyProfile({...companyProfile, phone: e.target.value})} />
              </div>
            </div>

            <div className="space-y-6">
               <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">LIVE PREVIEW KOP SURAT</label>
               <div className="bg-white border-2 border-slate-100 rounded-[3rem] p-10 aspect-[1/0.6] shadow-inner relative overflow-hidden flex flex-col justify-center">
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-blue-500 to-indigo-500"></div>
                  
                  <div className={`flex w-full items-center gap-6 ${
                    companyProfile.logoPosition === 'top' ? 'flex-col' : 
                    companyProfile.logoPosition === 'right' ? 'flex-row-reverse' : 'flex-row'
                  }`}>
                    {companyProfile.logoUrl ? (
                      <img src={companyProfile.logoUrl} className="h-20 w-auto object-contain" alt="Preview Logo" />
                    ) : (
                      <div className="h-20 w-20 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-300 flex-shrink-0">
                        <ImageIcon size={32} />
                      </div>
                    )}
                    
                    <div className={`flex-1 space-y-1 ${
                      companyProfile.textAlignment === 'left' ? 'text-left' :
                      companyProfile.textAlignment === 'right' ? 'text-right' : 'text-center'
                    }`}>
                      <h4 className="text-xl font-black text-slate-800 leading-none mb-2 uppercase tracking-tight">{companyProfile.name || 'NAMA PERUSAHAAN'}</h4>
                      <p className="text-[10px] font-bold text-slate-400 leading-relaxed">{companyProfile.address || 'Alamat Perusahaan...'}</p>
                      <p className="text-[9px] font-black text-indigo-600 mt-2">{companyProfile.phone || '08xxxxxxx'}</p>
                    </div>
                  </div>
                  
                  <div className="w-full h-[1px] bg-slate-100 mt-8 mb-4"></div>
                  <div className="w-full text-center">
                    <span className="text-[8px] font-black uppercase text-slate-300 tracking-[0.4em]">ISI SLIP GAJI OTOMATIS</span>
                  </div>
               </div>
               <p className="text-[9px] font-medium text-slate-400 italic text-center leading-relaxed px-10">Tata letak di atas akan digunakan secara presisi pada PDF Slip Gaji Karyawan.</p>
            </div>
          </div>
       </div>

       <div className="bg-white p-12 rounded-[3rem] shadow-xl border border-slate-100 space-y-10 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 blur-3xl rounded-full -mr-16 -mt-16"></div>
          <div className="flex items-center space-x-6 relative z-10">
             <div className="w-16 h-16 bg-blue-600 rounded-[1.5rem] flex items-center justify-center text-white shadow-2xl"><Bot size={32} /></div>
             <div><h3 className="text-3xl font-black text-slate-800 tracking-tight leading-none uppercase italic">Koneksi Telegram</h3><p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mt-2">SENTRAL NOTIFIKASI & PENGIRIMAN SLIP</p></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
            <div className="space-y-3">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">BOT API TOKEN</label>
              <input type="password" className="w-full p-5 bg-slate-50 border-2 border-transparent focus:border-blue-600 focus:bg-white rounded-2xl outline-none font-mono text-xs font-bold transition shadow-inner" value={botToken} onChange={e => setBotToken(e.target.value)} placeholder="00000000:AAxxxx..." />
            </div>
            <div className="space-y-3">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">GROUP ID (LOGS)</label>
              <input className="w-full p-5 bg-slate-50 border-2 border-transparent focus:border-blue-600 focus:bg-white rounded-2xl outline-none font-mono text-xs font-bold transition shadow-inner" value={groupId} onChange={e => setGroupId(e.target.value)} placeholder="-100xxxxxxxxx" />
            </div>
          </div>
       </div>

       <div className="bg-white p-12 rounded-[3rem] shadow-xl border border-slate-100 space-y-10 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50 blur-3xl rounded-full -mr-16 -mt-16"></div>
          <div className="flex items-center space-x-6 relative z-10">
             <div className="w-16 h-16 bg-emerald-500 rounded-[1.5rem] flex items-center justify-center text-white shadow-2xl"><MapPin size={32} /></div>
             <div><h3 className="text-3xl font-black text-slate-800 tracking-tight leading-none uppercase italic">Geofencing Kantor</h3><p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mt-2">PENETAPAN RADIUS KEHADIRAN AKTIF</p></div>
          </div>
          {!mapActive ? (
            <button onClick={() => setMapActive(true)} className="w-full h-40 bg-slate-50 border-2 border-dashed border-slate-200 rounded-[2.5rem] text-[11px] font-black uppercase text-slate-400 hover:text-blue-600 transition flex flex-col items-center justify-center gap-4 group hover:border-blue-300 shadow-inner">
               <MapPin size={32} className="group-hover:animate-bounce" /> KLIK UNTUK AKTIFKAN MAP PICKER
            </button>
          ) : (
            <div className="space-y-6 animate-in slide-in-from-top-4 duration-500">
              <div id="map-picker" className="shadow-2xl border-4 border-white"></div>
              <div className="grid grid-cols-2 gap-4">
                 <div className="p-5 bg-slate-50 rounded-2xl text-center shadow-inner border border-slate-100"><p className="text-[9px] font-black uppercase text-slate-400 mb-1 tracking-widest">LATITUDE</p><p className="text-xs font-black text-slate-800">{officeLoc.lat.toFixed(6)}</p></div>
                 <div className="p-5 bg-slate-50 rounded-2xl text-center shadow-inner border border-slate-100"><p className="text-[9px] font-black uppercase text-slate-400 mb-1 tracking-widest">LONGITUDE</p><p className="text-xs font-black text-slate-800">{officeLoc.lng.toFixed(6)}</p></div>
              </div>
            </div>
          )}
          <button onClick={handleSave} disabled={isSaving} className="w-full bg-slate-900 text-white py-6 rounded-[2.5rem] font-black uppercase tracking-[0.2em] text-xs hover:bg-blue-600 transition shadow-2xl shadow-slate-300 disabled:opacity-50 disabled:cursor-not-allowed">
            {isSaving ? 'MENYIMPAN...' : 'SIMPAN SEMUA KONFIGURASI'}
          </button>
       </div>
    </div>
  );
};

export default App;
