
import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { authorize } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/finance/ledger
 *
 * Returns a ledger (buku besar) view for a single account over a date range.
 *
 * Write convention (from POST /api/transactions):
 *   IN  → `account` field = bank name; `category` = revenue/expense label
 *          Effect: bank.balance += amount  (money enters bank)
 *
 *   OUT → `account` field = bank name (credit side, SWAPPED on write);
 *          `category` = expense label   (for plain expense)
 *       OR `category` = another bank    (for inter-bank transfer: dest bank)
 *          Effect: source bank.balance -= amount
 *                  dest   bank.balance += amount  (transfer only)
 *
 * Therefore, for any given account name in the ledger:
 *
 *   ROW IS DEBIT  (increases the account's balance) when:
 *     → type='IN'  AND LOWER(account) = thisName   (money enters — bank receives)
 *     → type='OUT' AND LOWER(category)= thisName   (transfer destination — bank receives)
 *
 *   ROW IS CREDIT (decreases the account's balance) when:
 *     → type='OUT' AND LOWER(account) = thisName   (money leaves — bank pays out)
 *     → type='IN'  AND LOWER(category)= thisName   (edge: safety net, shouldn't occur in practice)
 *
 * Opening Balance uses the same debit/credit rule but scoped to date < startDate.
 */
export async function GET(request: Request) {
    try {
        const user = await authorize(['OWNER', 'FINANCE', 'MANAGER']);
        const { tenantId } = user;

        const { searchParams } = new URL(request.url);
        const accountName   = searchParams.get('accountName');
        const startDate     = searchParams.get('startDate');
        const endDate       = searchParams.get('endDate');
        const businessUnitId = searchParams.get('businessUnitId');

        if (!startDate || !endDate || !accountName) {
            return NextResponse.json(
                { error: 'startDate, endDate, and accountName are required' },
                { status: 400 }
            );
        }

        const client = await pool.connect();
        try {
            // ── 1. Resolve the account (Bank or COA) and its normal balance position ──
            const accountRes = await client.query<{
                name: string;
                source: string;
                normal_pos: string;
            }>(`
                SELECT name, 'BANK' AS source, 'DEBIT' AS normal_pos
                FROM   financial_accounts
                WHERE  tenant_id = $1 AND LOWER(name) = LOWER($2) AND is_active = true
                UNION ALL
                SELECT name, 'COA' AS source, COALESCE(normal_pos, 'DEBIT') AS normal_pos
                FROM   chart_of_accounts
                WHERE  tenant_id = $1 AND (LOWER(name) = LOWER($2) OR code = $2)
                LIMIT  1
            `, [tenantId, accountName]);

            if (accountRes.rows.length === 0) {
                return NextResponse.json({ openingBalance: 0, transactions: [], normalPos: 'DEBIT' });
            }

            const { name, normal_pos: normalPos } = accountRes.rows[0];

            // ── 2. Opening Balance — all transactions BEFORE startDate ──
            //    Using the canonical debit/credit rule for this account.
            const unitParam      = (businessUnitId && businessUnitId !== 'ALL') ? businessUnitId : null;
            const openingParams: any[] = [tenantId, name, startDate];
            if (unitParam) openingParams.push(unitParam);

            const openingRes = await client.query<{
                total_debit: string | null;
                total_credit: string | null;
            }>(`
                SELECT
                    SUM(CASE
                        WHEN LOWER(account)  = LOWER($2) AND type = 'IN'  THEN amount
                        WHEN LOWER(category) = LOWER($2) AND type = 'OUT' THEN amount
                        ELSE 0
                    END) AS total_debit,

                    SUM(CASE
                        WHEN LOWER(account)  = LOWER($2) AND type = 'OUT' THEN amount
                        WHEN LOWER(category) = LOWER($2) AND type = 'IN'  THEN amount
                        ELSE 0
                    END) AS total_credit

                FROM  transactions
                WHERE tenant_id = $1
                  AND date < $3
                  ${unitParam ? 'AND business_unit_id = $4' : ''}
            `, openingParams);

            const opRow         = openingRes.rows[0];
            const opDebit       = Number(opRow?.total_debit  ?? 0);
            const opCredit      = Number(opRow?.total_credit ?? 0);
            // For DEBIT-normal accounts (Asset/Bank): balance = Debit − Credit
            // For CREDIT-normal accounts (Liability/Equity/Revenue): balance = Credit − Debit
            const openingBalance = normalPos === 'DEBIT' ? (opDebit - opCredit) : (opCredit - opDebit);

            // ── 3. Transaction rows within the selected date range ──
            const startISO = new Date(startDate + 'T00:00:00.000Z').toISOString();
            const endD     = new Date(endDate);
            endD.setUTCHours(23, 59, 59, 999);
            const endISO   = endD.toISOString();

            const transParams: any[] = [tenantId, name, startISO, endISO];
            if (unitParam) transParams.push(unitParam);

            const transRes = await client.query(`
                SELECT
                    id,
                    date,
                    amount,
                    type,
                    account,
                    category,
                    description,
                    business_unit_id,
                    image_url,
                    created_at
                FROM  transactions
                WHERE tenant_id = $1
                  AND (LOWER(account) = LOWER($2) OR LOWER(category) = LOWER($2))
                  AND date >= $3 AND date <= $4
                  ${unitParam ? 'AND business_unit_id = $5' : ''}
                ORDER BY date ASC, created_at ASC
            `, transParams);

            const transactions = transRes.rows.map(t => {
                const amt = Number(t.amount ?? 0);

                // Same debit/credit rule as the opening balance above
                const isDebit =
                    (t.account  && t.account.toLowerCase()  === name.toLowerCase() && t.type === 'IN')  ||
                    (t.category && t.category.toLowerCase() === name.toLowerCase() && t.type === 'OUT');

                return {
                    id:             t.id,
                    date:           t.date instanceof Date
                                        ? t.date.toISOString().split('T')[0]
                                        : String(t.date).substring(0, 10),
                    amount:         amt,
                    debit:          isDebit ? amt : 0,
                    credit:         isDebit ? 0   : amt,
                    type:           t.type,
                    description:    t.description   ?? '',
                    account:        t.account       ?? '',
                    category:       t.category      ?? '',
                    businessUnitId: t.business_unit_id ?? null,
                    imageUrl:       t.image_url     ?? null,
                };
            });

            return NextResponse.json({ openingBalance, normalPos, transactions });

        } finally {
            client.release();
        }

    } catch (error) {
        console.error('[LEDGER] Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
