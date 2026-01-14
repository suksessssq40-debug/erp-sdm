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
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 1000;

    const whereClause: any = { tenantId };
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
        include: { coa: true } as any 
    });
    
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

    return NextResponse.json(safeTransactions);
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

    // Link Account by Name (Lookup ID) - MUST BE WITHIN SAME TENANT
    let accountId: string | null = null;
    if (t.account) {
        const acc = await prisma.financialAccount.findFirst({
            where: { 
                tenantId,
                name: { equals: t.account, mode: 'insensitive' } 
            }
        });
        if (acc) accountId = acc.id;
    }

    // CREATE WITH ATOMIC BALANCE UPDATE
    await prisma.$transaction(async (tx) => {
        // 1. Create Transaction
        await tx.transaction.create({
          data: {
            id: t.id,
            tenantId,
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

        // 2. Update Financial Account Balance if PAID (Resilient)
        if ((t.status === 'PAID' || !t.status) && accountId) {
            try {
                const amount = Number(t.amount);
                const change = t.type === 'IN' ? amount : -amount;
                
                await (tx.financialAccount as any).update({
                    where: { id: accountId, tenantId }, // Security: Double check tenant
                    data: { balance: { increment: change } }
                });
            } catch (e) {
                console.warn('Sync Warning: Balance update skipped or failed.');
            }
        }
    });

    return NextResponse.json(t, { status: 201 });
  } catch (error: any) {
    console.error('Create Transaction Error:', error);
    return NextResponse.json({ error: 'Failed to create transaction', details: error.message }, { status: 500 });
  }
}
