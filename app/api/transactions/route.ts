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

    // Fetch transactions with pagination
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

    // Map to safe format (Date to String)
    const safeTransactions = transactions.map((t: any) => ({
      id: t.id,
      date: t.date ? t.date.toISOString().split('T')[0] : '',
      amount: Number(t.amount),
      type: t.type,
      category: t.coa ? `${t.coa.code} - ${t.coa.name}` : t.category,
      description: t.description,
      account: t.account,
      businessUnitId: t.businessUnitId,
      imageUrl: t.imageUrl,
      tenantId: t.tenantId,
      coaId: t.coaId,
      coa: t.coa ? {
        ...t.coa,
        createdAt: t.coa.createdAt ? t.coa.createdAt.toString() : null
      } : null,
      contactName: t.contactName,
      status: t.status,
      dueDate: t.dueDate ? t.dueDate.toISOString().split('T')[0] : null
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
    const t = await request.json();

    // 1. Link Account by Name (Lookup ID) - MUST BE WITHIN SAME TENANT
    let accountId: string | null = null;
    let finalAccountName = t.account;

    if (t.account) {
      let acc = await prisma.financialAccount.findFirst({
        where: {
          tenantId,
          name: { equals: t.account, mode: 'insensitive' }
        }
      });

      // AUTO-CREATE IF NOT EXISTS
      if (!acc) {
        console.log(`Auto-creating missing account: ${t.account}`);
        acc = await prisma.financialAccount.create({
          data: {
            id: Math.random().toString(36).substr(2, 9),
            tenantId,
            name: t.account,
            bankName: 'General / Tunai',
            accountNumber: '-',
            description: 'Dibuat otomatis dari input transaksi',
            balance: 0,
            isActive: true
          }
        });
      }

      if (acc) {
        accountId = acc.id;
        finalAccountName = acc.name;
      }
    }

    // 2. Link or Auto-Create COA by Name
    let coaId: string | null = t.coaId || null;
    let finalCategory = t.category;

    if (!coaId && t.category) {
      // Try to find by code or name
      let code = '';
      let name = t.category;
      if (t.category.includes(' - ')) {
        [code, name] = t.category.split(' - ').map((s: string) => s.trim());
      }

      let existingCoa = await prisma.chartOfAccount.findFirst({
        where: {
          tenantId,
          OR: [
            { name: { equals: name, mode: 'insensitive' } },
            code ? { code: { equals: code, mode: 'insensitive' } } : undefined
          ].filter(Boolean) as any
        }
      });

      if (!existingCoa) {
        console.log(`Auto-creating missing COA: ${t.category}`);
        existingCoa = await prisma.chartOfAccount.create({
          data: {
            id: Math.random().toString(36).substr(2, 9),
            tenantId,
            code: code || ('999' + Math.floor(Math.random() * 999)),
            name: name,
            type: (t.type === 'OUT' ? 'EXPENSE' : 'INCOME'),
            isActive: true
          }
        });
      }

      if (existingCoa) {
        coaId = existingCoa.id;
        finalCategory = `${existingCoa.code} - ${existingCoa.name}`;
      }
    }

    // 3. CREATE WITH ATOMIC BALANCE UPDATE
    await prisma.$transaction(async (tx) => {
      // A. Create Transaction
      await tx.transaction.create({
        data: {
          id: t.id || Math.random().toString(36).substr(2, 9),
          tenantId,
          date: new Date(t.date),
          amount: t.amount,
          type: t.type,
          category: finalCategory,
          description: t.description,
          account: finalAccountName,
          accountId: accountId,
          businessUnitId: t.businessUnitId || null,
          imageUrl: t.imageUrl || null,
          coaId: coaId,
          contactName: t.contactName || null,
          status: t.status || 'PAID',
          dueDate: t.dueDate ? new Date(t.dueDate) : null
        } as any
      });

      // B. Update Financial Account Balance (ALWAYS for all statuses including UNPAID/DP)
      if (accountId) {
        const amount = Number(t.amount);
        const change = t.type === 'IN' ? amount : -amount;

        await (tx.financialAccount as any).update({
          where: { id: accountId, tenantId },
          data: { balance: { increment: change } }
        });
      }
    });

    return NextResponse.json({ ...t, account: finalAccountName, accountId, category: finalCategory, coaId }, { status: 201 });
  } catch (error: any) {
    console.error('Create Transaction Error:', error);
    return NextResponse.json({ error: 'Failed to create transaction', details: error.message }, { status: 500 });
  }
}
