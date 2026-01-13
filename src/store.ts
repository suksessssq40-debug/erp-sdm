import { useState, useEffect } from 'react';
import { BusinessUnit, TransactionCategory, User, UserRole, Project, Attendance, LeaveRequest, Transaction, AppSettings, DailyReport, UserSalaryConfig, PayrollRecord, SystemLog, SystemActionType, FinancialAccountDef } from './types';
import { INITIAL_OFFICE_LOCATION } from './constants';
import { supabase } from './lib/supabaseClient';

const isDev = process.env.NODE_ENV === 'development';
// Changed to prefer relative path (Next.js internal API) even in dev to match Vercel environment
// Changed to prefer relative path (Next.js internal API) - FORCE INTERNAL API
const API_BASE = ''; // Was: process.env.NEXT_PUBLIC_API_BASE || '';
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
  financialAccounts: FinancialAccountDef[];
  categories: TransactionCategory[];
  businessUnits: BusinessUnit[];
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
  financialAccounts: [],
  categories: [],
  businessUnits: [],
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
    },
    dailyRecapTime: '18:00',
    dailyRecapModules: ['finance', 'attendance', 'projects']
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

      // 2. Fetch Categories & Business Units (Public or Protected)
      let initialCategories: TransactionCategory[] = [];
      let initialBusinessUnits: BusinessUnit[] = [];
      
      if (token) {
        try {
            const [resCat, resUnits] = await Promise.all([
                fetch(`${API_BASE}/api/categories`, { headers: { 'Authorization': `Bearer ${token}` } }),
                fetch(`${API_BASE}/api/business-units`, { headers: { 'Authorization': `Bearer ${token}` } })
            ]);
            
            if (resCat.ok) initialCategories = await resCat.json();
            if (resUnits.ok) initialBusinessUnits = await resUnits.json();
        } catch (e) { console.error("Failed to load setup data", e); }
      }

      // 3. Bootstrap Data (only after auth is settled)
      // 3. Bootstrap Data (only after auth is settled)
      if (token) {
        try {
            const headers = { 'Authorization': `Bearer ${token}` };
            const res = await fetch(`${API_BASE}/api/bootstrap`, { 
                headers,
                cache: 'no-store' 
            }); // Ensure fresh data
            
            if (!res.ok) {
                if (res.status === 401) {
                    // Token expired or invalid
                    logout();
                    throw new Error("Session expired");
                }
                throw new Error('Failed to load data from backend');
            }
            const data = await res.json();
            
            setState(prev => {
            const newUsers = data.users || [];
            let newCurrentUser = prev.currentUser;

            // Sync currentUser with fresh data from bootstrap
            if (prev.currentUser) {
                const foundMe = newUsers.find((u: User) => u.id === prev.currentUser!.id);
                if (foundMe) {
                    newCurrentUser = { ...prev.currentUser, ...foundMe };
                    // Update LocalStorage immediately
                    try {
                        if (typeof window !== 'undefined') {
                            window.localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(newCurrentUser));
                        }
                    } catch(e) {}
                }
            }

            return {
                ...prev,
                users: newUsers,
                currentUser: newCurrentUser,
                projects: data.projects || [],
                attendance: data.attendance || [],
                requests: data.requests || [],
                transactions: data.transactions || [],
                dailyReports: data.dailyReports || [],
                salaryConfigs: data.salaryConfigs || [],
                payrollRecords: data.payrollRecords || [],
                logs: data.logs || [],
                settings: data.settings || prev.settings,
                financialAccounts: data.financialAccounts || [],
                categories: initialCategories,
                businessUnits: initialBusinessUnits
            };
            });
        } catch (e) {
            console.error("Bootstrap error:", e);
        } 
      }
      setLoaded(true);
    };

    initializeApp();
    
    // Polling System REMOVED for Performance
    // Previously, this polled /api/bootstrap every 30s, causing massive server load.
    // We now rely on initial load + Supabase Realtime (for projects) + manual refresh.
    // If specific data needs live updates (like Users), implement a dedicated lightweight endpoint or Realtime channel.
    /*
    const pollInterval = setInterval(async () => {
         // ... code removed ...
    }, 30000);
    */

    // Realtime Subscription (Supabase)
    let channel: any;
    if (supabase) {
      channel = supabase
        .channel('public:projects')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, (payload) => {
          console.log('Realtime change received!', payload);
          if (payload.eventType === 'INSERT') {
            const p = payload.new;
             // Parse JSON fields
             // Strict Mapping for INSERT to match Project interface
            const newProject: Project = { 
               id: p.id,
               title: p.title,
               description: p.description || '',
               status: p.status,
               priority: p.priority,
               deadline: p.deadline,
               
               tasks: typeof p.tasks_json === 'string' ? JSON.parse(p.tasks_json || '[]') : (p.tasks_json || []),
               collaborators: typeof p.collaborators_json === 'string' ? JSON.parse(p.collaborators_json || '[]') : (p.collaborators_json || []),
               comments: typeof p.comments_json === 'string' ? JSON.parse(p.comments_json || '[]') : (p.comments_json || []),
               
               isManagementOnly: p.is_management_only === 1 || p.is_management_only === true,
               createdBy: p.created_by,
               createdAt: p.created_at ? new Date(p.created_at).getTime() : Date.now()
            };
            setState(prev => ({ ...prev, projects: [...prev.projects, newProject] }));
          } 
          else if (payload.eventType === 'UPDATE') {
             const p = payload.new;
             console.log("Realtime Update Received:", p);
             
             setState(prev => ({
                ...prev,
                projects: prev.projects.map(existing => {
                    if (existing.id === p.id) {
                         // Strict Mapping to avoid snake_case pollution
                         return { 
                           ...existing,
                           title: p.title,
                           description: p.description,
                           status: p.status,
                           priority: p.priority,
                           deadline: p.deadline,
                           
                           tasks: typeof p.tasks_json === 'string' ? JSON.parse(p.tasks_json || '[]') : (p.tasks_json || []),
                           collaborators: typeof p.collaborators_json === 'string' ? JSON.parse(p.collaborators_json || '[]') : (p.collaborators_json || []),
                           comments: typeof p.comments_json === 'string' ? JSON.parse(p.comments_json || '[]') : (p.comments_json || []),
                           
                           isManagementOnly: p.is_management_only === 1 || p.is_management_only === true,
                           // createdBy & createdAt usually don't change, but good to have
                           createdBy: p.created_by || existing.createdBy,
                           createdAt: p.created_at ? Number(p.created_at) : existing.createdAt
                         };
                    }
                    return existing;
                })
             }));
          }
          else if (payload.eventType === 'DELETE') {
             setState(prev => ({ ...prev, projects: prev.projects.filter(p => p.id !== payload.old.id) }));
          }
        })
        .subscribe();
    }

    return () => {
        // clearInterval(pollInterval);
        if (channel) supabase?.removeChannel(channel);
    };
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
      
      setState(prev => {
        // Update user in users list
        const newUsers = prev.users.map(u => u.id === updated.id ? { ...u, ...updated } : u); // Merge to be safe
        
        // Update currentUser if it's the same person
        let newCurrentUser = prev.currentUser;
        if (prev.currentUser && prev.currentUser.id === updated.id) {
            newCurrentUser = { ...prev.currentUser, ...updated };
            
            // Persist to LocalStorage immediately
            try {
                if (typeof window !== 'undefined') {
                    window.localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(newCurrentUser));
                }
            } catch (e) {
                console.error("Failed to persist user update", e);
            }
        }

        return {
           ...prev,
           users: newUsers,
           currentUser: newCurrentUser
        };
      });
      
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
      throw e; // Propagate error so UI knows it failed
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
    // 1. Optimistic Update (Immediate UI Change)
    setState(prev => ({
      ...prev,
      requests: prev.requests.map(r => r.id === req.id ? req : r)
    }));

    try {
      const res = await fetch(`${API_BASE}/api/requests/${req.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify(req)
      });
      
      if (!res.ok) {
        throw new Error('Failed to update request');
      }
      
      const updated: LeaveRequest = await res.json();
      
      // 2. Re-sync with server response (in case server added more fields like createdAt timestamp adjustment)
      setState(prev => ({
        ...prev,
        requests: prev.requests.map(r => r.id === updated.id ? updated : r)
      }));
      
      addLog(SystemActionType.REQUEST_APPROVE, `Request ${updated.status}: ${updated.type}`, updated.id);
    } catch (e) {
      console.error(e);
      // Rollback or notify error (optional, but keep simple for now)
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
      throw e; // Propagate error for UI handling
    }
  };

  const updateTransaction = async (t: Transaction) => {
    // Optimistic
    setState(prev => ({
      ...prev,
      transactions: prev.transactions.map(tr => tr.id === t.id ? t : tr)
    }));
    try {
      const res = await fetch(`${API_BASE}/api/transactions/${t.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify(t)
      });
      if (!res.ok) throw new Error('Failed to update transaction');
      addLog(SystemActionType.FINANCE_UPDATE, `Updated transaction: ${t.amount} (${t.type})`, t.id);
    } catch (e) {
      console.error(e);
      throw e;
    }
  };

  const deleteTransaction = async (id: string, detailAmount: string) => {
    // Optimistic
    setState(prev => ({
      ...prev,
      transactions: prev.transactions.filter(t => t.id !== id)
    }));
    try {
      const res = await fetch(`${API_BASE}/api/transactions/${id}`, {
        method: 'DELETE',
        headers: { ...authHeaders }
      });
      if (!res.ok) throw new Error('Failed to delete transaction');
      addLog(SystemActionType.FINANCE_UPDATE, `Deleted transaction: ${detailAmount}`, id);
    } catch (e) {
      console.error(e);
      throw e;
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
      throw e; // RETHROW so frontend knows it failed!
    }
  };

  const updateDailyReport = async (report: DailyReport) => {
    try {
      const res = await fetch(`${API_BASE}/api/daily-reports/${report.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify(report)
      });
      if (!res.ok) throw new Error('Failed to update daily report');
      
      setState(prev => ({
        ...prev,
        dailyReports: prev.dailyReports.map(r => r.id === report.id ? report : r)
      }));
      addLog(SystemActionType.PROJECT_TASK_COMPLETE, `Updated Daily Report for ${report.date}`, report.id);
    } catch (e) {
      console.error(e);
      throw e;
    }
  };

  const deleteDailyReport = async (id: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/daily-reports/${id}`, {
        method: 'DELETE',
        headers: { ...authHeaders }
      });
      if (!res.ok) throw new Error('Failed to delete daily report');
      
      setState(prev => ({
        ...prev,
        dailyReports: prev.dailyReports.filter(r => r.id !== id)
      }));
      addLog(SystemActionType.PROJECT_DELETE, `Deleted Daily Report`, id);
    } catch (e) {
      console.error(e);
      throw e;
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

  const addFinancialAccount = async (acc: FinancialAccountDef) => {
    try {
      const res = await fetch(`${API_BASE}/api/financial-accounts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify(acc)
      });
      if (!res.ok) throw new Error('Failed to create account');
      const created: FinancialAccountDef = await res.json();
      setState(prev => ({ ...prev, financialAccounts: [...prev.financialAccounts, created] }));
      addLog(SystemActionType.FINANCE_UPDATE, `Added financial account: ${created.name}`, created.id);
    } catch (e) {
      console.error(e);
      throw e;
    }
  };

  const updateFinancialAccount = async (acc: FinancialAccountDef) => {
    setState(prev => ({
        ...prev,
        financialAccounts: prev.financialAccounts.map(a => a.id === acc.id ? acc : a)
    }));
    try {
      const res = await fetch(`${API_BASE}/api/financial-accounts/${acc.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify(acc)
      });
      if (!res.ok) throw new Error('Failed to update account');
      addLog(SystemActionType.FINANCE_UPDATE, `Updated financial account: ${acc.name}`, acc.id);
    } catch (e) {
      console.error(e);
      throw e;
    }
  };
  
  const deleteFinancialAccount = async (id: string) => {
      setState(prev => ({
          ...prev,
          financialAccounts: prev.financialAccounts.filter(a => a.id !== id)
      }));
      try {
        const res = await fetch(`${API_BASE}/api/financial-accounts/${id}`, {
            method: 'DELETE',
            headers: { ...authHeaders }
        });
        if (!res.ok) throw new Error('Failed to delete account');
        addLog(SystemActionType.FINANCE_UPDATE, `Deleted financial account: ${id}`, id);
      } catch (e) {
        console.error(e);
        throw e;
      }
  };

  const addCategory = async (cat: TransactionCategory) => {
      try {
        const res = await fetch(`${API_BASE}/api/categories`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...authHeaders },
            body: JSON.stringify(cat)
        });
        if (!res.ok) throw new Error('Failed to create category');
        const created: TransactionCategory = await res.json();
        setState(prev => ({ ...prev, categories: [...prev.categories, created] }));
      } catch (e) {
        console.error(e);
        throw e;
      }
  };

  const updateCategory = async (cat: TransactionCategory) => {
      setState(prev => ({
          ...prev,
          categories: prev.categories.map(c => c.id === cat.id ? cat : c)
      }));
      try {
        const res = await fetch(`${API_BASE}/api/categories/${cat.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', ...authHeaders },
            body: JSON.stringify(cat)
        });
        if (!res.ok) throw new Error('Failed to update category');
      } catch (e) {
        console.error(e);
        throw e;
      }
  };

  const deleteCategory = async (id: string) => {
      setState(prev => ({
          ...prev,
          categories: prev.categories.filter(c => c.id !== id && c.parentId !== id) // Remove category and its children from UI immediately
      }));
      try {
        const res = await fetch(`${API_BASE}/api/categories/${id}`, {
            method: 'DELETE',
            headers: { ...authHeaders }
        });
        if (!res.ok) throw new Error('Failed to delete category');
      } catch (e) {
        console.error(e);
        throw e;
      }
  };

  const importCategories = async (cats: Partial<TransactionCategory>[]) => {
      try {
        const res = await fetch(`${API_BASE}/api/categories/import`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...authHeaders },
            body: JSON.stringify({ categories: cats })
        });
        if (!res.ok) throw new Error('Failed to import categories');
        
        // Refresh categories
        const resCat = await fetch(`${API_BASE}/api/categories`, { headers: authHeaders });
        if (resCat.ok) {
            const allCats = await resCat.json();
            setState(prev => ({ ...prev, categories: allCats }));
        }
        
        addLog(SystemActionType.FINANCE_UPDATE, `Imported ${cats.length} categories`, 'Categories');
      } catch (e) {
        console.error(e);
        throw e;
      }
  };

  const addBusinessUnit = async (unit: BusinessUnit) => {
      try {
        const res = await fetch(`${API_BASE}/api/business-units`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...authHeaders },
            body: JSON.stringify(unit)
        });
        if (!res.ok) throw new Error('Failed to create business unit');
        const created: BusinessUnit = await res.json();
        setState(prev => ({ ...prev, businessUnits: [...prev.businessUnits, created] }));
      } catch (e) {
        console.error(e);
        throw e;
      }
  };

  const updateBusinessUnit = async (unit: BusinessUnit) => {
      setState(prev => ({
          ...prev,
          businessUnits: prev.businessUnits.map(u => u.id === unit.id ? unit : u)
      }));
      try {
        const res = await fetch(`${API_BASE}/api/business-units/${unit.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', ...authHeaders },
            body: JSON.stringify(unit)
        });
        if (!res.ok) throw new Error('Failed to update business unit');
      } catch (e) {
        console.error(e);
        throw e;
      }
  };

  const deleteBusinessUnit = async (id: string) => {
      setState(prev => ({
          ...prev,
          businessUnits: prev.businessUnits.filter(u => u.id !== id)
      }));
      try {
        const res = await fetch(`${API_BASE}/api/business-units/${id}`, {
            method: 'DELETE',
            headers: { ...authHeaders }
        });
        if (!res.ok) throw new Error('Failed to delete business unit');
      } catch (e) {
        console.error(e);
        throw e;
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

  const patchProject = async (projectId: string, action: string, data: any) => {
    try {
      // 1. Send Atomic Update to Backend
      const res = await fetch(`${API_BASE}/api/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ action, data })
      });
      
      if (!res.ok) throw new Error('Failed to patch project');
      
      const raw: any = await res.json();
      
      // Fix Serialization from Prisma (JSON fields are strings)
      const updated: Project = {
          ...raw,
          tasks: typeof raw.tasksJson === 'string' ? JSON.parse(raw.tasksJson) : (raw.tasks || []),
          comments: typeof raw.commentsJson === 'string' ? JSON.parse(raw.commentsJson) : (raw.comments || []),
          collaborators: typeof raw.collaboratorsJson === 'string' ? JSON.parse(raw.collaboratorsJson) : (raw.collaborators || []),
          // Ensure dates are compatible
          deadline: raw.deadline ? new Date(raw.deadline).toISOString() : raw.deadline,
          createdAt: raw.createdAt ? new Date(raw.createdAt).getTime() : Date.now()
      };
      
      // 2. Update Local State with Server Response (Source of Truth)
      // Note: Realtime might overlap here, but setState handles merge via map.
      setState(prev => ({
        ...prev,
        projects: prev.projects.map(p => p.id === updated.id ? updated : p)
      }));
      
      addLog(SystemActionType.PROJECT_UPDATE, `Atomic Update: ${action}`, updated.id);
      return updated;
    } catch (e) {
      console.error(e);
      throw e;
    }
  };

  const deleteProject = async (projectId: string) => {
    try {
        const project = state.projects.find(p => p.id === projectId);
        if (!project) return;

        // Optimistic UI Update
        setState(prev => ({
            ...prev,
            projects: prev.projects.filter(p => p.id !== projectId)
        }));

        const res = await fetch(`${API_BASE}/api/projects/${projectId}`, {
            method: 'DELETE',
            headers: { ...authHeaders }
        });

        if (!res.ok) {
            throw new Error('Gagal menghapus proyek');
        }

        addLog(SystemActionType.PROJECT_DELETE, `Menghapus proyek: ${project.title}`, projectId);
    } catch(e) {
        console.error(e);
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
    deleteProject, // Exported
    patchProject, // Exported Function
    addAttendance,
    updateAttendance,
    addRequest,
    updateRequest,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    addDailyReport,
    updateDailyReport,
    deleteDailyReport,
    updateSalaryConfig,
    addPayrollRecord,
    addFinancialAccount,
    updateFinancialAccount,
    deleteFinancialAccount,
    addCategory,
    updateCategory,
    deleteCategory,
    importCategories,
    addBusinessUnit,
    updateBusinessUnit,
    deleteBusinessUnit,
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
