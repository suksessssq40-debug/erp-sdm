
import React from 'react';
import { UserRole } from '../types';
import { 
  LayoutDashboard, 
  Trello, 
  CalendarCheck, 
  FileText, 
  Wallet, 
  Users, 
  Settings, 
  LogOut,
  Clock,
  CreditCard,
  Menu,
  X
} from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  userRole: UserRole;
  activeTab: string;
  onTabChange: (tab: string) => void;
  onLogout: () => void;
  userName: string;
}

const Layout: React.FC<LayoutProps> = ({ children, userRole, activeTab, onTabChange, onLogout, userName }) => {
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);
  
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: [UserRole.OWNER] },
    { id: 'kanban', label: 'Project Kanban', icon: Trello, roles: [UserRole.OWNER, UserRole.MANAGER, UserRole.FINANCE, UserRole.STAFF] },
    { id: 'attendance', label: 'Absensi', icon: CalendarCheck, roles: [UserRole.OWNER, UserRole.MANAGER, UserRole.FINANCE, UserRole.STAFF] },
    { id: 'payroll', label: 'Gaji & Slip', icon: CreditCard, roles: [UserRole.OWNER, UserRole.FINANCE] },
    { id: 'requests', label: 'Permohonan', icon: FileText, roles: [UserRole.OWNER, UserRole.MANAGER, UserRole.FINANCE, UserRole.STAFF] },
    { id: 'daily-report', label: 'Daily Report', icon: Clock, roles: [UserRole.OWNER, UserRole.MANAGER, UserRole.FINANCE, UserRole.STAFF] },
    { id: 'finance', label: 'Arus Kas', icon: Wallet, roles: [UserRole.OWNER, UserRole.FINANCE] },
    { id: 'users', label: 'User Management', icon: Users, roles: [UserRole.OWNER, UserRole.MANAGER] },
    { id: 'settings', label: 'Settings', icon: Settings, roles: [UserRole.OWNER] },
  ];

  const visibleNav = navItems.filter(item => item.roles.includes(userRole));
  
  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden relative">
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-20 md:hidden backdrop-blur-sm"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar - Fixed on Mobile, Static on Desktop */}
      <aside className={`
        fixed top-0 left-0 h-full w-64 bg-slate-900 text-white flex flex-col z-30 transition-transform duration-300 ease-in-out shadow-2xl
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        md:translate-x-0 md:static md:shadow-none
      `}>
        <div className="p-6 border-b border-slate-800 flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-blue-400 italic">SDM <span className="text-white">ERP</span></h1>
            <p className="text-[10px] text-slate-400 mt-1 font-black uppercase tracking-widest">Sukses Digital Media</p>
          </div>
          <button onClick={() => setIsSidebarOpen(false)} className="md:hidden text-slate-400 hover:text-white">
            <X size={20} />
          </button>
        </div>
        
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto custom-scrollbar">
          {visibleNav.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                onTabChange(item.id);
                setIsSidebarOpen(false);
              }}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all ${
                activeTab === item.id ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <item.icon size={20} />
              <span className="font-bold text-xs uppercase tracking-widest">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-800 bg-slate-900/50">
          <div className="mb-4 px-4">
            <p className="text-sm font-black truncate">{userName}</p>
            <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest">{userRole}</p>
          </div>
          <button
            onClick={onLogout}
            className="w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-rose-400 hover:bg-rose-500/10 transition-colors"
          >
            <LogOut size={20} />
            <span className="font-bold text-xs uppercase tracking-widest">Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto relative custom-scrollbar flex flex-col">
        <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-slate-100 px-4 md:px-8 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <button onClick={toggleSidebar} className="md:hidden p-2 bg-slate-100 rounded-lg text-slate-600 hover:bg-slate-200 transition">
              <Menu size={20} />
            </button>
            <h2 className="text-lg font-black uppercase tracking-widest text-slate-800 italic truncate">{activeTab.replace('-', ' ')}</h2>
          </div>
          <div className="flex items-center space-x-4">
            <div className="text-right hidden md:block">
               <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">Status Sesi</p>
               <p className="text-[10px] font-black text-emerald-500 uppercase">ONLINE - SECURE</p>
            </div>
            <div className="w-10 h-10 rounded-2xl bg-slate-900 flex items-center justify-center text-white font-black uppercase shadow-xl">
              {userName.charAt(0)}
            </div>
          </div>
        </header>
        <div className="p-4 md:p-8 flex-1">
          {children}
        </div>
      </main>
    </div>
  );
};

export default Layout;
