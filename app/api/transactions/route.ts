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

    const transactions = await prisma.transaction.findMany({
        where: whereClause,
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        take: limit
    });
    
    // Map to safe format (Date to String)
    const safeTransactions = transactions.map(t => ({
        id: t.id,
        date: t.date ? t.date.toISOString().split('T')[0] : '',
        amount: Number(t.amount),
        type: t.type,
        category: t.category,
        description: t.description,
        account: t.account,
        businessUnitId: t.businessUnitId,
        imageUrl: t.imageUrl
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
    let accountId = null;
    if (t.account) {
        // Try to find the account linkage
        const acc = await prisma.financialAccount.findFirst({
            where: {
                name: {
                  equals: t.account,
                  mode: 'insensitive' // Match case-insensitively
                }
            }
        });
        if (acc) {
            accountId = acc.id;
        }
    }

    await prisma.transaction.create({
      data: {
        id: t.id,
        date: new Date(t.date),
        amount: t.amount,
        type: t.type,
        category: t.category || null,
        description: t.description,
        account: t.account, // Still store legacy name for backup
        accountId: accountId, // NEW: Link to real table
        businessUnitId: t.businessUnitId || null,
        imageUrl: t.imageUrl || null
      }
    });

    return NextResponse.json(t, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
