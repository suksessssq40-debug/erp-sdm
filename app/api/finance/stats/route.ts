
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authorize } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    // Only Owner and Finance can see full stats
    await authorize(['OWNER', 'FINANCE']);

    // 1. Calculate Total Balance from FinancialAccount.balance (Accurate Real-time)
    // This is the CORRECT way - using pre-calculated balance from accounts
    const accounts = await (prisma.financialAccount as any).findMany({
      where: { isActive: true },
      select: { balance: true }
    });
    
    const totalBalance = accounts.reduce((sum: number, acc: any) => sum + Number(acc.balance || 0), 0);

    // 2. Calculate Monthly Cashflow (PAID transactions only - Cash Basis)
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    // Monthly IN - Only PAID status (real cash received)
    const monthlyIn = await prisma.transaction.aggregate({
        _sum: { amount: true },
        where: { 
            type: 'IN',
            status: 'PAID', // CRITICAL: Only count paid transactions
            date: { gte: startOfMonth }
        } as any
    });

    // Monthly OUT - Only PAID status (real cash spent)
    const monthlyOut = await prisma.transaction.aggregate({
        _sum: { amount: true },
        where: { 
            type: 'OUT',
            status: 'PAID', // CRITICAL: Only count paid transactions
            date: { gte: startOfMonth }
        } as any
    });

    return NextResponse.json({
        totalBalance: totalBalance,
        monthlyIn: Number(monthlyIn._sum.amount) || 0,
        monthlyOut: Number(monthlyOut._sum.amount) || 0
    });

  } catch (error) {
    console.error('Error fetching finance stats:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
