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
        whereClause.OR = [
          { account: { equals: accountName, mode: 'insensitive' } },
          { category: { equals: accountName, mode: 'insensitive' } }
        ];
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
      date, amount, description, account, category,
      businessUnitId, imageUrl, contactName
    } = body;

    const valAmount = parseFloat(amount || 0);
    const debitName = account;
    const creditName = category;

    // 1. Audit both sides to identify Banks vs COAs
    const [bankDebit, bankCredit, coaDebit, coaCredit] = await Promise.all([
      prisma.financialAccount.findFirst({
        where: {
          tenantId,
          name: { equals: debitName, mode: 'insensitive' },
          isActive: true
        }
      }),
      prisma.financialAccount.findFirst({
        where: {
          tenantId,
          name: { equals: creditName, mode: 'insensitive' },
          isActive: true
        }
      }),
      prisma.chartOfAccount.findFirst({
        where: {
          tenantId,
          OR: [
            { name: { equals: debitName, mode: 'insensitive' } },
            { code: { equals: debitName.split(' - ')[0], mode: 'insensitive' } }
          ]
        }
      }),
      prisma.chartOfAccount.findFirst({
        where: {
          tenantId,
          OR: [
            { name: { equals: creditName, mode: 'insensitive' } },
            { code: { equals: creditName.split(' - ')[0], mode: 'insensitive' } }
          ]
        }
      })
    ]);

    const result = await prisma.$transaction(async (tx) => {
      let finalType: 'IN' | 'OUT' = 'IN';
      let financialAccountId = null;
      let finalAccountLabel = debitName;
      let finalCategoryLabel = creditName;

      // RULE 1: If it's a Cash Transaction (Bank is involved)
      // To maintain compatibility with the UI's swapping logic:
      // We ALWAYS store the Bank Name in the 'account' field for cash transactions.
      if (bankDebit || bankCredit) {
        const bank = bankDebit || bankCredit;
        financialAccountId = bank?.id;

        if (bankDebit && !bankCredit) {
          finalType = 'IN'; // Money entering bank (Bank is Debit)
          finalAccountLabel = bankDebit.name;
          finalCategoryLabel = creditName;
        } else if (bankCredit && !bankDebit) {
          finalType = 'OUT'; // Money leaving bank (Bank is Credit)
          finalAccountLabel = bankCredit.name;
          finalCategoryLabel = debitName;
        } else if (bankDebit && bankCredit) {
          // Internal Transfer
          finalType = 'OUT'; // We treat it as OUT from the 'Credit' side bank
          finalAccountLabel = bankCredit.name;
          finalCategoryLabel = bankDebit.name;
        }
      }
      // RULE 2: General Journal (No Bank)
      else {
        // Determine type based on P&L impact for Reporting
        if (coaDebit?.type === 'EXPENSE') finalType = 'OUT';
        else if (coaCredit?.type === 'REVENUE' || coaCredit?.type === 'INCOME') finalType = 'IN';

        // For General Journal, we use IN to avoid UI swapping, and keep labels as is
        // Wait, if I use 'IN', UI shows Debit=Account, Credit=Category. Correct.
        finalType = 'IN';
        finalAccountLabel = debitName;
        finalCategoryLabel = creditName;
      }

      // Linking coaId (mostly for P&L reporting)
      // Prioritize P&L side (Revenue/Expense)
      const finalCoaId = (coaCredit?.type === 'REVENUE' || coaCredit?.type === 'EXPENSE')
        ? coaCredit.id
        : (coaDebit?.type === 'REVENUE' || coaDebit?.type === 'EXPENSE')
          ? coaDebit.id
          : coaCredit?.id || coaDebit?.id || null;

      const transactionId = `TRX_${Date.now()}_${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

      const newTransaction = await (tx as any).transaction.create({
        data: {
          id: transactionId,
          tenantId,
          date: new Date(date),
          amount: valAmount,
          type: finalType,
          account: finalAccountLabel,
          category: finalCategoryLabel,
          description,
          accountId: financialAccountId,
          coaId: finalCoaId,
          businessUnitId,
          imageUrl,
          contactName,
          status: 'PAID'
        }
      });

      // Atomic Balance Updates
      if (bankDebit) {
        await (tx as any).financialAccount.update({
          where: { id: bankDebit.id },
          data: { balance: { increment: valAmount } }
        });
      }
      if (bankCredit) {
        await (tx as any).financialAccount.update({
          where: { id: bankCredit.id },
          data: { balance: { decrement: valAmount } }
        });
      }

      return newTransaction;
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error: any) {
    console.error('UNIVERSAL_TRX_ERROR:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
