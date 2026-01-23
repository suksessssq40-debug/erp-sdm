
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
    // Jangan gunakan satu transaksi besar untuk semua akun agar tidak timeout
    const results = [];
    
    for (const acc of accounts) {
        try {
            // Hitung saldo income & expense secara paralel
            const [incomeAgg, expenseAgg] = await Promise.all([
                prisma.transaction.aggregate({
                    where: { tenantId, accountId: acc.id, type: 'IN' },
                    _sum: { amount: true }
                }),
                prisma.transaction.aggregate({
                    where: { tenantId, accountId: acc.id, type: 'OUT' },
                    _sum: { amount: true }
                })
            ]);

            const newBalance = Number(incomeAgg._sum.amount || 0) - Number(expenseAgg._sum.amount || 0);

            // Update Saldo Akun
            await prisma.financialAccount.update({
                where: { id: acc.id },
                data: { balance: newBalance }
            });
            
            results.push({ account: acc.name, status: 'synced', balance: newBalance });
        } catch (err: any) {
            console.error(`Failed to sync account ${acc.name}:`, err);
            results.push({ account: acc.name, status: 'failed', error: err.message });
        }
    }

    return NextResponse.json({ 
        success: true, 
        message: 'Sinkronisasi saldo selesai.',
        details: results
    });

  } catch (error: any) {
    console.error('Recalculate Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
