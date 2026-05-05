
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authorize } from '@/lib/auth';
import { Prisma } from '@prisma/client';

export const dynamic = 'force-dynamic';

/**
 * POST /api/finance/recalculate
 *
 * Recalculates and "heals" the cached `balance` column in `financial_accounts`
 * by re-deriving it from scratch using the transactions table as the single
 * source of truth.
 *
 * Convention (from POST /api/transactions):
 *   IN  → account = bank (debit side).  bank.balance  += amount
 *   OUT → account = bank (credit side). bank.balance  -= amount  (expense OR transfer-source)
 *   Transfer (type=OUT, both sides are banks):
 *         account  = SOURCE bank  → SOURCE.balance -= amount
 *         category = DEST bank    → DEST.balance   += amount
 *
 * Therefore, for any given bank account (fa.name):
 *   Net contribution from each transaction row:
 *     +amount  if  type='IN'  AND LOWER(account) = bankName
 *     -amount  if  type='OUT' AND LOWER(account) = bankName  (expense OR transfer-source)
 *     +amount  if  type='OUT' AND LOWER(category) = bankName (transfer-destination)
 *
 * This is a single CASE expression — no double-counting possible.
 */
export async function POST() {
    try {
        const user = await authorize(['OWNER', 'FINANCE']);
        const { tenantId } = user;

        // ── 1. Compute the correct balance for every financial account in one query ──
        const balanceRows = await prisma.$queryRaw<{ account_id: string; net_balance: number }[]>`
            SELECT
                fa.id                            AS account_id,
                COALESCE(SUM(
                    CASE
                        -- Money ENTERS this bank (IN, bank is debit/account side)
                        WHEN LOWER(t.account) = LOWER(fa.name) AND t.type = 'IN'
                            THEN  t.amount

                        -- Money LEAVES this bank (OUT, bank is credit/account side)
                        -- Covers both expense payments AND transfer-out
                        WHEN LOWER(t.account) = LOWER(fa.name) AND t.type = 'OUT'
                            THEN -t.amount

                        -- Transfer ARRIVES at this bank (OUT, bank is category/destination side)
                        WHEN LOWER(t.category) = LOWER(fa.name) AND t.type = 'OUT'
                            THEN  t.amount

                        ELSE 0
                    END
                ), 0)                            AS net_balance
            FROM financial_accounts fa
            LEFT JOIN transactions t
                ON  t.tenant_id = ${tenantId}
                AND fa.tenant_id = ${tenantId}
                AND (
                    LOWER(t.account)  = LOWER(fa.name) OR
                    LOWER(t.category) = LOWER(fa.name)
                )
            WHERE fa.tenant_id = ${tenantId}
            GROUP BY fa.id
        `;

        if (balanceRows.length === 0) {
            return NextResponse.json({ success: true, updated: 0, message: 'No financial accounts found.' });
        }

        // ── 2. Atomically write the corrected balances back to the database ──
        let updated = 0;
        await prisma.$transaction(
            async (tx) => {
                for (const row of balanceRows) {
                    const newBalance = Number(row.net_balance);
                    await (tx as any).financialAccount.update({
                        where: { id: row.account_id },
                        data:  { balance: newBalance }
                    });
                    updated++;
                }
            },
            { timeout: 30_000 }
        );

        return NextResponse.json({
            success: true,
            updated,
            message: `Rekalibrasi selesai: ${updated} akun berhasil diselaraskan dengan jurnal transaksi.`
        });

    } catch (error: any) {
        console.error('[RECALCULATE] Error:', error);
        return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 });
    }
}
