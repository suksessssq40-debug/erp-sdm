import { AppState } from './types';
import { INITIAL_OFFICE_LOCATION } from '../constants';

export const initialState: AppState = {
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
  tenants: [],
  currentTenant: null,
  shifts: [],
  settings: {
    officeLocation: INITIAL_OFFICE_LOCATION,
    officeHours: { start: '08:00', end: '17:00' },
    telegramBotToken: '',
    telegramGroupId: '',
    telegramOwnerChatId: '',
    companyProfile: {
      name: '',
      address: '',
      phone: '',
      logoUrl: '',
      logoPosition: 'top',
      textAlignment: 'center'
    },
    dailyRecapTime: '18:00',
    dailyRecapModules: ['finance', 'attendance', 'projects']
  }
};
