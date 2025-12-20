import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { authorize } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    await authorize(['OWNER', 'FINANCE']);
    const pr = await request.json();
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
      return NextResponse.json(pr, { status: 201 });
    } catch (e) {
      await client.query('ROLLBACK');
      console.error(e);
      return NextResponse.json({ error: 'Failed' }, { status: 500 });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
