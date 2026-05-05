
/**
 * GET /api/finance/debug-balance?account=120005-Kas%20Mandiri%20Jaka%2018887
 *
 * Deep diagnostic: shows exactly how the balance is derived for a specific account,
 * breaking down every transaction that touches it.
 * SAFE: Read-only. No writes.
 */
import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { authorize } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const user = await authorize(['OWNER', 'FINANCE']);
        const { tenantId } = user;
        const { searchParams } = new URL(request.url);
        const accountName = searchParams.get('account') || '120005-Kas Mandiri Jaka 18887';

        const client = await pool.connect();
        try {
            // 1. All transactions touching this account (any direction)
            const txRes = await client.query(`
                SELECT 
                    id,
                    date::text,
                    type,
                    account,
                    category,
                    amount::numeric,
                    description,
                    status
                FROM transactions
                WHERE tenant_id = $1
                  AND (LOWER(account) = LOWER($2) OR LOWER(category) = LOWER($2))
                ORDER BY date ASC, created_at ASC
            `, [tenantId, accountName]);

            // 2. Compute balance step by step
            let running = 0;
            const rows = txRes.rows.map(t => {
                const amt = Number(t.amount);
                let effect = 0;
                let rule = '';

                if (t.account?.toLowerCase() === accountName.toLowerCase() && t.type === 'IN') {
                    effect = +amt; rule = 'account=this & type=IN → +amount';
                } else if (t.account?.toLowerCase() === accountName.toLowerCase() && t.type === 'OUT') {
                    effect = -amt; rule = 'account=this & type=OUT → -amount (expense/transfer-source)';
                } else if (t.category?.toLowerCase() === accountName.toLowerCase() && t.type === 'OUT') {
                    effect = +amt; rule = 'category=this & type=OUT → +amount (transfer-dest)';
                } else if (t.category?.toLowerCase() === accountName.toLowerCase() && t.type === 'IN') {
                    effect = 0; rule = '❌ ANOMALY: category=this & type=IN → ignored (write-convention says never happens)';
                }

                running += effect;
                return {
                    id: t.id.substring(0, 12),
                    date: t.date,
                    type: t.type,
                    account: t.account,
                    category: t.category,
                    amount: amt,
                    effect,
                    running,
                    rule,
                    status: t.status,
                    description: t.description?.substring(0, 40)
                };
            });

            // 3. Check cached balance column
            const faRes = await client.query(`
                SELECT id, name, balance::numeric FROM financial_accounts
                WHERE tenant_id = $1 AND LOWER(name) = LOWER($2)
            `, [tenantId, accountName]);

            const cachedBalance = faRes.rows[0] ? Number(faRes.rows[0].balance) : null;

            // 4. Anomaly detection
            const anomalies = rows.filter(r => r.effect === 0 && r.rule.includes('ANOMALY'));

            return NextResponse.json({
                account: accountName,
                computedBalance: running,
                cachedBalance,
                discrepancy: cachedBalance !== null ? (running - cachedBalance) : null,
                totalTransactions: rows.length,
                anomalies: anomalies.length,
                anomalyRows: anomalies,
                transactions: rows
            });
        } finally {
            client.release();
        }
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
