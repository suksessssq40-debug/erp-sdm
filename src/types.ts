
export enum UserRole {
  OWNER = 'OWNER',
  MANAGER = 'MANAGER',
  FINANCE = 'FINANCE',
  STAFF = 'STAFF'
}

export interface User {
  id: string;
  name: string;
  username: string;
  telegramId: string;
  telegramUsername: string;
  role: UserRole;
  password?: string;
  deviceId?: string;
}

export enum KanbanStatus {
  ON_GOING = 'ON_GOING',
  TODO = 'TODO',
  DOING = 'DOING',
  PREVIEW = 'PREVIEW',
  DONE = 'DONE'
}

export interface TaskHistory {
  id: string;
  userId: string;
  userName: string;
  action: string;
  timestamp: number;
}

export interface Task {
  id: string;
  title: string;
  assignedTo: string[]; // User IDs
  isCompleted: boolean;
  completionProof?: {
    description: string;
    link?: string;
    imageUrl?: string;
  };
  comments: Comment[];
  history: TaskHistory[];
}

export interface Comment {
  id: string;
  userId: string;
  text: string;
  createdAt: number;
}

export interface ProjectComment {
  id: string;
  userId: string;
  text: string;
  createdAt: number;
}

export type ProjectPriority = 'Low' | 'Medium' | 'High';

export interface Project {
  id: string;
  title: string;
  description: string;
  collaborators: string[]; // User IDs
  deadline: string;
  status: KanbanStatus;
  tasks: Task[];
  comments?: ProjectComment[];
  isManagementOnly: boolean;
  priority: ProjectPriority;
  createdBy: string;
  createdAt: number;
}

export enum RequestType {
  IZIN = 'IZIN',
  SAKIT = 'SAKIT',
  CUTI = 'CUTI'
}

export enum RequestStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED'
}

export interface LeaveRequest {
  id: string;
  userId: string;
  type: RequestType;
  description: string;
  startDate: string;
  endDate: string;
  attachmentUrl?: string; 
  status: RequestStatus;
  createdAt: number;
}

export interface Attendance {
  id: string;
  userId: string;
  date: string;
  timeIn: string;
  timeOut?: string;
  checkOutSelfieUrl?: string;
  isLate: boolean;
  lateReason?: string;
  selfieUrl: string;
  location: { lat: number; lng: number };
}

export enum TransactionType {
  IN = 'IN',
  OUT = 'OUT'
}

export type FinancialAccount = 
  | 'Mandiri 1' 
  | 'Mandiri 2' 
  | 'Mandiri 3' 
  | 'BCA Syariah' 
  | 'Kas Tunai';

export interface Transaction {
  id: string;
  date: string;
  amount: number;
  type: TransactionType;
  category: string;
  description: string;
  account: FinancialAccount;
  imageUrl?: string; // New field for payment proof
}

export interface UserSalaryConfig {
  userId: string;
  basicSalary: number;
  allowance: number; // Tunjangan Jabatan
  mealAllowance: number; // Tunjangan Makan/Transport per hari hadir
  lateDeduction: number; // Potongan per keterlambatan
}

export interface PayrollRecord {
  id: string;
  userId: string;
  month: string; // "YYYY-MM"
  basicSalary: number;
  allowance: number;
  totalMealAllowance: number;
  bonus: number;
  deductions: number; // Total potongan (telat dll)
  netSalary: number;
  isSent: boolean;
  processedAt: number;
  metadata?: {
    totalHadir: number;
    totalTelat: number;
  };
}

export interface CompanyProfile {
  name: string;
  address: string;
  logoUrl?: string;
  logoPosition?: 'top' | 'left' | 'right';
  textAlignment?: 'left' | 'center' | 'right';
  phone: string;
}

export interface AppSettings {
  officeLocation: { lat: number; lng: number };
  officeHours: { start: string; end: string };
  telegramBotToken: string;
  telegramGroupId: string;
  telegramOwnerChatId: string;
  companyProfile: CompanyProfile;
}

export interface DailyReport {
  id: string;
  userId: string;
  date: string;
  activities: {
    task: string;
    quantity: number;
    link?: string;
    imageUrl?: string;
  }[];
}
