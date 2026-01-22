
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authorize } from '@/lib/auth';

export async function POST() {
  try {
    const user = await authorize(['OWNER', 'FINANCE']);
    const { tenantId } = user;

    // 1. Ambil Semua Akun
    const accounts = await prisma.financialAccount.findMany({
      where: { tenantId }
    });

    // 2. Lakukan Rekalkulasi Per Akun (Auto-Healing)
    await prisma.$transaction(async (tx) => {
        for (const acc of accounts) {
            // Hitung semua transaksi terkait akun ini (Semua Status - Operational Basis)
            const sumRes = await tx.transaction.aggregate({
                where: { 
                    tenantId,
                    accountId: acc.id
                },
                _sum: { amount: true }
            });

            // Pisahkan IN dan OUT untuk akurasi maksimal
            const income = await tx.transaction.aggregate({
                where: { tenantId, accountId: acc.id, type: 'IN' },
                _sum: { amount: true }
            });
            const expense = await tx.transaction.aggregate({
                where: { tenantId, accountId: acc.id, type: 'OUT' },
                _sum: { amount: true }
            });

            const newBalance = Number(income._sum.amount || 0) - Number(expense._sum.amount || 0);

            // Update Saldo Akun dengan Angka Murni dari Jurnal
            await (tx as any).financialAccount.update({
                where: { id: acc.id },
                data: { balance: newBalance }
            });
            
            console.log(`[RECALCULATE] Account ${acc.name} synced to: ${newBalance}`);
        }
    });

    return NextResponse.json({ 
        success: true, 
        message: 'Auto-Healing Selesai: Semua saldo akun telah disinkronkan ulang dengan jurnal transaksi secara akurat.' 
    });

  } catch (error: any) {
    console.error('Recalculate Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
