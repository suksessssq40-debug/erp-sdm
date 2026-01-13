
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
    let accountId: string | null = null;
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

    // Update transaction using Prisma $transaction for data integrity
    const updated = await prisma.$transaction(async (tx) => {
        const old = await tx.transaction.findUnique({ where: { id } });
        if (!old) throw new Error('Transaction not found');

        // 1. Undo Old Impact (if it was paid)
        if (old.status === 'PAID' && old.accountId) {
            try {
                const oldAmount = Number(old.amount);
                const undoChange = old.type === 'IN' ? -oldAmount : oldAmount;
                await (tx.financialAccount as any).update({
                    where: { id: old.accountId },
                    data: { balance: { increment: undoChange } }
                });
            } catch (e) { /* ignore missing column */ }
        }

        // 2. Perform Update
        const up = await tx.transaction.update({
            where: { id },
            data: {
                date: new Date(body.date),
                amount: body.amount,
                type: body.type,
                category: body.category || null,
                description: body.description,
                account: body.account,
                accountId: accountId,
                businessUnitId: body.businessUnitId || null,
                imageUrl: body.imageUrl || null,
                coaId: body.coaId || null,
                contactName: body.contactName || null,
                status: body.status || 'PAID',
                dueDate: body.dueDate ? new Date(body.dueDate) : null
            } as any
        });

        // 3. Apply New Impact (if it is now paid)
        if (body.status === 'PAID' && accountId) {
            try {
                const newAmount = Number(body.amount);
                const applyChange = body.type === 'IN' ? newAmount : -newAmount;
                await (tx.financialAccount as any).update({
                    where: { id: accountId },
                    data: { balance: { increment: applyChange } }
                });
            } catch (e) { /* ignore missing column */ }
        }

        return up;
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Update Transaction Error:', error);
    return NextResponse.json({ error: (error as any).message || 'Failed to update transaction' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    await authorize(['OWNER', 'FINANCE']);
    const id = params.id;

    await prisma.$transaction(async (tx) => {
        const old = await tx.transaction.findUnique({ where: { id } });
        if (!old) return;

        // Undo Impact
        if (old.status === 'PAID' && old.accountId) {
            try {
                const oldAmount = Number(old.amount);
                const undoChange = old.type === 'IN' ? -oldAmount : oldAmount;
                await (tx.financialAccount as any).update({
                    where: { id: old.accountId },
                    data: { balance: { increment: undoChange } }
                });
            } catch (e) { /* ignore missing column */ }
        }

        await tx.transaction.delete({
            where: { id }
        });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete Transaction Error:', error);
    return NextResponse.json({ error: 'Failed to delete transaction' }, { status: 500 });
  }
}
