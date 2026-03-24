import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authorize } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function PUT(request: Request, { params }: { params: { id: string } }) {
    try {
        const user = await authorize(['OWNER', 'FINANCE']);
        const { tenantId } = user;
        const id = params.id;
        const body = await request.json();

        if (!body.code || !body.name || !body.type || !body.normalPos) {
            return NextResponse.json({ error: 'Data tidak lengkap' }, { status: 400 });
        }

        const existing = await prisma.chartOfAccount.findFirst({
            where: { id, tenantId }
        });

        if (!existing) {
            return NextResponse.json({ error: 'COA tidak ditemukan' }, { status: 404 });
        }

        const updated = await prisma.$transaction(async (tx) => {
            const oldStringId = `${existing.code} - ${existing.name}`;
            const newStringId = `${body.code} - ${body.name}`;

            const coa = await tx.chartOfAccount.update({
                where: { id },
                data: {
                    code: body.code,
                    name: body.name,
                    type: body.type,
                    normalPos: body.normalPos,
                    description: body.description || '',
                }
            });

            // ANTI-ERROR FEATURE: Cascade updates to Transactions
            // Any transaction that stored the old COA string either in 'category' or 'account'
            // side, will be perfectly translated to the new name to prevent Ledger and PnL reporting breaks.
            if (existing.name !== body.name || existing.code !== body.code) {
                // Update where it is mapped as Category (Credit Side)
                await tx.transaction.updateMany({
                    where: { tenantId, coaId: id, category: oldStringId },
                    data: { category: newStringId }
                });

                // Update where it is mapped as Account (Debit Side / General Journal)
                await tx.transaction.updateMany({
                    where: { tenantId, coaId: id, account: oldStringId },
                    data: { account: newStringId }
                });

                // Fallback for transactions where coaId wasn't properly linked but string matches
                await tx.transaction.updateMany({
                    where: { tenantId, category: oldStringId },
                    data: { category: newStringId }
                });

                await tx.transaction.updateMany({
                    where: { tenantId, account: oldStringId },
                    data: { account: newStringId }
                });
            }

            return coa;
        });

        return NextResponse.json({
            ...updated,
            createdAt: updated.createdAt ? updated.createdAt.toString() : null
        });
    } catch (e: any) {
        console.error('COA Update Error:', e);
        return NextResponse.json({ error: 'Gagal mengupdate COA: ' + e.message }, { status: 500 });
    }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
    try {
        const user = await authorize(['OWNER', 'FINANCE']);
        const { tenantId } = user;
        const id = params.id;

        const existing = await prisma.chartOfAccount.findFirst({
            where: { id, tenantId }
        });

        if (!existing) {
            return NextResponse.json({ error: 'COA tidak ditemukan' }, { status: 404 });
        }

        await prisma.chartOfAccount.update({
            where: { id },
            data: { isActive: false }
        });

        return NextResponse.json({ success: true });
    } catch (e: any) {
        console.error(e);
        return NextResponse.json({ error: 'Gagal menonaktifkan COA: ' + e.message }, { status: 500 });
    }
}
