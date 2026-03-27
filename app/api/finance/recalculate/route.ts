
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

    // 2. Lakukan Rekalkulasi dengan Logic Akuntansi Double Entry Sejati
    // Gunakan timeout lebih lama karena proses ini melibatkan scan seluruh tabel transaksi
    await prisma.$transaction(async (tx) => {
      const debitBalances = await (tx as any).$queryRaw<any[]>`
            SELECT 
                fa.id as account_id,
                SUM(t.amount) as total_debit
            FROM transactions t
            JOIN financial_accounts fa ON 
                (LOWER(t.account) = LOWER(fa.name) AND t.type = 'IN') OR 
                (LOWER(t.category) = LOWER(fa.name) AND t.type = 'OUT')
            WHERE t.tenant_id = ${tenantId} AND fa.tenant_id = ${tenantId}
            GROUP BY fa.id
        `;

      const creditBalances = await (tx as any).$queryRaw<any[]>`
            SELECT 
                fa.id as account_id,
                SUM(t.amount) as total_credit
            FROM transactions t
            JOIN financial_accounts fa ON 
                (LOWER(t.account) = LOWER(fa.name) AND t.type = 'OUT') OR
                (LOWER(t.category) = LOWER(fa.name) AND t.type = 'IN')
            WHERE t.tenant_id = ${tenantId} AND fa.tenant_id = ${tenantId}
            GROUP BY fa.id
        `;

      const balanceMap = new Map<string, number>();
      accounts.forEach(a => balanceMap.set(a.id, 0));

      debitBalances.forEach((r: any) => {
        balanceMap.set(r.account_id, (balanceMap.get(r.account_id) || 0) + Number(r.total_debit || 0));
      });
      creditBalances.forEach((r: any) => {
        balanceMap.set(r.account_id, (balanceMap.get(r.account_id) || 0) - Number(r.total_credit || 0));
      });

      for (const acc of accounts) {
        const newBalance = balanceMap.get(acc.id) || 0;

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
