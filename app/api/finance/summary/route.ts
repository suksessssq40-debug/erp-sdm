import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authorize } from '@/lib/auth';
import { Prisma } from '@prisma/client';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const user = await authorize(['OWNER', 'FINANCE', 'MANAGER']);
        const { tenantId } = user;

        const { searchParams } = new URL(request.url);
        const businessUnitId = searchParams.get('businessUnitId');
        const startDate = searchParams.get('startDate');    // NEW: date-range filter for card balances
        const endDate = searchParams.get('endDate');        // NEW: date-range filter for card balances
        const hasUnitFilter = businessUnitId && businessUnitId !== 'ALL';

        // ─────────────────────────────────────────────────────────────────────
        // 1. Fetch all active Financial Accounts (Bank / Kas) for this tenant
        // ─────────────────────────────────────────────────────────────────────
        const financialAccounts = await prisma.financialAccount.findMany({
            where: { tenantId, isActive: true }
        });
        const bankNames = financialAccounts.map(fa => fa.name.toLowerCase());

        // ─────────────────────────────────────────────────────────────────────
        // 2. Build date filter for balance cards
        //    If a date range is supplied, we compute balances UP-TO the end date.
        //    (Typical ledger logic: balance = everything created on or before endDate)
        //    If no date supplied, the cards show the all-time running balance.
        // ─────────────────────────────────────────────────────────────────────
        let balanceDateFilter: Prisma.TransactionWhereInput = {};
        if (endDate) {
            const endOfDay = new Date(endDate);
            endOfDay.setUTCHours(23, 59, 59, 999);
            balanceDateFilter = { date: { lte: endOfDay } };
        }

        // ─────────────────────────────────────────────────────────────────────
        // 3. Compute running balance per account using raw SQL for performance.
        //
        //    Convention in the transactions table (from POST route):
        //      IN  → `account` = bank name, `category` = revenue/expense label
        //            Effect: bank.balance += amount
        //      OUT → `account` = bank name (swapped on write), `category` = expense label
        //            Effect: bank.balance -= amount
        //      Transfer (IN/OUT both banks) → stored as OUT
        //            `account` = source bank (credit side), `category` = dest bank (debit side)
        //            Effect: source.balance -= amount, dest.balance += amount
        //
        //    So to compute balance for a given bank:
        //      +amount for every row where LOWER(account) = bankName AND type = 'IN'
        //      +amount for every row where LOWER(category) = bankName AND type = 'OUT'  (transfer dest)
        //      -amount for every row where LOWER(account) = bankName AND type = 'OUT'   (expense / transfer source)
        //      (We don't need to subtract "category=bank AND type=IN" because that case doesn't occur
        //       by our write convention — when a bank is on the credit side of an IN, it's the source
        //       of a transfer which is stored as OUT)
        // ─────────────────────────────────────────────────────────────────────

        // Build the raw SQL unit filter fragment
        const unitSql = hasUnitFilter
            ? Prisma.sql`AND t.business_unit_id = ${businessUnitId}`
            : Prisma.empty;

        // Build date ceiling
        const dateSql = endDate
            ? Prisma.sql`AND t.date <= ${new Date(endDate + 'T23:59:59.999Z')}`
            : Prisma.empty;

        // Single pass: compute net balance per bank account in one query
        const balanceRows = await prisma.$queryRaw<{ account_name: string; net_balance: number }[]>`
            SELECT 
                fa.name                                                     AS account_name,
                COALESCE(SUM(
                    CASE
                        -- Money enters this bank (IN where account = this bank)
                        WHEN LOWER(t.account) = LOWER(fa.name) AND t.type = 'IN'  THEN  t.amount
                        -- Money leaves this bank (OUT where account = this bank — expense or transfer-source)
                        WHEN LOWER(t.account) = LOWER(fa.name) AND t.type = 'OUT' THEN -t.amount
                        -- Transfer destination: OUT where category = this bank (money arrives here)
                        WHEN LOWER(t.category) = LOWER(fa.name) AND t.type = 'OUT' THEN  t.amount
                        ELSE 0
                    END
                ), 0)                                                        AS net_balance
            FROM financial_accounts fa
            LEFT JOIN transactions t
                ON  t.tenant_id = ${tenantId}
                AND fa.tenant_id = ${tenantId}
                AND (
                    LOWER(t.account)   = LOWER(fa.name) OR
                    LOWER(t.category)  = LOWER(fa.name)
                )
                ${unitSql}
                ${dateSql}
            WHERE fa.tenant_id = ${tenantId}
              AND fa.is_active  = true
            GROUP BY fa.name
        `;

        // Build the accountBalances map
        const accountBalances: Record<string, number> = {};
        financialAccounts.forEach(fa => { accountBalances[fa.name] = 0; });
        balanceRows.forEach(r => {
            accountBalances[r.account_name] = Number(r.net_balance);
        });

        const totalAssets = Object.values(accountBalances).reduce((a, b) => a + b, 0);

        // ─────────────────────────────────────────────────────────────────────
        // 4. P&L Stats — scoped to the requested date range (or current month if none)
        //    Only count REAL income & expense, excluding inter-bank transfers.
        // ─────────────────────────────────────────────────────────────────────
        const now = new Date();
        const plStart = startDate ? new Date(startDate) : new Date(now.getFullYear(), now.getMonth(), 1);
        const plEnd = endDate
            ? new Date(endDate + 'T23:59:59.999Z')
            : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

        const plBaseWhere: Prisma.TransactionWhereInput = {
            tenantId,
            status: 'PAID',
            date: { gte: plStart, lte: plEnd },
            ...(hasUnitFilter ? { businessUnitId } : {})
        };

        // Real income: type=IN where the category (credit side) is NOT another bank
        // (a bank-to-bank transfer stored as IN would have a bank category, but by our
        //  write convention, transfers are always stored as OUT — so this guard is a safety net)
        const [incomeAgg, expenseAgg] = await Promise.all([
            prisma.transaction.aggregate({
                where: {
                    ...plBaseWhere,
                    type: 'IN',
                    NOT: { category: { in: bankNames } }  // exclude any accidental bank-on-credit-IN
                },
                _sum: { amount: true }
            }),
            prisma.transaction.aggregate({
                where: {
                    ...plBaseWhere,
                    type: 'OUT',
                    // Exclude transfers: rows where BOTH account AND category are bank names
                    NOT: { category: { in: bankNames } }  // if category is a bank → it's a transfer, skip
                },
                _sum: { amount: true }
            })
        ]);

        const income = Number(incomeAgg._sum.amount || 0);
        const expense = Number(expenseAgg._sum.amount || 0);

        return NextResponse.json({
            accountBalances,
            totalAssets,
            monthStats: {
                income,
                expense,
                profit: income - expense
            }
        });

    } catch (error) {
        console.error('Finance Summary Error:', error);
        return NextResponse.json({ error: 'Failed to fetch summary' }, { status: 500 });
    }
}
