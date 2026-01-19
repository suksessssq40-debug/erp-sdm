
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authorize } from '@/lib/auth';
import { UserRole } from '@/types';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    await authorize([UserRole.OWNER, UserRole.MANAGER, UserRole.FINANCE, UserRole.STAFF]);
    const shifts = await prisma.shift.findMany({
      where: { tenantId: params.id },
      orderBy: { startTime: 'asc' }
    });
    return NextResponse.json(shifts);
  } catch (error) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    await authorize([UserRole.OWNER, UserRole.MANAGER]);
    const body = await request.json();
    const { name, startTime, endTime, isOvernight } = body;

    const shift = await prisma.shift.create({
      data: {
        id: `shf_${Math.random().toString(36).substr(2, 9)}`,
        tenantId: params.id,
        name,
        startTime,
        endTime,
        isOvernight: !!isOvernight
      }
    });

    return NextResponse.json(shift, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
