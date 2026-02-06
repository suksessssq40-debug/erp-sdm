export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authorize } from '@/lib/auth';

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
    try {
        const user = await authorize(['OWNER', 'FINANCE']);
        const { tenantId } = user;
        const id = params.id;

        const existing = await prisma.transactionCategory.findFirst({ where: { id, tenantId } });
        if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

        await prisma.$transaction([
            prisma.transactionCategory.deleteMany({ where: { parentId: id, tenantId } }),
            prisma.transactionCategory.delete({ where: { id } })
        ]);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Failed' }, { status: 500 });
    }
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
    try {
        const user = await authorize(['OWNER', 'FINANCE']);
        const { tenantId } = user;
        const id = params.id;
        const body = await request.json();

        const existing = await prisma.transactionCategory.findFirst({ where: { id, tenantId } });
        if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

        await prisma.transactionCategory.update({
            where: { id },
            data: {
                name: body.name,
                type: body.type
            }
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Failed' }, { status: 500 });
    }
}

