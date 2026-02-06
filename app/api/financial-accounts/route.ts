import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authorize } from '@/lib/auth';
import { serialize } from '@/lib/serverUtils';

export async function GET() {
  try {
    const user = await authorize(['OWNER', 'FINANCE', 'MANAGER']);
    const { tenantId } = user;

    const accounts = await prisma.financialAccount.findMany({
      where: { tenantId, isActive: true },
      orderBy: { createdAt: 'asc' }
    });

    return NextResponse.json(serialize(accounts));
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await authorize(['OWNER', 'FINANCE']);
    const { tenantId } = user;
    const body = await request.json();

    if (!body.name || !body.bankName) {
      return NextResponse.json({ error: 'Name and Bank Name are required' }, { status: 400 });
    }

    const id = Math.random().toString(36).substr(2, 9);

    const newAccount = await prisma.financialAccount.create({
      data: {
        id,
        tenantId,
        name: body.name,
        bankName: body.bankName,
        accountNumber: body.accountNumber || '-',
        description: body.description || '',
        isActive: true,
        createdAt: BigInt(Date.now()),
        balance: 0
      }
    });

    return NextResponse.json(serialize(newAccount), { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

