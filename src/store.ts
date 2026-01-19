import { useState, useEffect } from 'react';
import { User, SystemLog, SystemActionType, Project } from './types';
import { supabase } from './lib/supabaseClient';
import { AppState } from './store/types';
import { initialState } from './store/state';
import { API_BASE, CURRENT_USER_KEY, CURRENT_TOKEN_KEY } from './store/constants';

// Action modules
import { createAttendanceActions } from './store/attendanceActions';
import { createFinancialActions } from './store/financialActions';
import { createUserActions } from './store/userActions';
import { createProjectActions } from './store/projectActions';
import { createTenantActions } from './store/tenantActions';
import { createMiscActions } from './store/miscActions';
import { createOtherActions } from './store/otherActions';

export const useStore = () => {
  const [state, setState] = useState<AppState>(initialState);
  const [loaded, setLoaded] = useState(false);

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

    setState(prev => ({ ...prev, logs: [newLog, ...prev.logs] }));

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

  // Re-compose actions from fragments
  const attendanceActions = createAttendanceActions(state, setState, authHeaders, addLog);
  const financialActions = createFinancialActions(state, setState, authHeaders, addLog);
  const userActions = createUserActions(state, setState, authHeaders, addLog);
  const projectActions = createProjectActions(state, setState, authHeaders, addLog);
  const tenantActions = createTenantActions(state, setState, authHeaders, addLog);
  const miscActions = createMiscActions(state, setState, authHeaders, addLog);
  const otherActions = createOtherActions(state, setState, authHeaders, addLog);

  useEffect(() => {
    const initializeApp = async () => {
      let currentUser: User | null = null;
      let token: string | undefined = undefined;
      
      try {
        const raw = typeof window !== 'undefined' ? window.localStorage.getItem(CURRENT_USER_KEY) : null;
        const rawToken = typeof window !== 'undefined' ? window.localStorage.getItem(CURRENT_TOKEN_KEY) : null;
        
        if (raw && rawToken) {
          const parsedUser = JSON.parse(raw);
          if (parsedUser && parsedUser.id && parsedUser.tenantId) {
             currentUser = parsedUser;
             token = rawToken;
          } else if (typeof window !== 'undefined') {
              window.localStorage.removeItem(CURRENT_USER_KEY);
              window.localStorage.removeItem(CURRENT_TOKEN_KEY);
          }
        }
      } catch (e) {
        console.error('Failed to read current user from localStorage', e);
      }

      if (currentUser && token) {
         setState(prev => ({ ...prev, currentUser, authToken: token }));
      }

      if (token) {
        try {
            const h = { 'Authorization': `Bearer ${token}` };
            const [resCat, resUnits, resBootstrap] = await Promise.all([
                fetch(`${API_BASE}/api/categories`, { headers: h }),
                fetch(`${API_BASE}/api/business-units`, { headers: h }),
                fetch(`${API_BASE}/api/bootstrap`, { headers: h, cache: 'no-store' })
            ]);
            
            let initialCategories = [];
            let initialBusinessUnits = [];
            if (resCat.ok) initialCategories = await resCat.json();
            if (resUnits.ok) initialBusinessUnits = await resUnits.json();

            if (resBootstrap.ok) {
                const data = await resBootstrap.json();
                setState(prev => {
                    const newUsers = data.users || [];
                    let newMe = prev.currentUser;
                    if (prev.currentUser) {
                        const found = newUsers.find((u: User) => u.id === prev.currentUser!.id);
                        if (found) {
                            newMe = { ...prev.currentUser, ...found };
                            if (typeof window !== 'undefined') window.localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(newMe));
                        }
                    }
                    return {
                        ...prev,
                        users: newUsers,
                        currentUser: newMe,
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
                
                // Active Tenant + Shifts
                if (currentUser?.tenantId) {
                    const [resTenant, resShifts] = await Promise.all([
                        fetch(`${API_BASE}/api/tenants/${currentUser.tenantId}`, { headers: h }),
                        fetch(`${API_BASE}/api/tenants/${currentUser.tenantId}/shifts`, { headers: h })
                    ]);
                    if (resTenant.ok) {
                        const tData = await resTenant.ok ? await resTenant.json() : null;
                        if (tData) setState(prev => ({ ...prev, currentTenant: tData }));
                    }
                    if (resShifts.ok) {
                        const sData = await resShifts.json();
                        setState(prev => ({ ...prev, shifts: sData }));
                    }
                }
            } else if (resBootstrap.status === 401) {
                userActions.logout();
            }
        } catch (e) { console.error("Initialize error:", e); }
      }
      setLoaded(true);
    };

    initializeApp();

    // Supabase Realtime
    let channel: any;
    if (supabase) {
      channel = supabase
        .channel('public:projects')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, (payload) => {
          if (payload.eventType === 'INSERT') {
            const p = payload.new;
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
             setState(prev => ({
                ...prev,
                projects: prev.projects.map(existing => existing.id === p.id ? { 
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
                    createdBy: p.created_by || existing.createdBy,
                    createdAt: p.created_at ? Number(p.created_at) : existing.createdAt
                } : existing)
             }));
          }
          else if (payload.eventType === 'DELETE') {
             setState(prev => ({ ...prev, projects: prev.projects.filter(p => p.id !== payload.old.id) }));
          }
        })
        .subscribe();
    }

    return () => {
        if (channel) supabase?.removeChannel(channel);
    };
  }, []);

  return {
    ...state,
    loaded,
    ...attendanceActions,
    ...financialActions,
    ...userActions,
    ...projectActions,
    ...tenantActions,
    ...miscActions,
    ...otherActions,
    fetchProjects: projectActions.fetchProjects,
    fetchTransactions: financialActions.fetchTransactions,
    fetchAttendance: attendanceActions.fetchAttendance,
    fetchRequests: otherActions.fetchRequests,
    fetchTenants: tenantActions.fetchTenants,
    fetchDailyReports: miscActions.fetchDailyReports,
    fetchLogs: otherActions.fetchLogs,
    fetchPayrollRecords: async () => {
        try {
           const res = await fetch(`${API_BASE}/api/payroll-records`, { headers: authHeaders });
           if (res.ok) {
               const data = await res.json();
               setState(prev => ({ ...prev, payrollRecords: data }));
           }
       } catch(e) { console.error("Fetch Payroll Failed", e); }
    },
    fetchSalaryConfigs: async () => {
        try {
           const res = await fetch(`${API_BASE}/api/salary-configs`, { headers: authHeaders });
           if (res.ok) {
               const data = await res.json();
               setState(prev => ({ ...prev, salaryConfigs: data }));
           }
       } catch(e) { console.error("Fetch SalaryConfigs Failed", e); }
    },
    importCategories: async (cats: any[]) => {
        try {
          const res = await fetch(`${API_BASE}/api/categories/import`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', ...authHeaders },
              body: JSON.stringify({ categories: cats })
          });
          if (!res.ok) throw new Error('Failed to import categories');
          const resCat = await fetch(`${API_BASE}/api/categories`, { headers: authHeaders });
          if (resCat.ok) {
              const allCats = await resCat.json();
              setState(prev => ({ ...prev, categories: allCats }));
          }
          addLog(SystemActionType.FINANCE_UPDATE, `Imported ${cats.length} categories`, 'Categories');
        } catch (e) { console.error(e); throw e; }
    }
  };
};
