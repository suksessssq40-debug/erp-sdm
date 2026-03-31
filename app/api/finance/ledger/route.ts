
import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { authorize } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const user = await authorize(['OWNER', 'FINANCE', 'MANAGER']);
        const { tenantId } = user;

        const { searchParams } = new URL(request.url);
        const accountName = searchParams.get('accountName');
        const startDate = searchParams.get('startDate');
        const endDate = searchParams.get('endDate');
        const businessUnitId = searchParams.get('businessUnitId');

        if (!startDate || !endDate || !accountName) {
            return NextResponse.json({ error: 'Start date, End date, and Account Name are required' }, { status: 400 });
        }

        const client = await pool.connect();
        try {
            // --- 1. Identify Account Details (Robust Case-Insensitive) ---
            const accountRes = await client.query(`
                SELECT name, 'BANK' as source, 'DEBIT' as normal_pos FROM financial_accounts WHERE tenant_id = $1 AND LOWER(name) = LOWER($2)
                UNION ALL
                SELECT name, 'COA' as source, normal_pos FROM chart_of_accounts WHERE tenant_id = $1 AND (LOWER(name) = LOWER($2) OR code = $2)
                LIMIT 1
            `, [tenantId, accountName]);

            if (accountRes.rows.length === 0) {
                return NextResponse.json({ openingBalance: 0, transactions: [], normalPos: 'DEBIT' });
            }

            const acc = accountRes.rows[0];
            const name = acc.name;
            const normalPos = acc.normal_pos;

            // --- 2. Opening Balance Calculation (Universal) ---
            const openingQuery = `
                SELECT 
                    SUM(CASE 
                        WHEN (LOWER(account) = LOWER($2) AND type = 'IN') OR (LOWER(category) = LOWER($2) AND type = 'OUT') THEN amount 
                        ELSE 0 
                    END) as total_debit,
                    SUM(CASE 
                        WHEN (LOWER(account) = LOWER($2) AND type = 'OUT') OR (LOWER(category) = LOWER($2) AND type = 'IN') THEN amount 
                        ELSE 0 
                    END) as total_credit
                FROM transactions 
                WHERE tenant_id = $1 AND date < $3
                ${businessUnitId && businessUnitId !== 'ALL' ? `AND business_unit_id = $4` : ''}
            `;
            
            const openingParams = [tenantId, name, startDate];
            if (businessUnitId && businessUnitId !== 'ALL') openingParams.push(businessUnitId);

            const openingRes = await client.query(openingQuery, openingParams);
            const op = openingRes.rows[0];
            const opDr = Number(op.total_debit || 0);
            const opCr = Number(op.total_credit || 0);
            const openingBalance = normalPos === 'DEBIT' ? (opDr - opCr) : (opCr - opDr);

            const startD = new Date(startDate).toISOString();
            const endD = new Date(endDate);
            endD.setUTCHours(23, 59, 59, 999);
            
            // --- 3. Transaction Rows (Universal) ---
            const transQuery = `
                SELECT * FROM transactions 
                WHERE tenant_id = $1 
                AND (LOWER(account) = LOWER($2) OR LOWER(category) = LOWER($2))
                AND date >= $3 AND date <= $4
                ${businessUnitId && businessUnitId !== 'ALL' ? `AND business_unit_id = $5` : ''}
                ORDER BY date ASC, created_at ASC
            `;

            const transParams = [tenantId, name, startD, endD.toISOString()];
            if (businessUnitId && businessUnitId !== 'ALL') transParams.push(businessUnitId);

            const transRes = await client.query(transQuery, transParams);

            const transactions = transRes.rows.map(t => {
                const amt = Number(t.amount);
                let debit = 0;
                let credit = 0;

                // Universal Debit Logic: If it matches Account while IN, or Category while OUT
                if ((t.account.toLowerCase() === name.toLowerCase() && t.type === 'IN') || 
                    (t.category.toLowerCase() === name.toLowerCase() && t.type === 'OUT')) {
                    debit = amt;
                } else {
                    credit = amt;
                }

                return {
                    id: t.id,
                    date: t.date.toISOString().split('T')[0],
                    amount: amt,
                    debit,
                    credit,
                    type: t.type,
                    description: t.description,
                    account: t.account,
                    category: t.category,
                    businessUnitId: t.business_unit_id,
                    imageUrl: t.image_url
                };
            });

            return NextResponse.json({
                openingBalance,
                normalPos,
                transactions
            });

        } finally {
            client.release();
        }
    } catch (error) {
        console.error("Ledger Fetch Error:", error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
