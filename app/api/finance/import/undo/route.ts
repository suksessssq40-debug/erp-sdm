
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

    // 2. Atomic Delete & Restore Balance
    await prisma.$transaction(async (tx) => {
        for (const trx of batchTransactions) {
            if (trx.accountId && trx.amount) {
                // Balikkan saldo: Jika aslinya IN (tambah), maka sekarang kita kurangi (decrement)
                // Jika aslinya OUT (kurang), maka sekarang kita tambah (increment)
                const restoreChange = trx.type === 'IN' ? -Number(trx.amount) : Number(trx.amount);
                
                await (tx as any).financialAccount.update({
                    where: { id: trx.accountId },
                    data: { balance: { increment: restoreChange } }
                });
            }
            
            // Hapus transaksi
            await (tx as any).transaction.delete({
                where: { id: trx.id }
            });
        }
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
