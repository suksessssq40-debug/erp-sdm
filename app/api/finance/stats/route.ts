
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authorize } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    // Only Owner and Finance can see full stats
    await authorize(['OWNER', 'FINANCE']);

    // 1. Calculate Total Balance (Global)
    // Prisma Decimal to Number conversion is tricky, doing aggregate raw might be better or handled in JS if dataset not huge.
    // Ideally: SELECT SUM(CASE WHEN type='IN' THEN amount ELSE -amount END) as total FROM transactions
    
    // Using Prisma Aggregate
    const totalIn = await prisma.transaction.aggregate({
      _sum: { amount: true },
      where: { type: 'IN' }
    });
    
    const totalOut = await prisma.transaction.aggregate({
      _sum: { amount: true },
      where: { type: 'OUT' }
    });

    const balance = (Number(totalIn._sum.amount) || 0) - (Number(totalOut._sum.amount) || 0);

    // 2. Calculate Monthly Cashflow
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    // Prisma Date filtering
    const monthlyIn = await prisma.transaction.aggregate({
        _sum: { amount: true },
        where: { 
            type: 'IN',
            date: { gte: startOfMonth }
        }
    });

    const monthlyOut = await prisma.transaction.aggregate({
        _sum: { amount: true },
        where: { 
            type: 'OUT',
            date: { gte: startOfMonth }
        }
    });

    return NextResponse.json({
        totalBalance: balance,
        monthlyIn: Number(monthlyIn._sum.amount) || 0,
        monthlyOut: Number(monthlyOut._sum.amount) || 0
    });

  } catch (error) {
    console.error('Error fetching finance stats:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
