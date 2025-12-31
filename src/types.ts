
export enum UserRole {
  OWNER = 'OWNER',
  MANAGER = 'MANAGER',
  FINANCE = 'FINANCE',
  STAFF = 'STAFF',
  SUPERADMIN = 'SUPERADMIN'
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
  deviceIds?: string[];
  avatarUrl?: string;
  jobTitle?: string;
  bio?: string;
  isFreelance?: boolean;
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
  // Audit Fields
  approverId?: string;
  approverName?: string;
  actionNote?: string;
  actionAt?: number;
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

// Refactored to allow dynamic accounts from DB
export type FinancialAccount = string;

export interface FinancialAccountDef {
  id: string;
  name: string;
  bankName: string;
  accountNumber: string;
  description: string;
  isActive: boolean;
}

export interface Transaction {
  id: string;
  date: string;
  amount: number;
  type: TransactionType;
  category: string;
  description: string;
  account: FinancialAccount;
  businessUnitId?: string; // Optional: Link transaction to a specific business unit (KB Pos)
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
  dailyRecapTime: string;
  dailyRecapModules: string[];
  companyProfile: CompanyProfile;
}

export interface DailyReport {
  id: string;
  userId: string;
  date: string;
  activities: {
    task: string;
    quantity: number;
    unit?: string;
    link?: string;
    imageUrl?: string;
  }[];
}

export enum SystemActionType {
  AUTH_LOGIN = 'AUTH_LOGIN',
  AUTH_LOGOUT = 'AUTH_LOGOUT',
  AUTH_CHANGE_PASSWORD = 'AUTH_CHANGE_PASSWORD',
  AUTH_RESET_DEVICE = 'AUTH_RESET_DEVICE',
  
  ATTENDANCE_CLOCK_IN = 'ATTENDANCE_CLOCK_IN',
  ATTENDANCE_CLOCK_OUT = 'ATTENDANCE_CLOCK_OUT',
  
  REQUEST_CREATE = 'REQUEST_CREATE',
  REQUEST_APPROVE = 'REQUEST_APPROVE',
  REQUEST_REJECT = 'REQUEST_REJECT',

  PROJECT_CREATE = 'PROJECT_CREATE',
  PROJECT_UPDATE = 'PROJECT_UPDATE',
  PROJECT_MOVE_STATUS = 'PROJECT_MOVE_STATUS',
  PROJECT_TASK_COMPLETE = 'PROJECT_TASK_COMPLETE',
  PROJECT_COMMENT = 'PROJECT_COMMENT',
  PROJECT_DELETE = 'PROJECT_DELETE',
  
  FINANCE_CREATE = 'FINANCE_CREATE',
  FINANCE_UPDATE = 'FINANCE_UPDATE',
  FINANCE_SALARY_CONFIG = 'FINANCE_SALARY_CONFIG',
  FINANCE_PAYROLL_GENERATE = 'FINANCE_PAYROLL_GENERATE',
  
  USER_CREATE = 'USER_CREATE',
  USER_UPDATE = 'USER_UPDATE',
  USER_DELETE = 'USER_DELETE',
  
  SETTINGS_UPDATE = 'SETTINGS_UPDATE'
}

export interface SystemLog {
  id: string;
  timestamp: number;
  actorId: string;
  actorName: string;
  actorRole: UserRole;
  actionType: SystemActionType;
  target?: string;
  details: string;
  metadata?: any;
}

export interface ChatRoom {
  id: string;
  name: string;
  type: 'GROUP' | 'DM';
  createdBy: string;
  createdAt: number;
  lastMessage?: {
    content: string;
    senderName: string;
    timestamp: number;
  };
  memberIds: string[]; // For UI convenience
  unreadCount?: number;
  readStatus?: Record<string, number>;
  isPinned?: boolean; // Pinned by current user (for rooms)
}

export interface ChatMessage {
  id: string;
  roomId: string;
  senderId: string;
  content: string;
  attachmentUrl?: string; // Image or file
  replyToId?: string;
  replyToMessage?: {
     id: string;
     senderName: string;
     content: string;
  }; 
  createdAt: number;
  senderName?: string; // Populated on fetch
  senderRole?: UserRole;
  edited?: boolean;
  isPinned?: boolean; // Global pin for the room
}

export interface TransactionCategory {
  id: string;
  name: string;
  type: TransactionType;
  parentId?: string | null;
  subCategories?: TransactionCategory[]; // For UI tree structure
}

export interface BusinessUnit {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
}
