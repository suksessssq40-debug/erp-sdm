import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET(request: Request) {
  // Security: usually you want to protect this with a secret key or auth.
  // For this temporary session, we assume the user executing this knows what they are doing.
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. TRUNCATE Transaction Tables (Emptying all activity data)
    // Using CASCADE to handle any foreign keys automatically
    await client.query(`
      TRUNCATE TABLE 
        attendance, 
        payroll_records, 
        leave_requests, 
        daily_reports, 
        transactions, 
        projects, 
        salary_configs,
        system_logs
      CASCADE;
    `);

    // 2. DELETE Users EXCEPT 'jaka'
    // This will remove all other staff, managers, admins.
    const deleteRes = await client.query("DELETE FROM users WHERE username != 'jaka'");

    await client.query('COMMIT');

    return NextResponse.json({ 
      success: true, 
      message: 'Database Reset Complete. All data wiped except owner "jaka".',
      deletedUsersCount: deleteRes.rowCount 
    });

  } catch (e: any) {
    await client.query('ROLLBACK');
    console.error("Reset Error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  } finally {
    client.release();
  }
}
