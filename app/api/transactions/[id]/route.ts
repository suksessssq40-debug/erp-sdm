
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authorize } from '@/lib/auth';

export async function PUT(request: Request, { params }: { params: { id: string } }) {
    try {
        const user = await authorize(['OWNER', 'FINANCE']);
        const { tenantId } = user;
        const id = params.id;
        const body = await request.json();

        if (!body.amount || !body.account) {
            return NextResponse.json({ error: 'Invalid data' }, { status: 400 });
        }

        // STRICT CHECK: Ownership & Tenant match
        const existingTx = await prisma.transaction.findFirst({ where: { id, tenantId } });
        if (!existingTx) return NextResponse.json({ error: 'Transaction not found or unauthorized' }, { status: 404 });

        // --- UNIVERSAL LOGIC: Redetermine Bank vs COA Context ---
        const debitName = body.account;
        const creditName = body.category;

        const [bankDebit, bankCredit] = await Promise.all([
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
            })
        ]);

        let finalType = body.type || 'IN';
        let accountId: string | null = null;

        // Determination Logic (Mirroring POST for consistency)
        if (bankDebit && !bankCredit) {
            finalType = 'IN';
            accountId = bankDebit.id;
        } else if (bankCredit && !bankDebit) {
            finalType = 'OUT';
            accountId = bankCredit.id;
        } else if (bankDebit && bankCredit) {
            // Internal Transfer (Bank to Bank) - Source is Credit Side
            finalType = 'OUT';
            accountId = bankCredit.id;
        }

        const updated = await prisma.$transaction(async (tx) => {
            const old = await tx.transaction.findUnique({ where: { id } });
            if (!old) throw new Error('Transaction not found');

            // 1. Undo Old Impact (Operational Basis - Always Undo)
            if (old.accountId) {
                try {
                    const oldAmount = Number(old.amount);
                    const undoChange = old.type === 'IN' ? -oldAmount : oldAmount;
                    await (tx.financialAccount as any).update({
                        where: { id: old.accountId, tenantId },
                        data: { balance: { increment: undoChange } }
                    });
                } catch (e) { /* ignore */ }
            }

            // 2. Perform Update (With Corrected type and accountId)
            const up = await tx.transaction.update({
                where: { id },
                data: {
                    date: new Date(body.date),
                    amount: body.amount,
                    type: finalType,
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

            // 3. Apply New Impact (Operational Basis - Always Apply)
            if (accountId) {
                try {
                    const newAmount = Number(body.amount);
                    const applyChange = body.type === 'IN' ? newAmount : -newAmount;
                    await (tx.financialAccount as any).update({
                        where: { id: accountId, tenantId },
                        data: { balance: { increment: applyChange } }
                    });
                } catch (e) { /* ignore */ }
            }

            return up;
        });

        return NextResponse.json(updated);
    } catch (error) {
        console.error('Update Transaction Error:', error);
        return NextResponse.json({ error: (error as any).message || 'Failed' }, { status: 500 });
    }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
    try {
        const user = await authorize(['OWNER', 'FINANCE']);
        const { tenantId } = user;
        const id = params.id;

        // STRICT CHECK: Tenant validation
        const existing = await prisma.transaction.findFirst({ where: { id, tenantId } });
        if (!existing) return NextResponse.json({ error: 'Unauthorized delete' }, { status: 403 });

        await prisma.$transaction(async (tx) => {
            const old = await tx.transaction.findUnique({ where: { id } });
            if (!old) return;

            if (old.accountId) {
                try {
                    const oldAmount = Number(old.amount);
                    const undoChange = old.type === 'IN' ? -oldAmount : oldAmount;
                    await (tx.financialAccount as any).update({
                        where: { id: old.accountId, tenantId },
                        data: { balance: { increment: undoChange } }
                    });
                } catch (e) { /* ignore */ }
            }

            await tx.transaction.delete({ where: { id } });
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Delete Transaction Error:', error);
        return NextResponse.json({ error: 'Failed' }, { status: 500 });
    }
}
