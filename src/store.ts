
import { useState, useEffect } from 'react';
import { User, UserRole, Project, Attendance, LeaveRequest, Transaction, AppSettings, DailyReport, UserSalaryConfig, PayrollRecord } from './types';
import { INITIAL_OFFICE_LOCATION } from './constants';

const isDev = process.env.NODE_ENV === 'development';
// Changed to prefer relative path (Next.js internal API) even in dev to match Vercel environment
const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';
const CURRENT_USER_KEY = 'sdm_erp_current_user';
const CURRENT_TOKEN_KEY = 'sdm_erp_auth_token';

interface AppState {
  currentUser: User | null;
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
}

const initialState: AppState = {
  currentUser: null,
  authToken: undefined,
  users: [],
  projects: [],
  attendance: [],
  requests: [],
  transactions: [],
  dailyReports: [],
  salaryConfigs: [],
  payrollRecords: [],
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

  // Rehydrate current user from localStorage so session tetap hidup setelah refresh
  useEffect(() => {
    try {
      const raw = typeof window !== 'undefined' ? window.localStorage.getItem(CURRENT_USER_KEY) : null;
      const rawToken = typeof window !== 'undefined' ? window.localStorage.getItem(CURRENT_TOKEN_KEY) : null;
      if (raw) {
        const user: User = JSON.parse(raw);
        setState(prev => ({ ...prev, currentUser: user }));
      }
      if (rawToken) {
        setState(prev => ({ ...prev, authToken: rawToken as any }));
      }
    } catch (e) {
      console.error('Failed to read current user from localStorage:', e);
    }
  }, []);

  useEffect(() => {
    const bootstrap = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/bootstrap`);
        if (!res.ok) throw new Error('Failed to load data from backend');
        const data = await res.json();
        setState(prev => ({
          ...prev,
          users: data.users || [],
          projects: data.projects || [],
          attendance: data.attendance || [],
          requests: data.requests || [],
          transactions: data.transactions || [],
          dailyReports: data.dailyReports || [],
          salaryConfigs: data.salaryConfigs || [],
          payrollRecords: data.payrollRecords || [],
          settings: data.settings || prev.settings
        }));
      } catch (e) {
        console.error(e);
      } finally {
        setLoaded(true);
      }
    };
    bootstrap();
  }, []);

  const login = async (username: string, password?: string): Promise<User | null> => {
    try {
      // Generate or retrieve Device ID
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
        // Handle specific device lock error
        if (payload?.error === 'DEVICE_LOCKED_MISMATCH') {
          throw new Error('AKSES DITOLAK: Akun ini terkunci pada perangkat lain. Harap hubungi Owner untuk reset.');
        }
        const msg = payload?.error || 'Login failed';
        throw new Error(msg);
      }
      const user: User = payload.user;
      const token: string | undefined = payload.token;
      setState(prev => ({ ...prev, currentUser: user, authToken: token as any }));
      try {
        if (typeof window !== 'undefined') {
          window.localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
          if (token) {
            window.localStorage.setItem(CURRENT_TOKEN_KEY, token);
          }
        }
      } catch (e) {
        console.error('Failed to persist current user:', e);
      }
      return user;
    } catch (e) {
      console.error('Login error:', e);
      if (e instanceof Error) {
        throw e;
      }
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
      return true;
    } catch (e) {
      console.error(e);
      throw e;
    }
  };

  const logout = () => {
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(CURRENT_USER_KEY);
        window.localStorage.removeItem(CURRENT_TOKEN_KEY);
      }
    } catch (e) {
      console.error('Failed to clear current user from localStorage:', e);
    }
    setState(prev => ({ ...prev, currentUser: null, authToken: undefined as any }));
  };

  const authHeaders: Record<string, string> = state.authToken
    ? { Authorization: `Bearer ${state.authToken}` }
    : {};

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
    } catch (e) {
      console.error(e);
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
    } catch (e) {
      console.error(e);
    }
  };

  const uploadFile = async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append('file', file);
    try {
      // Content-Type header excluded so browser sets boundary
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
    uploadFile
  };
};
