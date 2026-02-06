import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authorize } from '@/lib/auth';
import { serialize } from '@/lib/serverUtils';

export async function GET() {
  try {
    const user = await authorize(['OWNER', 'FINANCE', 'MANAGER']);
    const { tenantId } = user;

    const units = await prisma.businessUnit.findMany({
      where: { tenantId, isActive: true },
      orderBy: { name: 'asc' }
    });

    return NextResponse.json(serialize(units));
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

    if (!body.name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const id = Math.random().toString(36).substr(2, 9);

    const newUnit = await prisma.businessUnit.create({
      data: {
        id,
        tenantId,
        name: body.name,
        description: body.description || '',
        isActive: true,
        createdAt: BigInt(Date.now())
      }
    });

    return NextResponse.json(serialize(newUnit), { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

