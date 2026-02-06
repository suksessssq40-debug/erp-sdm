export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authorize } from '@/lib/auth';
import { serialize } from '@/lib/serverUtils';

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await authorize(['OWNER', 'FINANCE']);
    const { tenantId } = user;
    const id = params.id;
    const body = await request.json();

    if (!body.name || !body.bankName) {
      return NextResponse.json({ error: 'Name and Bank Name are required' }, { status: 400 });
    }

    const existing = await prisma.financialAccount.findFirst({
      where: { id, tenantId }
    });

    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const acc = await tx.financialAccount.update({
        where: { id },
        data: {
          name: body.name,
          bankName: body.bankName,
          accountNumber: body.accountNumber || '-',
          description: body.description || '',
          isActive: body.isActive ?? true
        }
      });

      // Cascade update transaction 'account' name reference for backward compatibility
      if (existing.name !== body.name) {
        await tx.transaction.updateMany({
          where: { accountId: id, tenantId },
          data: { account: body.name }
        });
      }

      return acc;
    });

    return NextResponse.json(serialize(updated));
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await authorize(['OWNER', 'FINANCE']);
    const { tenantId } = user;
    const id = params.id;

    const existing = await prisma.financialAccount.findFirst({ where: { id, tenantId } });
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    await prisma.financialAccount.update({
      where: { id },
      data: { isActive: false }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

