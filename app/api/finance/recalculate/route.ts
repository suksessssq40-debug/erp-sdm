
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authorize } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * UTILITY API: Recalculate all account balances based on transaction history.
 * Run this once after schema migration or if balances become desynced.
 */
export async function POST(request: Request) {
  try {
    // Highly restricted: Only Owner can trigger a full sync, BUT Finance needs it too for daily ops
    await authorize(['OWNER', 'FINANCE']);

    const accounts = await prisma.financialAccount.findMany();
    const results = [];

    for (const account of accounts) {
      // Calculate sum of ALL transactions for this specific account
      const stats = await prisma.transaction.aggregate({
        _sum: { amount: true },
        where: {
          accountId: account.id,
          type: 'IN'
        }
      });

      const outStats = await prisma.transaction.aggregate({
        _sum: { amount: true },
        where: {
          accountId: account.id,
          type: 'OUT'
        }
      });

      const totalIn = Number(stats._sum.amount || 0);
      const totalOut = Number(outStats._sum.amount || 0);
      const newBalance = totalIn - totalOut;

      // Update the account balance
      await (prisma.financialAccount as any).update({
        where: { id: account.id },
        data: { balance: newBalance }
      });

      results.push({
        account: account.name,
        totalIn,
        totalOut,
        newBalance
      });
    }

    return NextResponse.json({
      message: 'Financial account balances synchronized successfully',
      details: results
    });

  } catch (error) {
    console.error('Sync Error:', error);
    return NextResponse.json({ error: (error as any).message || 'Failed to sync balances' }, { status: 500 });
  }
}
