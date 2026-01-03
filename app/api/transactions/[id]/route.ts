
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authorize } from '@/lib/auth';

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    // Owner and Finance can edit
    await authorize(['OWNER', 'FINANCE']);
    const id = params.id;
    const body = await request.json();

    // Basic validation
    if (!body.amount || !body.account) {
        return NextResponse.json({ error: 'Invalid data' }, { status: 400 });
    }

    // Fix Data Integrity: Lookup Account ID based on name
    let accountId = null;
    if (body.account) {
        const acc = await prisma.financialAccount.findFirst({
            where: {
                name: {
                    equals: body.account,
                    mode: 'insensitive'
                }
            }
        });
        if (acc) {
            accountId = acc.id;
        }
    }

    // Update transaction using Prisma
    const updated = await prisma.transaction.update({
        where: { id },
        data: {
            date: new Date(body.date),
            amount: body.amount,
            type: body.type,
            category: body.category || null,
            description: body.description,
            account: body.account,
            accountId: accountId, // Ensure relation is updated
            businessUnitId: body.businessUnitId || null,
            imageUrl: body.imageUrl || null
        }
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Update Transaction Error:', error);
    return NextResponse.json({ error: 'Failed to update transaction' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    await authorize(['OWNER', 'FINANCE']);
    const id = params.id;

    await prisma.transaction.delete({
        where: { id }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete Transaction Error:', error);
    return NextResponse.json({ error: 'Failed to delete transaction' }, { status: 500 });
  }
}
