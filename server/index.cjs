const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('./db.cjs');
const multer = require('multer');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || 'sdm_erp_dev_secret';

// Initialize Supabase Client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
// Note: Ensure SUPABASE_URL and SUPABASE_KEY are set in .env
const supabase = (supabaseUrl && supabaseKey) 
  ? createClient(supabaseUrl, supabaseKey) 
  : null;

// Configure Multer for Memory Storage (Serverless friendly)
const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Root endpoint for Vercel health check
app.get('/', (req, res) => {
  res.send('SDM ERP API is running');
});

// Utility helpers
const uid = () => Math.random().toString(36).substr(2, 9);

// Simple auth middleware
function auth(requiredRoles) {
  return (req, res, next) => {
    const header = req.headers['authorization'] || '';
    if (!header.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const token = header.slice(7);
    try {
      const payload = jwt.verify(token, JWT_SECRET);
      req.user = payload; // { id, role }
      if (requiredRoles && !requiredRoles.includes(payload.role)) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      next();
    } catch (err) {
      console.error('Auth error:', err);
      return res.status(401).json({ error: 'Unauthorized' });
    }
  };
}

async function ensureSeedData() {
  // In a serverless environment like Vercel, this might run often or never if cold start handling is different.
  // Ideally, schema migration should be done manually or via a separate script.
  // We will keep this for basic "first run" checks but rely on IF NOT EXISTS in "supabase_schema.sql".
  
  const client = await pool.connect();
  try {
    // Check if settings table exists and has data
    const resSettings = await client.query('SELECT * FROM settings LIMIT 1');
    if (resSettings.rows.length === 0) {
      const companyProfile = {
        name: 'Sukses Digital Media',
        address: 'Jl. Kemajuan No. 88, Jakarta Selatan',
        phone: '0812-3456-7890',
        logoUrl: '',
        logoPosition: 'top',
        textAlignment: 'center'
      };
      
      await client.query(
        `INSERT INTO settings 
          (office_lat, office_lng, office_start_time, office_end_time, telegram_bot_token, telegram_group_id, telegram_owner_chat_id, company_profile_json)
         VALUES ($1, $2, $3, $4, '', '', '', $5)`,
        [-6.2, 106.816666, '08:00', '17:00', JSON.stringify(companyProfile)]
      );
    }

    const defaultUsers = [
      { id: '1', name: 'Budi Owner', username: 'owner', telegramId: '111', telegramUsername: '@budi_owner', role: 'OWNER', password: 'owner123' },
      { id: '2', name: 'Siti Manager', username: 'manager', telegramId: '222', telegramUsername: '@siti_mgr', role: 'MANAGER', password: 'manager123' },
      { id: '3', name: 'Andi Finance', username: 'finance', telegramId: '333', telegramUsername: '@andi_fin', role: 'FINANCE', password: 'finance123' },
      { id: '4', name: 'Joko Staff', username: 'staff', telegramId: '444', telegramUsername: '@joko_sdm', role: 'STAFF', password: 'staff123' }
    ];

    for (const u of defaultUsers) {
      const resUser = await client.query('SELECT id FROM users WHERE username = $1 LIMIT 1', [u.username]);
      const hash = await bcrypt.hash(u.password, 10);

      if (resUser.rows.length === 0) {
        await client.query(
          'INSERT INTO users (id, name, username, telegram_id, telegram_username, role, password_hash) VALUES ($1, $2, $3, $4, $5, $6, $7)',
          [u.id, u.name, u.username, u.telegramId, u.telegramUsername, u.role, hash]
        );
      } else {
        // Force update default users to ensure password is correct for demo
        const existingId = resUser.rows[0].id;
        // Check if we need to update ID or just other fields. Updating ID might break references if changed, 
        // but here we just update fields based on username match.
        await client.query(
          'UPDATE users SET name = $1, telegram_id = $2, telegram_username = $3, role = $4, password_hash = $5 WHERE username = $6',
          [u.name, u.telegramId, u.telegramUsername, u.role, hash, u.username]
        );
      }
    }
  } catch(e) {
    console.error("Seed error (safe to ignore if temporary)", e);
  } finally {
    client.release();
  }
}

// Bootstrap data
app.get('/api/bootstrap', async (req, res) => {
  try {
    // Seed Check (Simplified - relying on Prisma to work on existing DB)
    // await ensureSeedData(); // Skip for now, assume DB is seeded by legacy server or manual SQL
    
    // Fetch All Data Parallel
    const [
        users, 
        projects, 
        attendance, 
        requests, 
        transactions, 
        dailyReports, 
        salaryConfigs, 
        payrollRecords, 
        settingsData
    ] = await Promise.all([
        prisma.user.findMany(),
        prisma.project.findMany(),
        prisma.attendance.findMany({ orderBy: [{ date: 'desc' }, { timeIn: 'desc' }], take: 500 }),
        prisma.leaveRequest.findMany({ orderBy: { createdAt: 'desc' }, take: 200 }),
        prisma.transaction.findMany({ orderBy: { date: 'desc' }, take: 500 }),
        prisma.dailyReport.findMany({ orderBy: { date: 'desc' }, take: 200 }),
        prisma.salaryConfig.findMany(),
        prisma.payrollRecord.findMany({ orderBy: { processedAt: 'desc' }, take: 100 }),
        prisma.settings.findFirst() // Singleton
    ]);

    // Format Settings
    const settings = settingsData ? {
        officeLocation: { lat: settingsData.officeLat, lng: settingsData.officeLng },
        officeHours: { start: settingsData.officeStartTime, end: settingsData.officeEndTime },
        telegramBotToken: settingsData.telegramBotToken || '',
        telegramGroupId: settingsData.telegramGroupId || '',
        telegramOwnerChatId: settingsData.telegramOwnerChatId || '',
        dailyRecapTime: settingsData.dailyRecapTime || '18:00',
        dailyRecapModules: typeof settingsData.dailyRecapContent === 'string' 
            ? JSON.parse(settingsData.dailyRecapContent) 
            : (settingsData.dailyRecapContent || []),
        companyProfile: typeof settingsData.companyProfileJson === 'string'
            ? JSON.parse(settingsData.companyProfileJson)
            : (settingsData.companyProfileJson || {})
    } : {};

    res.json({
        users: users.map(u => ({
          id: u.id,
          name: u.name,
          username: u.username,
          telegramId: u.telegramId || '',
          telegramUsername: u.telegramUsername || '',
          role: u.role,
          // deviceIds is handled in login
        })),
        projects: projects.map(p => ({
          id: p.id,
          title: p.title,
          description: p.description || '',
          collaborators: typeof p.collaboratorsJson === 'string' ? JSON.parse(p.collaboratorsJson) : [],
          deadline: p.deadline ? p.deadline.toISOString().split('T')[0] : '',
          status: p.status,
          tasks: typeof p.tasksJson === 'string' ? JSON.parse(p.tasksJson) : [],
          comments: typeof p.commentsJson === 'string' ? JSON.parse(p.commentsJson) : [],
          isManagementOnly: !!p.isManagementOnly,
          priority: p.priority,
          createdBy: p.createdBy,
          createdAt: Number(p.createdAt)
        })),
        attendance: attendance.map(a => ({
          id: a.id,
          userId: a.userId,
          date: a.date,
          timeIn: a.timeIn,
          timeOut: a.timeOut || undefined,
          isLate: !!a.isLate,
          lateReason: a.lateReason || undefined,
          selfieUrl: a.selfieUrl,
          checkOutSelfieUrl: a.checkoutSelfieUrl || undefined,
          // Convert Decimal to number for JSON
          location: { lat: Number(a.locationLat), lng: Number(a.locationLng) }
        })),
        requests: requests.map(r => ({
          id: r.id,
          userId: r.userId,
          type: r.type,
          description: r.description,
          startDate: r.startDate ? r.startDate.toISOString().split('T')[0] : '',
          endDate: r.endDate ? r.endDate.toISOString().split('T')[0] : (r.startDate ? r.startDate.toISOString().split('T')[0] : ''),
          attachmentUrl: r.attachmentUrl || undefined,
          status: r.status,
          createdAt: Number(r.createdAt)
        })),
        transactions: transactions.map(t => ({
          id: t.id,
          date: t.date ? t.date.toISOString().split('T')[0] : '',
          amount: Number(t.amount),
          type: t.type,
          category: t.category || '',
          description: t.description,
          account: t.account,
          imageUrl: t.imageUrl || undefined
        })),
        dailyReports: dailyReports.map(r => ({
          id: r.id,
          userId: r.userId,
          date: r.date,
          activities: typeof r.activitiesJson === 'string' ? JSON.parse(r.activitiesJson) : []
        })),
        salaryConfigs: salaryConfigs.map(c => ({
          userId: c.userId,
          basicSalary: Number(c.basicSalary),
          allowance: Number(c.allowance),
          mealAllowance: Number(c.mealAllowance),
          lateDeduction: Number(c.lateDeduction)
        })),
        payrollRecords: payrollRecords.map(pr => ({
          id: pr.id,
          userId: pr.userId,
          month: pr.month,
          basicSalary: Number(pr.basicSalary),
          allowance: Number(pr.allowance),
          totalMealAllowance: Number(pr.totalMealAllowance),
          bonus: Number(pr.bonus),
          deductions: Number(pr.deductions),
          netSalary: Number(pr.netSalary),
          isSent: !!pr.isSent,
          processedAt: Number(pr.processedAt),
          metadata: typeof pr.metadataJson === 'string' ? JSON.parse(pr.metadataJson) : undefined
        })),
        settings
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to bootstrap data' });
  }
});

// Upload Endpoint for Supabase Storage
app.post('/api/upload', auth(), upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  if (!supabase) {
    return res.status(500).json({ error: 'Storage not configured (Supabase)' });
  }

  try {
    const filename = `${Date.now()}-${Math.round(Math.random() * 1E9)}-${req.file.originalname.replace(/[^a-zA-Z0-9.-]/g, '')}`;
    
    // Upload to 'uploads' bucket
    const { data, error } = await supabase.storage
      .from('uploads')
      .upload(filename, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: false
      });

    if (error) throw error;

    // Get Public URL
    const { data: publicUrlData } = supabase.storage
      .from('uploads')
      .getPublicUrl(filename);
      
    res.json({ url: publicUrlData.publicUrl });
  } catch (e) {
    console.error('Upload Error:', e);
    res.status(500).json({ error: 'Failed to upload file' });
  }
});

// Auth
app.post('/api/login', async (req, res) => {
  const { username, password, deviceId } = req.body;
  if (!username) return res.status(400).json({ error: 'Username required' });
  if (!password) return res.status(400).json({ error: 'Password required' });
  
  try {
    const { rows } = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    if (rows.length === 0) return res.status(401).json({ error: 'Invalid credentials' });
    const u = rows[0];

    if (u.password_hash) {
      const ok = await bcrypt.compare(password, u.password_hash);
      if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
    } else {
      const hash = await bcrypt.hash(password, 10);
      await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, u.id]);
    }

    // Device Lock
    // Device Lock (Only applies to STAFF to prevent attendance fraud)
    // Owner, Manager, Finance are exempt from device locking
    if (u.role === 'STAFF' && u.device_id && deviceId && u.device_id !== deviceId) {
       console.log(`Security Alert: User ${u.name} mismatch device`);
       return res.status(403).json({ error: 'DEVICE_LOCKED_MISMATCH', message: 'Locked to another device.' });
    }
    if (!u.device_id && deviceId) {
      await pool.query('UPDATE users SET device_id = $1 WHERE id = $2', [deviceId, u.id]);
    }

    const userPayload = {
      id: u.id,
      name: u.name,
      username: u.username,
      telegramId: u.telegram_id || '',
      telegramUsername: u.telegram_username || '',
      role: u.role,
      deviceId: u.device_id || deviceId
    };

    const token = jwt.sign({ id: u.id, role: u.role }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ user: userPayload, token });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Login failed' });
  }
});


app.post('/api/users', auth(['OWNER', 'MANAGER']), async (req, res) => {
  const { id, name, username, telegramId, telegramUsername, role, password } = req.body;
  if (!id || !name || !username || !role) return res.status(400).json({ error: 'Missing fields' });
  if (!password || password.length < 6) return res.status(400).json({ error: 'Weak password' });

  try {
    const hash = await bcrypt.hash(password, 10);
    await pool.query(
      'INSERT INTO users (id, name, username, telegram_id, telegram_username, role, password_hash) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [id, name, username, telegramId || '', telegramUsername || '', role, hash]
    );
    res.status(201).json({ id, name, username, telegramId, telegramUsername, role });
  } catch (e) {
    console.error(e);
    if (e.code === '23505') { // Postgres unique violation
      return res.status(409).json({ error: 'Username already exists' });
    }
    res.status(500).json({ error: 'Failed to create user' });
  }
});

app.post('/api/users/:id/reset-device', auth(['OWNER']), async (req, res) => {
  const id = req.params.id;
  try {
    await pool.query('UPDATE users SET device_id = NULL WHERE id = $1', [id]);
    res.json({ message: 'Device reset' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed' });
  }
});

app.post('/api/projects', auth(), async (req, res) => {
  const p = req.body;
  try {
    await pool.query(
      `INSERT INTO projects (id, title, description, collaborators_json, deadline, status, tasks_json, comments_json, is_management_only, priority, created_by, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        p.id, p.title, p.description || '', JSON.stringify(p.collaborators || []),
        p.deadline, p.status, JSON.stringify(p.tasks || []), JSON.stringify(p.comments || []),
        p.isManagementOnly ? 1 : 0, p.priority, p.createdBy, p.createdAt
      ]
    );
    res.status(201).json(p);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed' });
  }
});

app.put('/api/projects/:id', auth(), async (req, res) => {
  const id = req.params.id;
  const p = req.body;
  const userRole = req.user.role;

  if (p.status === 'DONE' && userRole === 'STAFF') {
    return res.status(403).json({ error: 'Not allowed to mark DONE' });
  }

  try {
    await pool.query(
      `UPDATE projects SET 
        title=$1, description=$2, collaborators_json=$3, deadline=$4, status=$5, tasks_json=$6, comments_json=$7, is_management_only=$8, priority=$9 
       WHERE id=$10`,
      [
        p.title, p.description || '', JSON.stringify(p.collaborators || []), p.deadline,
        p.status, JSON.stringify(p.tasks || []), JSON.stringify(p.comments || []),
        p.isManagementOnly ? 1 : 0, p.priority, id
      ]
    );
    res.json(p);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed' });
  }
});

app.post('/api/attendance', auth(), async (req, res) => {
  const a = req.body;
  try {
    await pool.query(
      `INSERT INTO attendance (id, user_id, date, time_in, time_out, is_late, late_reason, selfie_url, checkout_selfie_url, location_lat, location_lng)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        a.id, a.userId, a.date, a.timeIn, a.timeOut || null, a.isLate ? 1 : 0,
        a.lateReason || null, a.selfieUrl, a.checkOutSelfieUrl || null, a.location.lat, a.location.lng
      ]
    );
    res.status(201).json(a);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed' });
  }
});

app.put('/api/attendance/:id', auth(), async (req, res) => {
  const id = req.params.id;
  const a = req.body;
  try {
    await pool.query(
      `UPDATE attendance SET time_in=$1, time_out=$2, is_late=$3, late_reason=$4, selfie_url=$5, checkout_selfie_url=$6, location_lat=$7, location_lng=$8 WHERE id=$9`,
      [
        a.timeIn, a.timeOut || null, a.isLate ? 1 : 0, a.lateReason || null,
        a.selfieUrl, a.checkOutSelfieUrl || null, a.location.lat, a.location.lng, id
      ]
    );
    res.json(a);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed' });
  }
});

app.post('/api/requests', auth(), async (req, res) => {
  const r = req.body;
  try {
    await pool.query(
      `INSERT INTO leave_requests (id, user_id, type, description, start_date, end_date, attachment_url, status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [r.id, r.userId, r.type, r.description, r.startDate, r.endDate || r.startDate, r.attachmentUrl || null, r.status, r.createdAt]
    );
    res.status(201).json(r);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed' });
  }
});

app.put('/api/requests/:id', auth(['OWNER', 'MANAGER']), async (req, res) => {
  const id = req.params.id;
  const r = req.body;
  try {
    await pool.query(
      `UPDATE leave_requests SET type=$1, description=$2, start_date=$3, end_date=$4, attachment_url=$5, status=$6, created_at=$7 WHERE id=$8`,
      [r.type, r.description, r.startDate, r.endDate || r.startDate, r.attachmentUrl || null, r.status, r.createdAt, id]
    );
    res.json(r);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed' });
  }
});

app.post('/api/transactions', auth(['OWNER', 'FINANCE']), async (req, res) => {
  const t = req.body;
  try {
    await pool.query(
      `INSERT INTO transactions (id, date, amount, type, category, description, account, image_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [t.id, t.date, t.amount, t.type, t.category || null, t.description, t.account, t.imageUrl || null]
    );
    res.status(201).json(t);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed' });
  }
});

app.post('/api/daily-reports', auth(), async (req, res) => {
  const r = req.body;
  try {
    await pool.query(
      `INSERT INTO daily_reports (id, user_id, date, activities_json) VALUES ($1, $2, $3, $4)`,
      [r.id, r.userId, r.date, JSON.stringify(r.activities || [])]
    );
    res.status(201).json(r);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed' });
  }
});

app.put('/api/salary-configs/:userId', auth(['OWNER', 'FINANCE']), async (req, res) => {
  const userId = req.params.userId;
  const c = req.body;
  try {
    // Upsert in Postgres
    await pool.query(
      `INSERT INTO salary_configs (user_id, basic_salary, allowance, meal_allowance, late_deduction)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id) DO UPDATE SET 
         basic_salary = EXCLUDED.basic_salary,
         allowance = EXCLUDED.allowance,
         meal_allowance = EXCLUDED.meal_allowance,
         late_deduction = EXCLUDED.late_deduction`,
      [userId, c.basicSalary, c.allowance, c.mealAllowance, c.lateDeduction]
    );
    res.json(c);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed' });
  }
});

app.post('/api/payroll-records', auth(['OWNER', 'FINANCE']), async (req, res) => {
  const pr = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO payroll_records (id, user_id, month, basic_salary, allowance, total_meal_allowance, bonus, deductions, net_salary, is_sent, processed_at, metadata_json)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        pr.id, pr.userId, pr.month, pr.basicSalary, pr.allowance, pr.totalMealAllowance,
        pr.bonus, pr.deductions, pr.netSalary, pr.isSent ? 1 : 0, pr.processedAt,
        pr.metadata ? JSON.stringify(pr.metadata) : null
      ]
    );

    // Auto Journal
    const transactionId = Math.random().toString(36).substr(2, 9);
    const today = new Date().toISOString().split('T')[0];
    const desc = `Gaji Bulan ${pr.month} (Auto)`;
    await client.query(
      `INSERT INTO transactions (id, date, amount, type, category, description, account, image_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [transactionId, today, pr.netSalary, 'OUT', 'SALARY', desc, 'MAIN', null]
    );

    await client.query('COMMIT');
    res.status(201).json(pr);
  } catch (e) {
    await client.query('ROLLBACK');
    console.error(e);
    res.status(500).json({ error: 'Failed' });
  } finally {
    client.release();
  }
});

app.put('/api/settings', auth(['OWNER']), async (req, res) => {
  const s = req.body;
  try {
    const resSettings = await pool.query('SELECT id FROM settings LIMIT 1');
    if (!resSettings.rows.length) return res.status(400).json({ error: 'Settings not initialized' });
    const id = resSettings.rows[0].id;
    
    await pool.query(
      `UPDATE settings SET office_lat=$1, office_lng=$2, office_start_time=$3, office_end_time=$4, telegram_bot_token=$5, telegram_group_id=$6, telegram_owner_chat_id=$7, company_profile_json=$8, daily_recap_time=$9, daily_recap_content=$10 WHERE id=$11`,
      [
        s.officeLocation.lat, s.officeLocation.lng, s.officeHours.start, s.officeHours.end,
        s.telegramBotToken || '', s.telegramGroupId || '', s.telegramOwnerChatId || '', 
        JSON.stringify(s.companyProfile), 
        s.dailyRecapTime || '18:00', 
        JSON.stringify(s.dailyRecapModules || []),
        id
      ]
    );
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed' });
  }
});

// For Vercel, we can export the app. Vercel automatically handles "api" directory files.
// However, since we are doing a rewrite approach or stand-alone server approach, export default app is often safest for Vercel Node runtime.
// --- DAILY RECAP SCHEDULER ---
const startDailyRecapScheduler = () => {
    console.log('[Scheduler] Daily Recap Service Started');
    setInterval(async () => {
        try {
            const now = new Date();
            const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
            const wibDate = new Date(utc + (3600000 * 7));
            const currentHHMM = wibDate.toISOString().slice(11, 16);
            const dateStr = wibDate.toISOString().split('T')[0];

            // 1. Get Settings
            const resSettings = await pool.query('SELECT * FROM settings LIMIT 1');
            if (resSettings.rows.length === 0) return;
            const settings = resSettings.rows[0];

            if (!settings.telegram_bot_token || !settings.telegram_owner_chat_id) return;

            const targetTime = settings.daily_recap_time || '18:00';
            
            // Check Time (Exact Minute Match to avoid drift issues, or check ">= and not sent")
            if (currentHHMM !== targetTime) return;

            // 2. Check Deduplication
            const logCheck = await pool.query(`
                SELECT id FROM system_logs 
                WHERE action_type = 'DAILY_RECAP_AUTO' 
                AND details LIKE $1
                LIMIT 1
            `, [`%${dateStr}%`]);

            if (logCheck.rows.length > 0) {
                 console.log(`[Scheduler] Recap for ${dateStr} already sent.`);
                 return; 
            }

            console.log(`[Scheduler] Generating Daily Recap for ${dateStr}...`);

            // 3. Generate Content
            let targetModules = [];
            try {
                targetModules = typeof settings.daily_recap_content === 'string' 
                    ? JSON.parse(settings.daily_recap_content) 
                    : settings.daily_recap_content || [];
            } catch (e) { list = []; }

            let message = `🔔 *LAPORAN HARIAN OWNER* 🔔\n📅 ${dateStr}\n\n`;
            let hasContent = false;

            // Finance
            if (targetModules.includes('omset')) {
               const resFin = await pool.query(`
                  SELECT 
                    COALESCE(SUM(amount) FILTER (WHERE type='IN'), 0) as income,
                    COALESCE(SUM(amount) FILTER (WHERE type='OUT'), 0) as expense
                  FROM transactions 
                  WHERE date = CURRENT_DATE
               `);
               const { income, expense } = resFin.rows[0];
               message += `💰 *KEUANGAN HARI INI*\n📥 Masuk: Rp ${Number(income).toLocaleString('id-ID')}\nBeban: Rp ${Number(expense).toLocaleString('id-ID')}\n💸 *Net: Rp ${Number(income - expense).toLocaleString('id-ID')}*\n\n`;
               hasContent = true;
            }

            // Attendance
            if (targetModules.includes('attendance')) {
               // Use Query for today
               const resAtt = await pool.query(`
                  SELECT 
                     COUNT(*) FILTER (WHERE time_in IS NOT NULL) as present,
                     COUNT(*) FILTER (WHERE is_late = 1) as late
                  FROM attendance 
                  WHERE date = $1
               `, [new Date().toDateString()]); // Using device date string usually stored in DB
               
               // Fallback if DB uses ISO string
               if (resAtt.rows[0].present == 0) {
                   // Try ISO check just in case
                   // Not implementing complex double-check to keep it fast, relying on standard format
               }

               const { present, late } = resAtt.rows[0] || { present: 0, late: 0 };
               message += `👥 *ABSENSI KARYAWAN*\n✅ Hadir: ${present} orang\n⚠️ Terlambat: ${late} orang\n\n`;
               hasContent = true;
            }

            // Requests
            if (targetModules.includes('requests')) {
                const resReq = await pool.query(`SELECT type, COUNT(*) as count FROM leave_requests WHERE status = 'PENDING' GROUP BY type`);
                const pendingTotal = resReq.rows.reduce((acc, curr) => acc + Number(curr.count), 0);
                if (pendingTotal > 0) {
                   message += `📩 *PENDING REQUESTS*: ${pendingTotal}\n`;
                } else {
                   message += `📩 *REQUESTS*: All Clear\n`;
                }
                hasContent = true;
                message += '\n';
            }
            
            // Projects
            if (targetModules.includes('projects')) {
                 const resProj = await pool.query(`SELECT status, COUNT(*) as count FROM projects GROUP BY status`);
                 message += `📊 *PROJECT STATUS*\n`;
                 resProj.rows.forEach(r => {
                     message += `- ${r.status}: ${r.count}\n`;
                 });
                 if (resProj.rows.length === 0) message += `(No active projects)\n`;
                 hasContent = true;
            }

            if (!hasContent) message += "_Tidak ada data laporan yang dipilih._";

            // 4. Send Telegram
            const telegramUrl = `https://api.telegram.org/bot${settings.telegram_bot_token}/sendMessage`;
            let body = { chat_id: settings.telegram_owner_chat_id, text: message, parse_mode: 'Markdown' };

            // Fetch Polyfill/Check
            const fetchFn = global.fetch || require('node-fetch'); // Assuming Node 18 or 'node-fetch' available. If not, this might fail. 
            // Since this is a custom server, and user has 'npm run dev', likely Node 18+.
            
            const resp = await fetchFn(telegramUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            if (resp.ok) {
                console.log(`[Scheduler] Recap sent to ${settings.telegram_owner_chat_id}`);
                // 5. Log Success
                await pool.query(`
                    INSERT INTO system_logs (id, timestamp, actor_id, actor_name, actor_role, action_type, details, target_obj)
                    VALUES ($1, $2, 'system', 'SYSTEM CRON', 'SYSTEM', 'DAILY_RECAP_AUTO', $3, 'Telegram')
                `, [`log_cron_${Date.now()}`, Date.now(), `Laporan Harian sent for ${dateStr}`]);
            } else {
                console.error(`[Scheduler] Telegram Failed: ${resp.status}`);
            }

        } catch (e) {
            console.error('[Scheduler] Error:', e);
        }
    }, 60000); // Check every minute
};

if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`SDM ERP backend running on port ${PORT}`);
    startDailyRecapScheduler();
  });
}

module.exports = app;
