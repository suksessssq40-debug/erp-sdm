import { AppState } from './types';
import { AppSettings, DailyReport, SystemActionType, UserSalaryConfig, PayrollRecord, FinancialAccountDef, TransactionCategory, BusinessUnit, UserRole, User } from '../types';
import { API_BASE, CURRENT_USER_KEY } from './constants';

export const createMiscActions = (
  state: AppState,
  setState: React.Dispatch<React.SetStateAction<AppState>>,
  authHeaders: Record<string, string>,
  addLog: (actionType: SystemActionType, details: string, target?: string, metadata?: any) => Promise<void>
) => {
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
      throw e;
    }
  };

  const fetchDailyReports = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/daily-reports`, { headers: authHeaders });
      if (res.ok) {
        const data = await res.json();
        setState(prev => ({ ...prev, dailyReports: data }));
      }
    } catch (e) {
      console.error("Fetch DailyReports Failed", e);
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
      throw e;
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
      setState(prev => ({ ...prev, dailyReports: prev.dailyReports.filter(r => r.id !== id) }));
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

  const impersonate = (role: UserRole) => {
    if (state.currentUser?.role === UserRole.SUPERADMIN || state.realUser) {
      const real = state.realUser || state.currentUser;
      const mockUser: User = {
        id: `impersonated_${role.toLowerCase()}`,
        name: `[Preview] ${role}`,
        username: `preview_${role.toLowerCase()}`,
        role: role,
        tenantId: state.currentUser?.tenantId || 'sdm',
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
  };

  const stopImpersonation = () => {
    if (state.realUser) {
      setState(prev => ({
        ...prev,
        currentUser: prev.realUser || null,
        realUser: null
      }));
    }
  };

  return { 
    updateSettings, fetchDailyReports, addDailyReport, updateDailyReport, deleteDailyReport, 
    updateSalaryConfig, addPayrollRecord, uploadFile, impersonate, stopImpersonation 
  };
};
