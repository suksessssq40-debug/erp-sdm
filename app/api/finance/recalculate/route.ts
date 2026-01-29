
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

    // 2. Lakukan Rekalkulasi (Optimasi: Grouped Aggregation)
    // Gunakan timeout lebih lama karena proses ini melibatkan scan seluruh tabel transaksi
    await prisma.$transaction(async (tx) => {
      // Ambil semua sum per accountId dalam satu query
      const groupedResults = await tx.transaction.groupBy({
        by: ['accountId', 'type'],
        where: { tenantId },
        _sum: { amount: true }
      });

      // Mapping hasil ke format Map [accountId]: { IN, OUT }
      const balanceMap = new Map<string, { IN: number; OUT: number }>();
      groupedResults.forEach(res => {
        if (!res.accountId) return;
        const current = balanceMap.get(res.accountId) || { IN: 0, OUT: 0 };
        if (res.type === 'IN') current.IN = Number(res._sum.amount || 0);
        else if (res.type === 'OUT') current.OUT = Number(res._sum.amount || 0);
        balanceMap.set(res.accountId, current);
      });

      for (const acc of accounts) {
        const totals = balanceMap.get(acc.id) || { IN: 0, OUT: 0 };
        const newBalance = totals.IN - totals.OUT;

        // Update Saldo Akun
        await (tx as any).financialAccount.update({
          where: { id: acc.id },
          data: { balance: newBalance }
        });

        console.log(`[RECALCULATE] Account ${acc.name} synced to: ${newBalance}`);
      }
    }, {
      timeout: 30000 // Tipe transaksi berat, beri waktu 30 detik
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
