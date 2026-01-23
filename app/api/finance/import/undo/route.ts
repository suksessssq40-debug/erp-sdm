
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authorize } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const user = await authorize(['OWNER', 'FINANCE']);
    const { tenantId } = user;
    const { batchId } = await request.json();

    if (!batchId) return NextResponse.json({ error: 'Batch ID diperlukan.' }, { status: 400 });

    // 1. Cari semua transaksi dalam batch ini
    const batchTransactions = await prisma.transaction.findMany({
        where: {
            tenantId,
            id: { startsWith: `IMP_${batchId}` }
        }
    });

    if (batchTransactions.length === 0) {
        return NextResponse.json({ error: 'Batch tidak ditemukan atau sudah dihapus.' }, { status: 404 });
    }

    // 2. Optimized: Aggregate balance changes per account
    const accountChanges: Record<string, number> = {};
    
    for (const trx of batchTransactions) {
        if (trx.accountId && trx.amount) {
            const change = trx.type === 'IN' ? -Number(trx.amount) : Number(trx.amount);
            accountChanges[trx.accountId] = (accountChanges[trx.accountId] || 0) + change;
        }
    }

    // 3. Execute Updates in Transaction
    await prisma.$transaction(async (tx) => {
        // A. Update Balances (Bulk logic via loop, but much fewer queries)
        for (const [accId, change] of Object.entries(accountChanges)) {
             await (tx as any).financialAccount.update({
                where: { id: accId },
                data: { balance: { increment: change } }
            });
        }

        // B. Bulk Delete Transactions
        await (tx as any).transaction.deleteMany({
            where: {
                tenantId,
                id: { startsWith: `IMP_${batchId}` }
            }
        });
    });

    return NextResponse.json({ 
        success: true, 
        message: `Berhasil membatalkan (Undo) ${batchTransactions.length} transaksi dan memulihkan saldo.` 
    });

  } catch (error: any) {
    console.error('UNDO ERROR:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
