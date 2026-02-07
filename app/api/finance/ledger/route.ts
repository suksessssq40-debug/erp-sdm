
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
            // --- 1. Identify Account Type ---
            // Format can be "Bank Name" or "123456 - COA Name"
            let targetAccountId: string | null = null;
            let targetCoaId: string | null = null;
            let coaCode: string | null = null;

            // Check if it's a Bank Account
            const bankRes = await client.query(
                'SELECT id FROM financial_accounts WHERE tenant_id = $1 AND name ILIKE $2',
                [tenantId, accountName]
            );

            if (bankRes.rows.length > 0) {
                targetAccountId = bankRes.rows[0].id;
            } else {
                // If not bank, check if it matches a COA
                // Extract code if present (format "132100 - Name")
                const match = accountName.match(/^(\d+)\s*[-]\s*(.*)$/);
                const searchCode = match ? match[1] : null;

                const coaRes = await client.query(
                    `SELECT id, code, type FROM chart_of_accounts 
                     WHERE tenant_id = $1 AND (code = $2 OR name ILIKE $3)`,
                    [tenantId, searchCode, `%${accountName}%`]
                );

                if (coaRes.rows.length > 0) {
                    targetCoaId = coaRes.rows[0].id;
                    coaCode = coaRes.rows[0].code;
                }
            }

            // --- 2. Build Query Filters ---
            // We search by exact IDs primarily, but fallback to strings for legacy data/unlinked imports
            let whereClause = `t.tenant_id = $1`;
            const params: any[] = [tenantId];
            let paramIdx = 2;

            if (targetAccountId) {
                // Bank Account Ledger
                whereClause += ` AND (t.account_id = $${paramIdx} OR t.account ILIKE $${paramIdx + 1})`;
                params.push(targetAccountId, accountName);
                paramIdx += 2;
            } else if (targetCoaId) {
                // COA Ledger (Flexible matching to catch "132100-Name" and "132100 - Name")
                whereClause += ` AND (t.coa_id = $${paramIdx} OR t.category ILIKE $${paramIdx + 1})`;
                params.push(targetCoaId, `%${coaCode}%`);
                paramIdx += 2;
            } else {
                // Fallback if neither found (search by name)
                whereClause += ` AND (t.account ILIKE $${paramIdx} OR t.category ILIKE $${paramIdx})`;
                params.push(`%${accountName}%`);
                paramIdx++;
            }

            if (businessUnitId && businessUnitId !== 'ALL') {
                whereClause += ` AND t.business_unit_id = $${paramIdx}`;
                params.push(businessUnitId);
                paramIdx++;
            }

            // --- 3. Calculate Opening Balance ---
            const openingQuery = `
                SELECT SUM(CASE WHEN t.type = 'IN' THEN t.amount ELSE -t.amount END) as total
                FROM transactions t
                WHERE ${whereClause} AND t.date < $${paramIdx}
            `;
            const openingRes = await client.query(openingQuery, [...params, startDate]);
            const openingBalance = Number(openingRes.rows[0]?.total || 0);

            // --- 4. Fetch Transactions ---
            const transQuery = `
                SELECT t.*, fa.name as linked_account_name 
                FROM transactions t
                LEFT JOIN financial_accounts fa ON t.account_id = fa.id
                WHERE ${whereClause} AND t.date >= $${paramIdx} AND t.date <= $${paramIdx + 1}
                ORDER BY t.date ASC, t.created_at ASC
            `;
            const transRes = await client.query(transQuery, [...params, startDate, endDate]);

            const transactions = transRes.rows.map(t => ({
                id: t.id,
                date: t.date.toISOString().split('T')[0],
                amount: Number(t.amount),
                type: t.type,
                category: t.category,
                description: t.description,
                account: t.linked_account_name || t.account,
                businessUnitId: t.business_unit_id,
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
        console.error("Ledger Fetch Error:", error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
