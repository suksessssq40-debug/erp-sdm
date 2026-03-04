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
        const hasUnitFilter = businessUnitId && businessUnitId !== 'ALL';

        // 1. Calculate Balance per Financial Account (Bank/Kas)
        // We must sum up both sides where the account might appear
        const debitBalances = await prisma.$queryRaw<any[]>`
            SELECT 
                fa.name as account_name,
                SUM(t.amount) as total_debit
            FROM transactions t
            JOIN financial_accounts fa ON t.account = fa.name AND t.tenant_id = fa.tenant_id
            WHERE t.tenant_id = ${tenantId} AND t.type = 'IN'
            ${hasUnitFilter ? Prisma.sql`AND t.business_unit_id = ${businessUnitId}` : Prisma.empty}
            GROUP BY fa.name
        `;

        const creditBalances = await prisma.$queryRaw<any[]>`
            SELECT 
                fa.name as account_name,
                SUM(t.amount) as total_credit
            FROM transactions t
            JOIN financial_accounts fa ON t.category = fa.name AND t.tenant_id = fa.tenant_id
            WHERE t.tenant_id = ${tenantId} AND t.type = 'OUT'
            ${hasUnitFilter ? Prisma.sql`AND t.business_unit_id = ${businessUnitId}` : Prisma.empty}
            GROUP BY fa.name
        `;

        // 2. Calculate P&L Stats (Current Month)
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

        const plWhere: Prisma.TransactionWhereInput = {
            tenantId: tenantId,
            date: { gte: startOfMonth, lte: endOfMonth }
        };
        if (hasUnitFilter) plWhere.businessUnitId = businessUnitId;

        const [incomeAgg, expenseAgg] = await Promise.all([
            prisma.transaction.aggregate({
                where: { ...plWhere, type: 'IN' },
                _sum: { amount: true }
            }),
            prisma.transaction.aggregate({
                where: { ...plWhere, type: 'OUT' },
                _sum: { amount: true }
            })
        ]);

        const income = Number(incomeAgg._sum.amount || 0);
        const expense = Number(expenseAgg._sum.amount || 0);

        // Merge Balances
        const accountBalances: Record<string, number> = {};
        const financialAccounts = await prisma.financialAccount.findMany({ where: { tenantId, isActive: true } });
        financialAccounts.forEach(fa => { accountBalances[fa.name] = 0; });

        debitBalances.forEach(r => { accountBalances[r.account_name] = (accountBalances[r.account_name] || 0) + Number(r.total_debit); });
        creditBalances.forEach(r => { accountBalances[r.account_name] = (accountBalances[r.account_name] || 0) - Number(r.total_credit); });

        let totalAssets = Object.values(accountBalances).reduce((a, b) => a + b, 0);

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
        console.error("Finance Summary Error:", error);
        return NextResponse.json({ error: 'Failed to fetch summary' }, { status: 500 });
    }
}
