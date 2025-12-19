const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('./db.cjs');
const multer = require('multer');
const { createClient } = require('@supabase/supabase-js');
// require('dotenv').config(); // Handled in db.cjs or Vercel Env

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

// DEBUG ENDPOINT
app.get('/api/db-check', async (req, res) => {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW()');
    client.release();
    res.json({ status: 'ok', time: result.rows[0], env: process.env.NODE_ENV });
  } catch (err) {
    console.error("DB Check Failed:", err);
    res.status(500).json({ 
      status: 'error', 
      message: err.message,
      code: err.code
    });
  }
});

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
    await ensureSeedData();
    const client = await pool.connect();
    try {
      const usersRes = await client.query('SELECT * FROM users');
      const projectsRes = await client.query('SELECT * FROM projects');
      const attendanceRes = await client.query('SELECT * FROM attendance ORDER BY date DESC, time_in DESC LIMIT 500');
      const requestsRes = await client.query('SELECT * FROM leave_requests ORDER BY created_at DESC LIMIT 200');
      const transactionsRes = await client.query('SELECT * FROM transactions ORDER BY date DESC LIMIT 500');
      const dailyReportsRes = await client.query('SELECT * FROM daily_reports ORDER BY date DESC LIMIT 200');
      const salaryConfigsRes = await client.query('SELECT * FROM salary_configs');
      const payrollRes = await client.query('SELECT * FROM payroll_records ORDER BY processed_at DESC LIMIT 100');
      const settingsRes = await client.query('SELECT * FROM settings LIMIT 1');

      const settingsRow = settingsRes.rows[0];
      const settings = settingsRow ? {
        officeLocation: { lat: settingsRow.office_lat, lng: settingsRow.office_lng },
        officeHours: { start: settingsRow.office_start_time, end: settingsRow.office_end_time },
        telegramBotToken: settingsRow.telegram_bot_token || '',
        telegramGroupId: settingsRow.telegram_group_id || '',
        telegramOwnerChatId: settingsRow.telegram_owner_chat_id || '',
        companyProfile: JSON.parse(settingsRow.company_profile_json || '{}')
      } : {};

      res.json({
        users: usersRes.rows.map(u => ({
          id: u.id,
          name: u.name,
          username: u.username,
          telegramId: u.telegram_id || '',
          telegramUsername: u.telegram_username || '',
          role: u.role
        })),
        projects: projectsRes.rows.map(p => ({
          id: p.id,
          title: p.title,
          description: p.description || '',
          collaborators: JSON.parse(p.collaborators_json || '[]'),
          deadline: p.deadline ? new Date(p.deadline).toISOString().split('T')[0] : '', // Postgres returns Date object
          status: p.status,
          tasks: JSON.parse(p.tasks_json || '[]'),
          comments: p.comments_json ? JSON.parse(p.comments_json) : [],
          isManagementOnly: !!p.is_management_only,
          priority: p.priority,
          createdBy: p.created_by,
          createdAt: Number(p.created_at)
        })),
        attendance: attendanceRes.rows.map(a => ({
          id: a.id,
          userId: a.user_id,
          date: a.date,
          timeIn: a.time_in,
          timeOut: a.time_out || undefined,
          isLate: !!a.is_late,
          lateReason: a.late_reason || undefined,
          selfieUrl: a.selfie_url,
          checkOutSelfieUrl: a.checkout_selfie_url || undefined,
          location: { lat: a.location_lat, lng: a.location_lng }
        })),
        requests: requestsRes.rows.map(r => ({
          id: r.id,
          userId: r.user_id,
          type: r.type,
          description: r.description,
          startDate: new Date(r.start_date).toISOString().split('T')[0],
          endDate: r.end_date ? new Date(r.end_date).toISOString().split('T')[0] : new Date(r.start_date).toISOString().split('T')[0],
          attachmentUrl: r.attachment_url || undefined,
          status: r.status,
          createdAt: Number(r.created_at)
        })),
        transactions: transactionsRes.rows.map(t => ({
          id: t.id,
          date: new Date(t.date).toISOString().split('T')[0],
          amount: Number(t.amount),
          type: t.type,
          category: t.category || '',
          description: t.description,
          account: t.account,
          imageUrl: t.image_url || undefined
        })),
        dailyReports: dailyReportsRes.rows.map(r => ({
          id: r.id,
          userId: r.user_id,
          date: r.date,
          activities: JSON.parse(r.activities_json || '[]')
        })),
        salaryConfigs: salaryConfigsRes.rows.map(c => ({
          userId: c.user_id,
          basicSalary: Number(c.basic_salary),
          allowance: Number(c.allowance),
          mealAllowance: Number(c.meal_allowance),
          lateDeduction: Number(c.late_deduction)
        })),
        payrollRecords: payrollRes.rows.map(pr => ({
          id: pr.id,
          userId: pr.user_id,
          month: pr.month,
          basicSalary: Number(pr.basic_salary),
          allowance: Number(pr.allowance),
          totalMealAllowance: Number(pr.total_meal_allowance),
          bonus: Number(pr.bonus),
          deductions: Number(pr.deductions),
          netSalary: Number(pr.net_salary),
          isSent: !!pr.is_sent,
          processedAt: Number(pr.processed_at),
          metadata: pr.metadata_json ? JSON.parse(pr.metadata_json) : undefined
        })),
        settings
      });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("Bootstrap Error:", err);
    res.status(500).json({ 
      error: 'Failed to bootstrap data', 
      message: err.message,
      stack: process.env.NODE_ENV === 'production' ? 'hidden' : err.stack 
    });
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
    if (u.device_id && deviceId && u.device_id !== deviceId) {
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
      `UPDATE settings SET office_lat=$1, office_lng=$2, office_start_time=$3, office_end_time=$4, telegram_bot_token=$5, telegram_group_id=$6, telegram_owner_chat_id=$7, company_profile_json=$8 WHERE id=$9`,
      [
        s.officeLocation.lat, s.officeLocation.lng, s.officeHours.start, s.officeHours.end,
        s.telegramBotToken || '', s.telegramGroupId || '', s.telegramOwnerChatId || '', 
        JSON.stringify(s.companyProfile), id
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
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`SDM ERP backend running on port ${PORT}`);
  });
}

module.exports = app;
