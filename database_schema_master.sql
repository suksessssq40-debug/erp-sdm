
-- SCHEMA MASTER LENGKAP ERP-SDM
-- Gabungan dari seluruh file migrasi dan setup
-- Terakhir diperbarui untuk mendukung fitur: Keuangan Dinamis, Multi-Device, Chat System, Freelance, dan Business Units

-- 1. TABEL UTAMA USER
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(100),
  username VARCHAR(50) UNIQUE,
  telegram_id VARCHAR(50),
  telegram_username VARCHAR(50),
  role VARCHAR(20),
  password_hash TEXT,
  device_ids JSONB DEFAULT '[]', -- Multi-Device Support
  avatar_url TEXT,
  job_title VARCHAR(100),
  bio TEXT,
  is_freelance BOOLEAN DEFAULT FALSE -- Fitur Freelance
);

-- 2. TABEL SETTINGS
CREATE TABLE IF NOT EXISTS settings (
    office_lat NUMERIC,
    office_lng NUMERIC,
    office_start_time VARCHAR(10),
    office_end_time VARCHAR(10),
    telegram_bot_token TEXT,
    telegram_group_id TEXT,
    telegram_owner_chat_id TEXT,
    company_profile_json TEXT, -- JSON berisi nama, alamat, logo
    daily_recap_time VARCHAR(5) DEFAULT '18:00',
    daily_recap_content JSONB DEFAULT '["attendance", "finance", "projects"]'
);

-- 3. TABEL PROJECTS (KANBAN)
CREATE TABLE IF NOT EXISTS projects (
  id VARCHAR(50) PRIMARY KEY,
  title VARCHAR(200),
  description TEXT,
  status VARCHAR(20), -- ON_GOING, TODO, DOING, PREVIEW, DONE
  priority VARCHAR(20), -- Low, Medium, High
  deadline TIMESTAMP,
  tasks_json TEXT, -- Array of Task objects
  collaborators_json TEXT, -- Array of User IDs
  comments_json TEXT,
  is_management_only BOOLEAN DEFAULT FALSE,
  created_by VARCHAR(50),
  created_at BIGINT
);

-- 4. TABEL ATTENDANCE (ABSENSI)
CREATE TABLE IF NOT EXISTS attendance (
  id VARCHAR(50) PRIMARY KEY,
  user_id VARCHAR(50),
  date VARCHAR(20), -- YYYY-MM-DD
  time_in VARCHAR(10),
  time_out VARCHAR(10),
  is_late BOOLEAN,
  late_reason TEXT,
  selfie_url TEXT,
  checkout_selfie_url TEXT,
  location_lat NUMERIC,
  location_lng NUMERIC
);

-- 5. TABEL LEAVE REQUESTS (CUTI/IZIN)
CREATE TABLE IF NOT EXISTS leave_requests (
  id VARCHAR(50) PRIMARY KEY,
  user_id VARCHAR(50),
  type VARCHAR(20), -- IZIN, SAKIT, CUTI
  description TEXT,
  start_date DATE,
  end_date DATE,
  attachment_url TEXT,
  status VARCHAR(20), -- PENDING, APPROVED, REJECTED
  created_at BIGINT,
  -- Audit Fields
  approver_id VARCHAR(50),
  approver_name VARCHAR(100),
  action_note TEXT,
  action_at BIGINT
);

-- 6. TABEL BUSINESS UNITS (CABANG/POS)
CREATE TABLE IF NOT EXISTS business_units (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at BIGINT DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)
);

-- 7. TABEL TRANSACTION CATEGORIES (KATEGORI KEUANGAN)
CREATE TABLE IF NOT EXISTS transaction_categories (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    type VARCHAR(10) NOT NULL, -- IN atau OUT
    parent_id VARCHAR(50) REFERENCES transaction_categories(id) ON DELETE SET NULL,
    created_at BIGINT DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)
);

-- 8. TABEL FINANCIAL ACCOUNTS (REKENING/KAS)
CREATE TABLE IF NOT EXISTS financial_accounts (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  bank_name VARCHAR(100) NOT NULL,
  account_number VARCHAR(100),
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at BIGINT
);

-- 9. TABEL TRANSACTIONS (KEUANGAN)
CREATE TABLE IF NOT EXISTS transactions (
  id VARCHAR(50) PRIMARY KEY,
  date DATE,
  amount NUMERIC,
  type VARCHAR(10), -- IN / OUT
  category VARCHAR(100), -- Bisa string (Legacy) atau ID
  description TEXT,
  account VARCHAR(100), -- ID dari financial_accounts
  image_url TEXT,
  business_unit_id VARCHAR(50), -- Link ke Business Unit
  created_at BIGINT DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)
);

-- Index agar filter per bisnis unit cepat
CREATE INDEX IF NOT EXISTS idx_trans_biz_unit ON transactions(business_unit_id);

-- 10. TABEL DAILY REPORTS
CREATE TABLE IF NOT EXISTS daily_reports (
  id VARCHAR(50) PRIMARY KEY,
  user_id VARCHAR(50),
  date VARCHAR(20),
  activities_json TEXT -- Array of Activity objects
);

-- 11. TABEL SALARY CONFIGS
CREATE TABLE IF NOT EXISTS salary_configs (
  user_id VARCHAR(50) PRIMARY KEY,
  basic_salary NUMERIC,
  allowance NUMERIC,
  meal_allowance NUMERIC,
  late_deduction NUMERIC
);

-- 12. TABEL PAYROLL RECORDS
CREATE TABLE IF NOT EXISTS payroll_records (
  id VARCHAR(50) PRIMARY KEY,
  user_id VARCHAR(50),
  month VARCHAR(10), -- YYYY-MM
  basic_salary NUMERIC,
  allowance NUMERIC,
  total_meal_allowance NUMERIC,
  bonus NUMERIC,
  deductions NUMERIC,
  net_salary NUMERIC,
  is_sent BOOLEAN DEFAULT FALSE,
  processed_at BIGINT,
  metadata_json TEXT -- Detail kehadiran/keterlambatan
);

-- 13. TABEL SYSTEM LOGS (AUDIT TRAIL)
CREATE TABLE IF NOT EXISTS system_logs (
  id VARCHAR(50) PRIMARY KEY,
  timestamp BIGINT NOT NULL,
  actor_id VARCHAR(50),
  actor_name VARCHAR(100),
  actor_role VARCHAR(20),
  action_type VARCHAR(50),
  details TEXT,
  target_obj VARCHAR(100),
  metadata_json TEXT
);

-- 14. TABEL CHAT SYSTEM
CREATE TABLE IF NOT EXISTS chat_rooms (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(100),
  type VARCHAR(20), -- GROUP / DM
  created_by VARCHAR(50),
  created_at BIGINT
);

CREATE TABLE IF NOT EXISTS chat_members (
  room_id VARCHAR(50),
  user_id VARCHAR(50),
  joined_at BIGINT,
  PRIMARY KEY (room_id, user_id)
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id VARCHAR(50) PRIMARY KEY,
  room_id VARCHAR(50),
  sender_id VARCHAR(50),
  content TEXT,
  attachment_url TEXT,
  created_at BIGINT,
  reply_to_id VARCHAR(50) -- Support Reply
);

--
-- SEED DATA (DATA AWAL)
-- Gunakan ON CONFLICT DO NOTHING agar aman dijalankan berulang kali
--

-- Default 'General' Chat Room
INSERT INTO chat_rooms (id, name, type, created_by, created_at)
VALUES ('general', 'General Forum', 'GROUP', 'system', EXTRACT(EPOCH FROM NOW()) * 1000)
ON CONFLICT (id) DO NOTHING;

-- Default Financial Accounts
INSERT INTO financial_accounts (id, name, bank_name, account_number, description, is_active, created_at)
VALUES 
('acc_mandiri1', 'Mandiri 1', 'Bank Mandiri', '123-456-7890', 'Rekening Utama', true, EXTRACT(EPOCH FROM NOW()) * 1000),
('acc_tunai', 'Kas Tunai', 'Cash', '-', 'Petty Cash Harian', true, EXTRACT(EPOCH FROM NOW()) * 1000)
ON CONFLICT (id) DO NOTHING;

-- Default Business Units (Contoh)
INSERT INTO business_units (id, name, description, is_active)
VALUES
('BU_HEADQUARTER', 'Toko Pusat', 'Operasional Utama', TRUE)
ON CONFLICT (id) DO NOTHING;

-- Default Categories (Contoh Dasar)
INSERT INTO transaction_categories (id, name, type) VALUES
('cat_inc_sales', 'Penjualan', 'IN'),
('cat_exp_salary', 'Gaji Karyawan', 'OUT'),
('cat_exp_ops', 'Operasional', 'OUT')
ON CONFLICT (id) DO NOTHING;
