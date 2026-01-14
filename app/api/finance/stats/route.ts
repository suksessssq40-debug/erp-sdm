import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authorize } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const user = await authorize(['OWNER', 'FINANCE']);
    const { tenantId } = user;

    // Special Rule: Arus Kas only for SDM
    if (tenantId !== 'sdm') {
      return NextResponse.json({
          totalBalance: 0,
          monthlyIn: 0,
          monthlyOut: 0,
          dailyTrend: []
      });
    }

    // 1. Calculate Total Balance (Resilient) - Filter by Tenant
    let totalBalance = 0;
    try {
        const accounts = await (prisma.financialAccount as any).findMany({
          where: { tenantId, isActive: true },
          select: { balance: true }
        });
        totalBalance = accounts.reduce((sum: number, acc: any) => sum + Number(acc.balance || 0), 0);
    } catch (e) {
        const totalIn = await prisma.transaction.aggregate({ 
            _sum: { amount: true }, 
            where: { tenantId, type: 'IN', status: 'PAID' } 
        });
        const totalOut = await prisma.transaction.aggregate({ 
            _sum: { amount: true }, 
            where: { tenantId, type: 'OUT', status: 'PAID' } 
        });
        totalBalance = (Number(totalIn?._sum?.amount) || 0) - (Number(totalOut?._sum?.amount) || 0);
    }

    // 2. Monthly Stats
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    const monthlyIn = await prisma.transaction.aggregate({
        _sum: { amount: true },
        where: { tenantId, type: 'IN', status: 'PAID', date: { gte: startOfMonth } } as any
    });

    const monthlyOut = await prisma.transaction.aggregate({
        _sum: { amount: true },
        where: { tenantId, type: 'OUT', status: 'PAID', date: { gte: startOfMonth } } as any
    });

    // 3. Daily Trend (Last 30 Days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(now.getDate() - 30);

    const trendTransactions = await prisma.transaction.findMany({
        where: {
            tenantId,
            status: 'PAID',
            date: { gte: thirtyDaysAgo }
        } as any,
        select: {
            date: true,
            amount: true,
            type: true
        },
        orderBy: { date: 'asc' }
    });

    // Group by date
    const trendMap: Record<string, { date: string, income: number, expense: number }> = {};
    for (let i = 0; i <= 30; i++) {
        const d = new Date();
        d.setDate(now.getDate() - (30 - i));
        const dateStr = d.toISOString().split('T')[0];
        trendMap[dateStr] = { date: dateStr, income: 0, expense: 0 };
    }

    trendTransactions.forEach(t => {
        if (!t.date) return;
        const dateStr = new Date(t.date).toISOString().split('T')[0];
        if (trendMap[dateStr]) {
            if (t.type === 'IN') trendMap[dateStr].income += Number(t.amount);
            else trendMap[dateStr].expense += Number(t.amount);
        }
    });

    const dailyTrend = Object.values(trendMap);

    return NextResponse.json({
        totalBalance,
        monthlyIn: Number(monthlyIn._sum.amount) || 0,
        monthlyOut: Number(monthlyOut._sum.amount) || 0,
        dailyTrend
    });

  } catch (error) {
    console.error('Error fetching finance stats:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
