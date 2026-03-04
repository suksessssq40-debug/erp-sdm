import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authorize } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    const user = await authorize(['OWNER', 'FINANCE', 'MANAGER', 'STAFF']);
    const { tenantId } = user;

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    const accountName = searchParams.get('accountName');
    const businessUnitId = searchParams.get('businessUnitId');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const skip = (page - 1) * limit;

    const whereClause: any = { tenantId };
    if (startDate) whereClause.date = { gte: new Date(startDate) };
    if (endDate) {
      whereClause.date = {
        ...whereClause.date,
        lte: new Date(endDate)
      };
    }
    if (status && status !== 'ALL') {
      whereClause.status = status;
    }
    if (businessUnitId && businessUnitId !== 'ALL') {
      whereClause.businessUnitId = businessUnitId;
    }
    if (accountName && accountName !== 'ALL') {
      if (accountName === 'GENERAL_JOURNAL') {
        whereClause.accountId = null;
      } else {
        whereClause.account = { equals: accountName, mode: 'insensitive' };
      }
    }
    if (search) {
      whereClause.OR = [
        { description: { contains: search, mode: 'insensitive' } },
        { category: { contains: search, mode: 'insensitive' } },
        { contactName: { contains: search, mode: 'insensitive' } },
        { account: { contains: search, mode: 'insensitive' } }
      ];
    }

    const [transactions, totalCount] = await Promise.all([
      prisma.transaction.findMany({
        where: whereClause,
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        skip,
        take: limit,
        include: { coa: true } as any
      }),
      prisma.transaction.count({ where: whereClause })
    ]);

    const safeTransactions = transactions.map((t: any) => ({
      ...t,
      amount: Number(t.amount || 0),
      // Ensure category matches the COA if possible for display consistency
      category: t.coa ? `${t.coa.code} - ${t.coa.name}` : (t.category || t.account),
      coa: t.coa ? {
        ...t.coa,
        createdAt: t.coa.createdAt ? t.coa.createdAt.toString() : null
      } : null
    }));

    return NextResponse.json({
      data: safeTransactions,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit)
      }
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await authorize(['OWNER', 'FINANCE']);
    const { tenantId } = user;
    const body = await request.json();

    const {
      date, amount, description, account, category, coaId: providedCoaId,
      isNonCash, businessUnitId, imageUrl
    } = body;

    const providedType = body.type || 'IN';

    // 1. Resolve sides based on provided type for Cash vs General
    // For Cash mode, 'account' typically carries the Bank name (for compatibility)
    let debitSideName = account;
    let creditSideName = category;

    if (!isNonCash && providedType === 'OUT') {
      // Swap for 'OUT' so 'account' (Bank) is correctly identified as the Credit side
      debitSideName = category;
      creditSideName = account;
    }

    const [coaDebit, coaCredit] = await Promise.all([
      prisma.chartOfAccount.findFirst({ where: { tenantId, OR: [{ name: debitSideName }, { code: debitSideName.split(' - ')[0] }] } }),
      prisma.chartOfAccount.findFirst({ where: { tenantId, OR: [{ name: creditSideName }, { code: creditSideName.split(' - ')[0] }] } })
    ]);

    const result = await prisma.$transaction(async (tx) => {
      let finalType = providedType;
      let financialAccountId = null;
      let finalCoaId = providedCoaId;

      // Logic: CASH/BANK (Involves a real bank account)
      if (!isNonCash) {
        // In CASH mode, 'account' field in request always identifies the Bank for SDM ERP
        const bankAcc = await tx.financialAccount.findFirst({ where: { tenantId, name: account } });
        if (!bankAcc) throw new Error(`Akun Bank/Kas '${account}' tidak ditemukan.`);

        financialAccountId = bankAcc.id;
        finalType = providedType;
        // Link coaId to the side that ISN'T the bank
        finalCoaId = providedType === 'IN' ? coaCredit?.id : coaDebit?.id;
      }
      // Logic: GENERAL JOURNAL (Between COAs)
      else {
        // Determine type based on P&L impact (Expense on Debit = OUT, Revenue on Credit = IN)
        if (coaDebit?.type === 'EXPENSE') finalType = 'OUT';
        else if (coaCredit?.type === 'REVENUE' || coaCredit?.type === 'INCOME') finalType = 'IN';

        finalCoaId = (coaCredit?.type === 'REVENUE' || coaCredit?.type === 'EXPENSE')
          ? coaCredit.id
          : coaDebit?.id || coaCredit?.id || null;
      }

      const transactionId = `TRX_${Date.now()}_${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

      const newTransaction = await (tx as any).transaction.create({
        data: {
          id: transactionId,
          tenantId,
          date: new Date(date),
          amount: parseFloat(amount),
          type: finalType,
          account: debitSideName,
          category: creditSideName,
          description,
          accountId: financialAccountId,
          coaId: finalCoaId,
          businessUnitId,
          imageUrl,
          status: 'PAID'
        }
      });

      // Atomic Balance Update
      if (financialAccountId) {
        const change = finalType === 'IN' ? parseFloat(amount) : -parseFloat(amount);
        await (tx as any).financialAccount.update({
          where: { id: financialAccountId },
          data: { balance: { increment: change } }
        });
      }

      return newTransaction;
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error: any) {
    console.error('TRX_CREATE_ERROR:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
