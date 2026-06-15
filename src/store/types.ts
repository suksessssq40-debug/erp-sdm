import { BusinessUnit, TransactionCategory, User, UserRole, Project, Attendance, LeaveRequest, Transaction, AppSettings, DailyReport, UserSalaryConfig, PayrollRecord, SystemLog, Tenant, Shift, FinancialAccountDef } from '../types';

export interface AppState {
  currentUser: User | null;
  realUser?: User | null; 
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
  tenants: Tenant[];
  currentTenant: Tenant | null;
  shifts: Shift[];
}
