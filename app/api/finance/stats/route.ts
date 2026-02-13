import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authorize } from '@/lib/auth';
import { serialize } from '@/lib/serverUtils';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const user = await authorize(['OWNER', 'FINANCE', 'MANAGER']);
        const { tenantId } = user;

        // 1. Calculate Total Balance
        const accounts = await prisma.financialAccount.findMany({
            where: { tenantId, isActive: true }
        });
        const totalBalance = accounts.reduce((sum: number, acc: any) => sum + Number(acc.balance || 0), 0);

        // 2. Monthly Stats
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        const [monthlyIn, monthlyOut] = await Promise.all([
            prisma.transaction.aggregate({
                _sum: { amount: true },
                where: {
                    tenantId,
                    type: 'IN',
                    status: 'PAID',
                    accountId: { not: null },
                    date: { gte: startOfMonth }
                } as any
            }),
            prisma.transaction.aggregate({
                _sum: { amount: true },
                where: {
                    tenantId,
                    type: 'OUT',
                    status: 'PAID',
                    accountId: { not: null },
                    date: { gte: startOfMonth }
                } as any
            })
        ]);

        // 3. Daily Trend (Last 30 Days in Jakarta Time)
        const trendMap: Record<string, { date: string, income: number, expense: number }> = {};
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(now.getDate() - 30);

        // Helper for Jakarta Date String
        const toJktDate = (d: Date) => {
            return new Intl.DateTimeFormat('en-CA', { // YYYY-MM-DD format
                timeZone: 'Asia/Jakarta',
                year: 'numeric',
                month: '2-digit',
                day: '2-digit'
            }).format(d);
        };

        for (let i = 0; i <= 30; i++) {
            const d = new Date();
            d.setDate(now.getDate() - (30 - i));
            const dateStr = toJktDate(d);
            trendMap[dateStr] = { date: dateStr, income: 0, expense: 0 };
        }

        const trendTransactions = await prisma.transaction.findMany({
            where: {
                tenantId,
                status: 'PAID',
                accountId: { not: null },
                date: { gte: thirtyDaysAgo }
            } as any,
            select: {
                date: true,
                amount: true,
                type: true
            },
            orderBy: { date: 'asc' }
        });

        trendTransactions.forEach(t => {
            if (!t.date) return;
            const dateStr = toJktDate(t.date);
            if (trendMap[dateStr]) {
                if (t.type === 'IN') trendMap[dateStr].income += Number(t.amount);
                else trendMap[dateStr].expense += Number(t.amount);
            }
        });

        return NextResponse.json(serialize({
            totalBalance,
            monthlyIn: Number(monthlyIn._sum.amount) || 0,
            monthlyOut: Number(monthlyOut._sum.amount) || 0,
            dailyTrend: Object.values(trendMap)
        }));

    } catch (error) {
        console.error('Error fetching finance stats:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

