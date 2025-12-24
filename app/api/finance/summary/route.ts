
import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { authorize } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await authorize(['OWNER', 'FINANCE', 'MANAGER']);

    const client = await pool.connect();
    try {
      // 1. Calculate Balance per Account
      // Note: We group by 'account' column in transactions.
      const balanceRes = await client.query(`
        SELECT account, 
               SUM(CASE WHEN type = 'IN' THEN amount ELSE -amount END) as balance
        FROM transactions
        GROUP BY account
      `);

      // 2. Calculate This Month's P&L
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString();
      
      const plRes = await client.query(`
        SELECT type, SUM(amount) as total
        FROM transactions
        WHERE date >= $1 AND date <= $2
        GROUP BY type
      `, [startOfMonth, endOfMonth]);

      const income = Number(plRes.rows.find(r => r.type === 'IN')?.total || 0);
      const expense = Number(plRes.rows.find(r => r.type === 'OUT')?.total || 0);

      const accountBalances: Record<string, number> = {};
      let totalAssets = 0;

      balanceRes.rows.forEach(r => {
        const bal = Number(r.balance);
        accountBalances[r.account] = bal;
        totalAssets += bal;
      });

      return NextResponse.json({
        accountBalances,
        totalAssets,
        monthStats: {
          income,
          expense,
          profit: income - expense
        }
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to fetch summary' }, { status: 500 });
  }
}
