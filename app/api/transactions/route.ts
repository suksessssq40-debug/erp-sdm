import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authorize } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    await authorize(['OWNER', 'FINANCE', 'MANAGER', 'STAFF']);
    
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 1000;

    const whereClause: any = {};
    if (startDate) whereClause.date = { gte: new Date(startDate) };
    if (endDate) {
        whereClause.date = { 
            ...whereClause.date,
            lte: new Date(endDate) 
        };
    }

    // Update GET Query
    const transactions = await prisma.transaction.findMany({
        where: whereClause,
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        take: limit,
        include: { coa: true } as any // Cast to any to bypass stale types
    });
    
    // Map to safe format (Date to String)
    const safeTransactions = transactions.map((t: any) => ({
        id: t.id,
        date: t.date ? t.date.toISOString().split('T')[0] : '',
        amount: Number(t.amount),
        type: t.type,
        category: t.coa ? `${t.coa.code} - ${t.coa.name}` : t.category, // Hybrid Display
        description: t.description,
        account: t.account,
        businessUnitId: t.businessUnitId,
        imageUrl: t.imageUrl,
        // New Accrual Fields
        coaId: t.coaId,
        coa: t.coa ? {
            ...t.coa,
            createdAt: t.coa.createdAt ? t.coa.createdAt.toString() : null
        } : null, // Pass full object safely (BigInt to String)
        contactName: t.contactName,
        status: t.status,
        dueDate: t.dueDate ? t.dueDate.toISOString().split('T')[0] : null
    }));

    return NextResponse.json(safeTransactions);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await authorize(['OWNER', 'FINANCE']);
    const t = await request.json();

    // Link Account by Name (Lookup ID)
    let accountId: string | null = null;
    if (t.account) {
        const acc = await prisma.financialAccount.findFirst({
            where: { name: { equals: t.account, mode: 'insensitive' } }
        });
        if (acc) accountId = acc.id;
    }

    // CREATE WITH ATOMIC BALANCE UPDATE
    await prisma.$transaction(async (tx) => {
        // 1. Create Transaction
        await tx.transaction.create({
          data: {
            id: t.id,
            date: new Date(t.date),
            amount: t.amount,
            type: t.type,
            category: t.category || null,
            description: t.description,
            account: t.account,
            accountId: accountId,
            businessUnitId: t.businessUnitId || null,
            imageUrl: t.imageUrl || null,
            coaId: t.coaId || null,
            contactName: t.contactName || null,
            status: t.status || 'PAID',
            dueDate: t.dueDate ? new Date(t.dueDate) : null
          } as any
        });

        // 2. Update Financial Account Balance if PAID
        if ((t.status === 'PAID' || !t.status) && accountId) {
            const amount = Number(t.amount);
            const change = t.type === 'IN' ? amount : -amount;
            
            await (tx.financialAccount as any).update({
                where: { id: accountId },
                data: { balance: { increment: change } }
            });
        }
    });

    return NextResponse.json(t, { status: 201 });
  } catch (error) {
    console.error('Create Transaction Error:', error);
    return NextResponse.json({ error: 'Failed to create transaction' }, { status: 500 });
  }
}
