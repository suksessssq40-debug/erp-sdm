
import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { authorize } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    await authorize(['OWNER', 'FINANCE', 'MANAGER']);

    const { searchParams } = new URL(request.url);
    const accountName = searchParams.get('accountName'); // Logic uses Name currently
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const businessUnitId = searchParams.get('businessUnitId');

    if (!startDate || !endDate) {
        return NextResponse.json({ error: 'Start and End date required' }, { status: 400 });
    }

    const client = await pool.connect();
    try {
        // 1. Calculate Opening Balance (Sum before startDate)
        // Note: We match by Name OR ID logic. Since frontend sends Name, we filter by name or linked ID.
        // But for safety/consistency with existing code, we filter by string name in `account` column OR `financial_accounts.name`
        
        let openingQuery = `
            SELECT SUM(CASE WHEN t.type = 'IN' THEN t.amount ELSE -t.amount END) as total
            FROM transactions t
            LEFT JOIN financial_accounts fa ON t.account_id = fa.id
            WHERE t.date < $1
        `;
        const openingParams: any[] = [startDate];
        let paramIdx = 2;

        if (accountName && accountName !== 'ALL') {
            openingQuery += ` AND (t.account = $${paramIdx} OR fa.name = $${paramIdx})`;
            openingParams.push(accountName);
            paramIdx++;
        }

        if (businessUnitId && businessUnitId !== 'ALL') {
            openingQuery += ` AND t.business_unit_id = $${paramIdx}`;
            openingParams.push(businessUnitId);
            paramIdx++;
        }

        const openingRes = await client.query(openingQuery, openingParams);
        const openingBalance = Number(openingRes.rows[0]?.total || 0);


        // 2. Fetch Transactions in Range
        let transQuery = `
            SELECT t.*, fa.name as linked_account_name 
            FROM transactions t
            LEFT JOIN financial_accounts fa ON t.account_id = fa.id
            WHERE t.date >= $1 AND t.date <= $2
        `;
        const transParams: any[] = [startDate, endDate];
        paramIdx = 3;

        if (accountName && accountName !== 'ALL') {
            transQuery += ` AND (t.account = $${paramIdx} OR fa.name = $${paramIdx})`;
            transParams.push(accountName);
            paramIdx++;
        }

        if (businessUnitId && businessUnitId !== 'ALL') {
            transQuery += ` AND t.business_unit_id = $${paramIdx}`;
            transParams.push(businessUnitId);
            paramIdx++;
        }

        transQuery += ` ORDER BY t.date ASC, t.created_at ASC`; // Chronological for Ledger

        const transRes = await client.query(transQuery, transParams);

        // Map to safe format
        const transactions = transRes.rows.map(t => ({
            id: t.id,
            date: t.date.toISOString().split('T')[0],
            amount: Number(t.amount),
            type: t.type,
            category: t.category,
            description: t.description,
            account: t.linked_account_name || t.account,
            businessUnitId: t.business_unit_id, // snake_case from DB
            imageUrl: t.image_url
        }));

        return NextResponse.json({
            openingBalance,
            transactions
        });

    } finally {
      client.release();
    }
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to fetch ledger' }, { status: 500 });
  }
}
