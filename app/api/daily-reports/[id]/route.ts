import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authorize } from '@/lib/auth';

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await authorize();
    const { tenantId } = user;
    const id = params.id;
    const r = await request.json();

    // Security: Ensure repo exists & belongs to tenant
    const existing = await prisma.dailyReport.findFirst({ where: { id, tenantId } });
    if (!existing) return NextResponse.json({ error: 'Not Found or Unauthorized' }, { status: 404 });

    const isOwner = user.id === existing.userId;
    const actorUser = await prisma.user.findUnique({ where: { id: user.id } });
    const isAdmin = ['OWNER', 'MANAGER', 'FINANCE'].includes(user.role) || !!actorUser?.isKaizenMaster;

    if (!isOwner && !isAdmin) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await prisma.dailyReport.update({
      where: { id },
      data: {
        activitiesJson: JSON.stringify(r.activities || []),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        updatedAt: new Date()
      } as any
    });

    return NextResponse.json(r);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await authorize();
    const { tenantId } = user;
    const id = params.id;

    // Security: Strict tenant isolation
    const existing = await prisma.dailyReport.findFirst({ where: { id, tenantId } });
    if (!existing) return NextResponse.json({ error: 'Not Found or Unauthorized' }, { status: 404 });

    const isOwner = user.id === existing.userId;
    const actorUser = await prisma.user.findUnique({ where: { id: user.id } });
    const isAdmin = ['OWNER', 'MANAGER', 'FINANCE'].includes(user.role) || !!actorUser?.isKaizenMaster;

    if (!isOwner && !isAdmin) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await prisma.dailyReport.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
