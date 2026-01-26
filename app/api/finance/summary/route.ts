
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authorize } from '@/lib/auth';
import { Prisma } from '@prisma/client';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const user = await authorize(['OWNER', 'FINANCE', 'MANAGER']);
    const { tenantId } = user; // 🛡️ SECURITY: Dapatkan Tenant ID dari Token (Server-Side)

    const { searchParams } = new URL(request.url);
    const businessUnitId = searchParams.get('businessUnitId');
    const hasUnitFilter = businessUnitId && businessUnitId !== 'ALL';

    // 1. Calculate Balance per Account (Menggunakan Prisma Raw Query untuk Agregasi Kompleks)
    // 🛡️ SECURITY: Filter tenant_id ditambahkan secara eksplisit
    // Menggunakan Prisma.sql untuk mencegah SQL Injection pada parameter optional
    const balanceRes = await prisma.$queryRaw<any[]>`
        SELECT 
           COALESCE(fa.name, t.account) as account_name,
           SUM(CASE WHEN t.type = 'IN' THEN t.amount ELSE -t.amount END) as balance
        FROM transactions t
        LEFT JOIN financial_accounts fa ON t.account_id = fa.id
        WHERE t.tenant_id = ${tenantId}
        ${hasUnitFilter ? Prisma.sql`AND t.business_unit_id = ${businessUnitId}` : Prisma.empty}
        GROUP BY COALESCE(fa.name, t.account)
    `;

    // 2. Calculate This Month's P&L (Menggunakan Prisma Query Builder - Lebih Rapi)
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    
    // Build Filter
    const plWhere: Prisma.TransactionWhereInput = {
        tenantId: tenantId, // 🛡️ SECURITY: Wajib filter tenant
        date: {
            gte: startOfMonth,
            lte: endOfMonth
        }
    };
    if (hasUnitFilter) plWhere.businessUnitId = businessUnitId;

    // Aggregate Income & Expense
    const [incomeAgg, expenseAgg] = await Promise.all([
        prisma.transaction.aggregate({
            where: { ...plWhere, type: 'IN' },
            _sum: { amount: true }
        }),
        prisma.transaction.aggregate({
            where: { ...plWhere, type: 'OUT' },
            _sum: { amount: true }
        })
    ]);

    const income = Number(incomeAgg._sum.amount || 0);
    const expense = Number(expenseAgg._sum.amount || 0);

    // Format Result
    const accountBalances: Record<string, number> = {};
    let totalAssets = 0;

    balanceRes.forEach((r: any) => {
        // Prisma Raw returns BigInt/Decimal as object/string sometimes, ensure Number
        const bal = Number(r.balance || 0);
        const accName = r.account_name; 
        if (accName) {
            accountBalances[accName] = bal;
            totalAssets += bal;
        }
    });

    return NextResponse.json({
        accountBalances,
        totalAssets,
        monthStats: {
            income,
            expense,
            profit: income - expense
        }
    });

  } catch (error) {
    console.error("Finance Summary Error:", error);
    return NextResponse.json({ error: 'Failed to fetch summary' }, { status: 500 });
  }
}
