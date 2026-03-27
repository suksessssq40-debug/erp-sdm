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

      // ANTI-ERROR FEATURE: Cascade updates to Transactions
      // Since Bank Names can appear in either Debit (account) or Credit (category) 
      // during transferring or general cash operations, we MUST cascade thoroughly.
      if (existing.name !== body.name) {
        // Direct links via accountId
        await tx.transaction.updateMany({
          where: { accountId: id, tenantId, account: existing.name },
          data: { account: body.name }
        });

        // Some bank logic saves it in category if it's the credit side of a transfer
        await tx.transaction.updateMany({
          where: { accountId: id, tenantId, category: existing.name },
          data: { category: body.name }
        });

        // Fallback safetynet just for the name strings to heal disconnected transactions
        await tx.transaction.updateMany({
          where: { tenantId, account: existing.name },
          data: { account: body.name }
        });

        await tx.transaction.updateMany({
          where: { tenantId, category: existing.name },
          data: { category: body.name }
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

    const existing = await prisma.financialAccount.findFirst({
      where: { id, tenantId }
    });

    if (!existing) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    // PERMANENT CASCADE DELETE
    // According to Finance Team requirements: Deleting an account must erase all its history.
    await prisma.$transaction(async (tx) => {
      // 1. Delete all transactions linked via accountId
      await tx.transaction.deleteMany({
        where: { accountId: id, tenantId }
      });

      // 2. Delete all transactions linked via Name String (Safetynet for legacy/disconnected data)
      await tx.transaction.deleteMany({
        where: {
          tenantId,
          OR: [
            { account: existing.name },
            { category: existing.name }
          ]
        }
      });

      // 3. Finally delete the account itself
      await tx.financialAccount.delete({
        where: { id }
      });
    });

    return NextResponse.json({ success: true, message: 'Account and all associated mutations deleted permanently' });
  } catch (error: any) {
    console.error('DELETE_ACCOUNT_ERROR:', error);
    return NextResponse.json({ error: 'Failed to delete account: ' + error.message }, { status: 500 });
  }
}


