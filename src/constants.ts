
import { KanbanStatus, UserRole, FinancialAccount } from './types';

export const KANBAN_COLUMNS = [
  { id: KanbanStatus.ON_GOING, label: 'On Going', color: 'bg-blue-100 text-blue-700' },
  { id: KanbanStatus.TODO, label: 'To Do', color: 'bg-slate-100 text-slate-700' },
  { id: KanbanStatus.DOING, label: 'Doing', color: 'bg-amber-100 text-amber-700' },
  { id: KanbanStatus.PREVIEW, label: 'Preview', color: 'bg-indigo-100 text-indigo-700' },
  { id: KanbanStatus.DONE, label: 'Done', color: 'bg-emerald-100 text-emerald-700' },
];

export const INITIAL_OFFICE_LOCATION = { lat: -6.200000, lng: 106.816666 }; // Jakarta Default
export const OFFICE_RADIUS_METERS = 100; // Increased from 10 to 100 for better reliability in browsers

export const ROLE_LABELS: Record<UserRole, string> = {
  [UserRole.OWNER]: 'Owner',
  [UserRole.MANAGER]: 'Manager',
  [UserRole.FINANCE]: 'Finance Team',
  [UserRole.STAFF]: 'Staff'
};

export const FINANCIAL_ACCOUNTS: FinancialAccount[] = [
  'Mandiri 1',
  'Mandiri 2',
  'Mandiri 3',
  'BCA Syariah',
  'Kas Tunai'
];
