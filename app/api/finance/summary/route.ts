
import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { authorize } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    await authorize(['OWNER', 'FINANCE', 'MANAGER']);

    const { searchParams } = new URL(request.url);
    const businessUnitId = searchParams.get('businessUnitId');
    const hasUnitFilter = businessUnitId && businessUnitId !== 'ALL';

    const client = await pool.connect();
    try {
      // 1. Calculate Balance per Account
      // Updated: Join with financial_accounts to use stable IDs but return Names for frontend compatibility
      let balanceQuery = `
        SELECT 
           COALESCE(fa.name, t.account) as account_name,
           SUM(CASE WHEN t.type = 'IN' THEN t.amount ELSE -t.amount END) as balance
        FROM transactions t
        LEFT JOIN financial_accounts fa ON t.account_id = fa.id
      `;
      const balanceParams: any[] = [];
      
      if (hasUnitFilter) {
          balanceQuery += ` WHERE t.business_unit_id = $1`;
          balanceParams.push(businessUnitId);
      }
      balanceQuery += ` GROUP BY COALESCE(fa.name, t.account)`;

      const balanceRes = await client.query(balanceQuery, balanceParams);

      // 2. Calculate This Month's P&L
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString();
      
      let plQuery = `
        SELECT type, SUM(amount) as total
        FROM transactions
        WHERE date >= $1 AND date <= $2
      `;
      const plParams: any[] = [startOfMonth, endOfMonth];

      if (hasUnitFilter) {
          plQuery += ` AND business_unit_id = $3`;
          plParams.push(businessUnitId);
      }
      plQuery += ` GROUP BY type`;
      
      const plRes = await client.query(plQuery, plParams);

      const income = Number(plRes.rows.find(r => r.type === 'IN')?.total || 0);
      const expense = Number(plRes.rows.find(r => r.type === 'OUT')?.total || 0);

      const accountBalances: Record<string, number> = {};
      let totalAssets = 0;

      balanceRes.rows.forEach(r => {
        const bal = Number(r.balance);
        // Use the joined name or fallback to stored string
        const accName = r.account_name; 
        if (accName) {
            accountBalances[accName] = bal;
            totalAssets += bal;
        }
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
