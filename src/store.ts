
import { useState, useEffect } from 'react';
import { User, UserRole, Project, Attendance, LeaveRequest, Transaction, AppSettings, DailyReport, UserSalaryConfig, PayrollRecord, SystemLog, SystemActionType } from './types';
import { INITIAL_OFFICE_LOCATION } from './constants';

const isDev = process.env.NODE_ENV === 'development';
// Changed to prefer relative path (Next.js internal API) even in dev to match Vercel environment
const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';
const CURRENT_USER_KEY = 'sdm_erp_current_user';
const CURRENT_TOKEN_KEY = 'sdm_erp_auth_token';

interface AppState {
  currentUser: User | null;
  realUser?: User | null; // For Superadmin Impersonation
  authToken?: string;
  users: User[];
  projects: Project[];
  attendance: Attendance[];
  requests: LeaveRequest[];
  transactions: Transaction[];
  dailyReports: DailyReport[];
  salaryConfigs: UserSalaryConfig[];
  payrollRecords: PayrollRecord[];
  settings: AppSettings;
  logs: SystemLog[];
}

const initialState: AppState = {
  currentUser: null,
  realUser: null,
  authToken: undefined,
  users: [],
  projects: [],
  attendance: [],
  requests: [],
  transactions: [],
  dailyReports: [],
  salaryConfigs: [],
  payrollRecords: [],
  logs: [],
  settings: {
    officeLocation: INITIAL_OFFICE_LOCATION,
    officeHours: { start: '08:00', end: '17:00' },
    telegramBotToken: '',
    telegramGroupId: '',
    telegramOwnerChatId: '',
    companyProfile: {
      name: 'Sukses Digital Media',
      address: 'Jl. Kemajuan No. 88, Jakarta Selatan',
      phone: '0812-3456-7890',
      logoUrl: '',
      logoPosition: 'top',
      textAlignment: 'center'
    }
  }
};

export const useStore = () => {
  const [state, setState] = useState<AppState>(initialState);
  const [loaded, setLoaded] = useState(false);

  // Combined Initialization Effect to prevent race conditions
  useEffect(() => {
    const initializeApp = async () => {
      // 1. Rehydrate Auth
      let currentUser: User | null = null;
      let token: string | undefined = undefined;
      
      try {
        const raw = typeof window !== 'undefined' ? window.localStorage.getItem(CURRENT_USER_KEY) : null;
        const rawToken = typeof window !== 'undefined' ? window.localStorage.getItem(CURRENT_TOKEN_KEY) : null;
        if (raw) {
          currentUser = JSON.parse(raw);
        }
        if (rawToken) {
          token = rawToken;
        }
      } catch (e) {
        console.error('Failed to read current user from localStorage:', e);
      }

      // Update state with rehydrated user immediately (before fetch to avoid UI flicker)
      if (currentUser || token) {
         setState(prev => ({ ...prev, currentUser, authToken: token }));
      }

      // 2. Bootstrap Data (only after auth is settled)
      try {
        const res = await fetch(`${API_BASE}/api/bootstrap`, { cache: 'no-store' }); // Ensure fresh data
        if (!res.ok) throw new Error('Failed to load data from backend');
        const data = await res.json();
        
        setState(prev => ({
          ...prev,
          // If local storage was empty but bootstrap implies session (unlikely in this architecture but safe to keep logic), 
          // we stick to local storage auth as truth.
          users: data.users || [],
          projects: data.projects || [],
          attendance: data.attendance || [],
          requests: data.requests || [],
          transactions: data.transactions || [],
          dailyReports: data.dailyReports || [],
          salaryConfigs: data.salaryConfigs || [],
          payrollRecords: data.payrollRecords || [],
          logs: data.logs || [],
          settings: data.settings || prev.settings
        }));
      } catch (e) {
        console.error("Bootstrap error:", e);
      } finally {
        setLoaded(true);
      }
    };

    initializeApp();
  }, []);

  const authHeaders: Record<string, string> = state.authToken
    ? { Authorization: `Bearer ${state.authToken}` }
    : {};

  // --- CENTRALIZED LOGGING FUNCTION ---
  const addLog = async (actionType: SystemActionType, details: string, target?: string, metadata?: any) => {
    if (!state.currentUser) return;

    const newLog: SystemLog = {
      id: Math.random().toString(36).substr(2, 9),
      timestamp: Date.now(),
      actorId: state.currentUser.id,
      actorName: state.currentUser.name,
      actorRole: state.currentUser.role,
      actionType,
      details,
      target,
      metadata
    };

    // Optimistic Update
    setState(prev => ({ ...prev, logs: [newLog, ...prev.logs] }));

    // Async persist to backend (Fire & Forget)
    try {
      fetch(`${API_BASE}/api/system-logs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify(newLog)
      });
    } catch (e) {
      console.error('Failed to persist log', e);
    }
  };

  const login = async (username: string, password?: string): Promise<User | null> => {
    try {
      let deviceId = typeof window !== 'undefined' ? window.localStorage.getItem('sdm_device_id') : null;
      if (!deviceId) {
         deviceId = Math.random().toString(36).substring(2) + Date.now().toString(36);
         if (typeof window !== 'undefined') window.localStorage.setItem('sdm_device_id', deviceId);
      }

      const res = await fetch(`${API_BASE}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, deviceId })
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        if (payload?.error === 'DEVICE_LOCKED_MISMATCH') {
          throw new Error('AKSES DITOLAK: Akun ini terkunci pada perangkat lain. Harap hubungi Owner untuk reset.');
        }
        throw new Error(payload?.error || 'Login failed');
      }
      const user: User = payload.user;
      const token: string | undefined = payload.token;
      
      setState(prev => ({ ...prev, currentUser: user, authToken: token as any }));
      
      // LOG LOGIN
      try {
        const loginLog: SystemLog = {
            id: Math.random().toString(36).substr(2,9),
            timestamp: Date.now(),
            actorId: user.id,
            actorName: user.name,
            actorRole: user.role,
            actionType: SystemActionType.AUTH_LOGIN,
            details: 'User logged in successfully',
            target: 'Session'
        };
        fetch(`${API_BASE}/api/system-logs`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(loginLog)
        });
        setState(prev => ({ ...prev, logs: [loginLog, ...prev.logs] }));
      } catch(e) {}

      try {
        if (typeof window !== 'undefined') {
          window.localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
          if (token) window.localStorage.setItem(CURRENT_TOKEN_KEY, token);
        }
      } catch (e) {
        console.error('Failed to persist current user:', e);
      }
      return user;
    } catch (e) {
      setState(prev => ({ ...prev, currentUser: null, authToken: undefined }));
      if (e instanceof Error) throw e;
      throw new Error('Tidak dapat terhubung ke server API.');
    }
  };

  const resetDevice = async (userId: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/users/${userId}/reset-device`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders }
      });
      if (!res.ok) throw new Error('Failed to reset device');
      
      addLog(SystemActionType.AUTH_RESET_DEVICE, `Reset device ID for user ${userId}`, userId);
      return true;
    } catch (e) {
      console.error(e);
      throw e;
    }
  };

  const logout = () => {
    addLog(SystemActionType.AUTH_LOGOUT, 'User logged out', 'Session');
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(CURRENT_USER_KEY);
        window.localStorage.removeItem(CURRENT_TOKEN_KEY);
      }
    } catch (e) {}
    setState(prev => ({ ...prev, currentUser: null, authToken: undefined as any }));
  };

  const addUser = async (user: User) => {
    try {
      const res = await fetch(`${API_BASE}/api/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify(user)
      });
      if (!res.ok) throw new Error('Failed to create user');
      const created: User = await res.json();
      setState(prev => ({ ...prev, users: [...prev.users, created] }));
      addLog(SystemActionType.USER_CREATE, `Created new user: ${created.name}`, created.id);
    } catch (e) {
      console.error(e);
      throw e;
    }
  };

  const updateUser = async (user: User) => {
    try {
      const res = await fetch(`${API_BASE}/api/users/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify(user)
      });
      if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Failed to update user');
      }
      const updated: User = await res.json();
      setState(prev => ({
        ...prev,
        users: prev.users.map(u => u.id === updated.id ? updated : u)
      }));
      addLog(SystemActionType.USER_UPDATE, `Updated user info: ${updated.name}`, updated.id);
    } catch (e) {
      console.error(e);
      throw e;
    }
  };

  const deleteUser = async (userId: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/users/${userId}`, {
        method: 'DELETE',
        headers: { ...authHeaders }
      });
      if (!res.ok) throw new Error('Failed to delete user');
      setState(prev => ({
        ...prev,
        users: prev.users.filter(u => u.id !== userId)
      }));
      addLog(SystemActionType.USER_DELETE, `Deleted user ID: ${userId}`, userId);
    } catch (e) {
      console.error(e);
      throw e;
    }
  };
  
  const updateSettings = async (settings: Partial<AppSettings>) => {
    const newSettings: AppSettings = {
      ...state.settings,
      ...settings,
      officeLocation: settings.officeLocation || state.settings.officeLocation,
      officeHours: settings.officeHours || state.settings.officeHours,
      companyProfile: settings.companyProfile || state.settings.companyProfile
    };
    try {
      const res = await fetch(`${API_BASE}/api/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify(newSettings)
      });
      if (!res.ok) throw new Error('Failed to update settings');
      setState(prev => ({ ...prev, settings: newSettings }));
      addLog(SystemActionType.SETTINGS_UPDATE, 'Updated application settings', 'Settings');
    } catch (e) {
      console.error(e);
    }
  };

  const addProject = async (project: Project) => {
    try {
      const res = await fetch(`${API_BASE}/api/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify(project)
      });
      if (!res.ok) throw new Error('Failed to create project');
      const created: Project = await res.json();
      setState(prev => ({ ...prev, projects: [...prev.projects, created] }));
      addLog(SystemActionType.PROJECT_CREATE, `Created project: ${created.title}`, created.id);
    } catch (e) {
      console.error(e);
    }
  };

  const updateProject = async (project: Project) => {
    try {
      const res = await fetch(`${API_BASE}/api/projects/${project.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify(project)
      });
      if (!res.ok) throw new Error('Failed to update project');
      const updated: Project = await res.json();
      setState(prev => ({
        ...prev,
        projects: prev.projects.map(p => p.id === updated.id ? updated : p)
      }));
      addLog(SystemActionType.PROJECT_UPDATE, `Updated project: ${updated.title} (Status: ${updated.status})`, updated.id);
    } catch (e) {
      console.error(e);
    }
  };

  const addAttendance = async (record: Attendance) => {
    try {
      const res = await fetch(`${API_BASE}/api/attendance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify(record)
      });
      if (!res.ok) throw new Error('Failed to create attendance');
      const created: Attendance = await res.json();
      setState(prev => ({ ...prev, attendance: [...prev.attendance, created] }));
      addLog(SystemActionType.ATTENDANCE_CLOCK_IN, `Clock In at ${created.timeIn} ${created.isLate ? '(LATE)' : ''}`, created.id);
    } catch (e) {
      console.error(e);
    }
  };

  const updateAttendance = async (record: Attendance) => {
    try {
      const res = await fetch(`${API_BASE}/api/attendance/${record.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify(record)
      });
      if (!res.ok) throw new Error('Failed to update attendance');
      const updated: Attendance = await res.json();
      setState(prev => ({
        ...prev,
        attendance: prev.attendance.map(a => a.id === updated.id ? updated : a)
      }));
      if (updated.timeOut) {
         addLog(SystemActionType.ATTENDANCE_CLOCK_OUT, `Clock Out at ${updated.timeOut}`, updated.id);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const addRequest = async (req: LeaveRequest) => {
    try {
      const res = await fetch(`${API_BASE}/api/requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify(req)
      });
      if (!res.ok) throw new Error('Failed to create request');
      const created: LeaveRequest = await res.json();
      setState(prev => ({ ...prev, requests: [...prev.requests, created] }));
      addLog(SystemActionType.REQUEST_CREATE, `Submitted request: ${created.type}`, created.id);
    } catch (e) {
      console.error(e);
    }
  };

  const updateRequest = async (req: LeaveRequest) => {
    try {
      const res = await fetch(`${API_BASE}/api/requests/${req.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify(req)
      });
      if (!res.ok) throw new Error('Failed to update request');
      const updated: LeaveRequest = await res.json();
      setState(prev => ({
        ...prev,
        requests: prev.requests.map(r => r.id === updated.id ? updated : r)
      }));
      addLog(SystemActionType.REQUEST_APPROVE, `Request ${updated.status}: ${updated.type}`, updated.id);
    } catch (e) {
      console.error(e);
    }
  };

  const addTransaction = async (t: Transaction) => {
    try {
      const res = await fetch(`${API_BASE}/api/transactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify(t)
      });
      if (!res.ok) throw new Error('Failed to create transaction');
      const created: Transaction = await res.json();
      setState(prev => ({ ...prev, transactions: [...prev.transactions, created] }));
      addLog(SystemActionType.FINANCE_CREATE, `Created transaction: ${created.amount} (${created.type})`, created.id);
    } catch (e) {
      console.error(e);
    }
  };

  const addDailyReport = async (report: DailyReport) => {
    try {
      const res = await fetch(`${API_BASE}/api/daily-reports`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify(report)
      });
      if (!res.ok) throw new Error('Failed to create daily report');
      const created: DailyReport = await res.json();
      setState(prev => ({ ...prev, dailyReports: [...prev.dailyReports, created] }));
      addLog(SystemActionType.PROJECT_TASK_COMPLETE, `Submitted Daily Report for ${created.date}`, created.id);
    } catch (e) {
      console.error(e);
    }
  };

  const updateSalaryConfig = async (config: UserSalaryConfig) => {
    try {
      const res = await fetch(`${API_BASE}/api/salary-configs/${config.userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify(config)
      });
      if (!res.ok) throw new Error('Failed to update salary config');
      const updated: UserSalaryConfig = await res.json();
      setState(prev => {
        const exists = prev.salaryConfigs.find(c => c.userId === updated.userId);
        if (exists) {
          return {
            ...prev,
            salaryConfigs: prev.salaryConfigs.map(c => c.userId === updated.userId ? updated : c)
          };
        }
        return { ...prev, salaryConfigs: [...prev.salaryConfigs, updated] };
      });
      addLog(SystemActionType.FINANCE_SALARY_CONFIG, `Updated salary config for user ${updated.userId}`, updated.userId);
    } catch (e) {
      console.error(e);
    }
  };

  const addPayrollRecord = async (record: PayrollRecord) => {
    try {
      const res = await fetch(`${API_BASE}/api/payroll-records`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify(record)
      });
      if (!res.ok) throw new Error('Failed to create payroll record');
      const created: PayrollRecord = await res.json();
      setState(prev => ({ ...prev, payrollRecords: [...prev.payrollRecords, created] }));
      addLog(SystemActionType.FINANCE_PAYROLL_GENERATE, `Generated payroll for ${created.month}, User: ${created.userId}`, created.id);
    } catch (e) {
      console.error(e);
    }
  };

  const uploadFile = async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetch(`${API_BASE}/api/upload`, {
        method: 'POST',
        headers: { ...authHeaders }, 
        body: formData
      });
      if (!res.ok) throw new Error('Upload failed');
      const data = await res.json();
      return data.url;
    } catch (e) {
      console.error('Upload Error:', e);
      throw e;
    }
  };

  return {
    ...state,
    loaded,
    login,
    logout,
    addUser,
    updateUser,
    deleteUser,
    updateSettings,
    addProject,
    updateProject,
    addAttendance,
    updateAttendance,
    addRequest,
    updateRequest,
    addTransaction,
    addDailyReport,
    updateSalaryConfig,
    addPayrollRecord,
    resetDevice,
    uploadFile,
    impersonate: (role: UserRole) => {
      if (state.currentUser?.role === UserRole.SUPERADMIN || state.realUser) {
        const real = state.realUser || state.currentUser;
        const mockUser: User = {
          id: `impersonated_${role.toLowerCase()}`,
          name: `[Preview] ${role}`,
          username: `preview_${role.toLowerCase()}`,
          role: role,
          telegramId: '000',
          telegramUsername: 'preview',
          deviceId: 'preview_device'
        };
        setState(prev => ({
          ...prev,
          currentUser: mockUser,
          realUser: real
        }));
      }
    },
    stopImpersonation: () => {
      if (state.realUser) {
        setState(prev => ({
          ...prev,
          currentUser: prev.realUser || null,
          realUser: null
        }));
      }
    }
  };
};
