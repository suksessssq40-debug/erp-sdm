
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
            // --- 1. Identify Account Details ---
            let targetAccountId: string | null = null;
            let targetCoaId: string | null = null;
            let coaCode: string | null = null;
            let normalPos: 'DEBIT' | 'CREDIT' = 'DEBIT'; // Default for Bank

            // Check if it's a Bank Account
            const bankRes = await client.query(
                'SELECT id FROM financial_accounts WHERE tenant_id = $1 AND name = $2',
                [tenantId, accountName]
            );

            if (bankRes.rows.length > 0) {
                targetAccountId = bankRes.rows[0].id;
                normalPos = 'DEBIT';
            } else {
                // If not bank, find COA
                const match = accountName.match(/^(\d+)\s*[-]\s*(.*)$/);
                const searchCode = match ? match[1] : null;

                const coaRes = await client.query(
                    `SELECT id, code, type, normal_pos FROM chart_of_accounts 
                     WHERE tenant_id = $1 AND (code = $2 OR name ILIKE $3)`,
                    [tenantId, searchCode, `%${accountName}%`]
                );

                if (coaRes.rows.length > 0) {
                    targetCoaId = coaRes.rows[0].id;
                    coaCode = coaRes.rows[0].code;
                    normalPos = coaRes.rows[0].normal_pos; // Use DB's normal position
                }
            }

            // --- 2. Build Query Filters ---
            let sideAClause = `(t.coa_id = $2 OR t.category ILIKE $3)`;
            let sideBClause = `(t.account_id = $4 OR t.account ILIKE $5)`;
            let params: any[] = [tenantId, targetCoaId, `%${coaCode}%`, targetAccountId, `%${accountName}%`];

            let filterClause = `(${sideAClause} OR ${sideBClause})`;
            let paramIdx = 6;

            if (businessUnitId && businessUnitId !== 'ALL') {
                filterClause += ` AND t.business_unit_id = $${paramIdx}`;
                params.push(businessUnitId);
                paramIdx++;
            }

            // --- 3. Opening Balance Logic ---
            const openingQuery = `
                SELECT 
                    t.type,
                    t.amount,
                    (t.coa_id = $2 OR t.category ILIKE $3) as is_side_a,
                    (t.account_id = $4 OR t.account ILIKE $5) as is_side_b
                FROM transactions t
                WHERE t.tenant_id = $1 AND ${filterClause} AND t.date < $${paramIdx}
            `;
            const openingRes = await client.query(openingQuery, [...params, startDate]);

            let openingDebit = 0;
            let openingCredit = 0;

            openingRes.rows.forEach(row => {
                const amt = Number(row.amount);
                if (row.is_side_b) {
                    if (row.type === 'IN') openingDebit += amt;
                    else openingCredit += amt;
                } else if (row.is_side_a) {
                    if (row.type === 'IN') openingCredit += amt;
                    else openingDebit += amt;
                }
            });

            const openingBalance = normalPos === 'DEBIT' ? (openingDebit - openingCredit) : (openingCredit - openingDebit);

            // --- 4. Fetch Transactions ---
            const transQuery = `
                SELECT 
                    t.*, 
                    fa.name as linked_account_name,
                    (t.coa_id = $2 OR t.category ILIKE $3) as is_side_a,
                    (t.account_id = $4 OR t.account ILIKE $5) as is_side_b
                FROM transactions t
                LEFT JOIN financial_accounts fa ON t.account_id = fa.id
                WHERE t.tenant_id = $1 AND ${filterClause} AND t.date >= $${paramIdx} AND t.date <= $${paramIdx + 1}
                ORDER BY t.date ASC, t.created_at ASC
            `;
            const transRes = await client.query(transQuery, [...params, startDate, endDate]);

            const transactions = transRes.rows.map(t => {
                const amt = Number(t.amount);
                let debit = 0;
                let credit = 0;

                if (t.is_side_b) {
                    if (t.type === 'IN') debit = amt;
                    else credit = amt;
                } else if (t.is_side_a) {
                    if (t.type === 'IN') credit = amt;
                    else debit = amt;
                }

                return {
                    id: t.id,
                    date: t.date.toISOString().split('T')[0],
                    amount: amt,
                    debit: debit,
                    credit: credit,
                    type: t.type,
                    category: t.category,
                    description: t.description,
                    account: t.linked_account_name || t.account,
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
