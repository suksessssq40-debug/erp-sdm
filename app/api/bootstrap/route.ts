import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import bcrypt from 'bcryptjs';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function ensureSeedData() {
  const client = await pool.connect();
  try {
    // Basic Settings
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
        `INSERT INTO settings (office_lat, office_lng, office_start_time, office_end_time, telegram_bot_token, telegram_group_id, telegram_owner_chat_id, company_profile_json)
         VALUES ($1, $2, $3, $4, '', '', '', $5)`,
        [-6.2, 106.816666, '08:00', '17:00', JSON.stringify(companyProfile)]
      );
    }
    
    // Seed Users if empty
    const resUsers = await client.query('SELECT count(*) FROM users');
    if (parseInt(resUsers.rows[0].count) === 0) {
       const defaultUsers = [
          { id: '1', name: 'Budi Owner', username: 'owner', telegramId: '111', telegramUsername: '@budi_owner', role: 'OWNER', password: 'owner123' },
          { id: '2', name: 'Siti Manager', username: 'manager', telegramId: '222', telegramUsername: '@siti_mgr', role: 'MANAGER', password: 'manager123' },
          { id: '3', name: 'Andi Finance', username: 'finance', telegramId: '333', telegramUsername: '@andi_fin', role: 'FINANCE', password: 'finance123' },
          { id: '4', name: 'Joko Staff', username: 'staff', telegramId: '444', telegramUsername: '@joko_sdm', role: 'STAFF', password: 'staff123' },
          { id: '99', name: 'Super Dev', username: 'superadmin', telegramId: '000', telegramUsername: '@super_dev', role: 'SUPERADMIN', password: 'dev' }
       ];
       for (const u of defaultUsers) {
          const hash = await bcrypt.hash(u.password, 10);
          await client.query(
            'INSERT INTO users (id, name, username, telegram_id, telegram_username, role, password_hash) VALUES ($1, $2, $3, $4, $5, $6, $7)',
            [u.id, u.name, u.username, u.telegramId, u.telegramUsername, u.role, hash]
          );
       }
    }
    
    // Ensure Superadmin exists independently of other users
    const resSuper = await client.query("SELECT id FROM users WHERE role = 'SUPERADMIN' LIMIT 1");
    if (resSuper.rows.length === 0) {
       const u = { id: '99', name: 'Super Dev', username: 'superadmin', telegramId: '000', telegramUsername: '@super_dev', role: 'SUPERADMIN', password: 'dev' };
       const hash = await bcrypt.hash(u.password, 10);
       await client.query(
         'INSERT INTO users (id, name, username, telegram_id, telegram_username, role, password_hash) VALUES ($1, $2, $3, $4, $5, $6, $7)',
         [u.id, u.name, u.username, u.telegramId, u.telegramUsername, u.role, hash]
       );
    }

    // Ensure system_logs table exists
    await client.query(`
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
      )
    `);

    // Ensure device_ids column exists (Migration for Multi-Device)
    await client.query(`
      DO $$ 
      BEGIN 
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='device_ids') THEN
          ALTER TABLE users ADD COLUMN device_ids JSONB DEFAULT '[]';
        END IF;
      END $$;
    `);

    // Ensure CHAT tables exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS chat_rooms (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(100),
        type VARCHAR(20),
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
        created_at BIGINT
      );
    `);

    // Ensure Default 'General' Room
    const resGeneral = await client.query("SELECT id FROM chat_rooms WHERE id = 'general'");
    if (resGeneral.rows.length === 0) {
      await client.query(
        "INSERT INTO chat_rooms (id, name, type, created_by, created_at) VALUES ($1, $2, $3, $4, $5)",
        ['general', 'General Forum', 'GROUP', 'system', Date.now()]
      );
      // Add all existing users to general
      const allUsers = await client.query("SELECT id FROM users");
      for (const u of allUsers.rows) {
         await client.query(
           "INSERT INTO chat_members (room_id, user_id, joined_at) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING",
           ['general', u.id, Date.now()]
         );
      }
    }
  } catch (e) {
    console.error("Seed Check Failed", e);
  } finally {
    client.release();
  }
}

export async function GET() {
  try {
    await ensureSeedData(); // Ensure DB is ready
    
    const client = await pool.connect();
    try {
      const [
        usersRes, projectsRes, attendanceRes, requestsRes, 
        transactionsRes, dailyReportsRes, salaryConfigsRes, 
        payrollRes, logsRes, settingsRes
      ] = await Promise.all([
        client.query('SELECT * FROM users'),
        client.query('SELECT * FROM projects'),
        client.query('SELECT * FROM attendance ORDER BY date DESC, time_in DESC LIMIT 500'),
        client.query('SELECT * FROM leave_requests ORDER BY created_at DESC LIMIT 200'),
        client.query('SELECT * FROM transactions ORDER BY date DESC LIMIT 500'),
        client.query('SELECT * FROM daily_reports ORDER BY date DESC LIMIT 200'),
        client.query('SELECT * FROM salary_configs'),
        client.query('SELECT * FROM payroll_records ORDER BY processed_at DESC LIMIT 100'),
        client.query('SELECT * FROM system_logs ORDER BY timestamp DESC LIMIT 1000'),
        client.query('SELECT * FROM settings LIMIT 1')
      ]);

      const settingsRow = settingsRes.rows[0];
      const settings = settingsRow ? {
        officeLocation: { lat: settingsRow.office_lat, lng: settingsRow.office_lng },
        officeHours: { start: settingsRow.office_start_time, end: settingsRow.office_end_time },
        telegramBotToken: settingsRow.telegram_bot_token || '',
        telegramGroupId: settingsRow.telegram_group_id || '',
        telegramOwnerChatId: settingsRow.telegram_owner_chat_id || '',
        companyProfile: JSON.parse(settingsRow.company_profile_json || '{}')
      } : {};

      const data = {
        users: usersRes.rows.map(u => ({
          id: u.id,
          name: u.name,
          username: u.username,
          telegramId: u.telegram_id || '',
          telegramUsername: u.telegram_username || '',
          role: u.role,
          deviceId: u.device_id || null,
          deviceIds: u.device_ids || [],
          avatarUrl: u.avatar_url || undefined,
          jobTitle: u.job_title || undefined,
          bio: u.bio || undefined
        })),
        projects: projectsRes.rows.map(p => ({
          id: p.id,
          title: p.title,
          description: p.description || '',
          collaborators: JSON.parse(p.collaborators_json || '[]'),
          deadline: p.deadline ? new Date(p.deadline).toISOString().split('T')[0] : '', 
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
        logs: logsRes.rows.map(l => ({
          id: l.id,
          timestamp: Number(l.timestamp),
          actorId: l.actor_id,
          actorName: l.actor_name,
          actorRole: l.actor_role,
          actionType: l.action_type,
          details: l.details,
          target: l.target_obj || undefined,
          metadata: l.metadata_json ? JSON.parse(l.metadata_json) : undefined
        })),
        settings
      };

      return NextResponse.json(data);
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Bootstrap error', err);
    return NextResponse.json({ error: 'Failed to load initial data' }, { status: 500 });
  }
}
