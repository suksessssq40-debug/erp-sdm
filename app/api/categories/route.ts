import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authorize } from '@/lib/auth';
import { serialize } from '@/lib/serverUtils';

export async function GET() {
  try {
    const user = await authorize(['OWNER', 'FINANCE', 'MANAGER']);
    const { tenantId } = user;

    const categories = await prisma.transactionCategory.findMany({
      where: { tenantId },
      orderBy: [{ type: 'asc' }, { name: 'asc' }]
    });

    return NextResponse.json(serialize(categories));
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

    if (!body.name || !body.type) {
      return NextResponse.json({ error: 'Name and Type are required' }, { status: 400 });
    }

    const id = Math.random().toString(36).substr(2, 9);

    const newCategory = await prisma.transactionCategory.create({
      data: {
        id,
        tenantId,
        name: body.name,
        type: body.type,
        parentId: body.parentId || null,
        createdAt: BigInt(Date.now())
      }
    });

    return NextResponse.json(serialize(newCategory), { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

