import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authorize } from '@/lib/auth';
import { serializeDailyReport } from '@/lib/dailyReport';

async function assertCanModifyReport(userId: string, userRole: string, existingUserId: string | null) {
  const isOwner = userId === existingUserId;
  const actorUser = await prisma.user.findUnique({ where: { id: userId } });
  const isAdmin = ['OWNER', 'MANAGER', 'FINANCE'].includes(userRole) || !!actorUser?.isKaizenMaster;
  return { isOwner, isAdmin, allowed: isOwner || isAdmin };
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await authorize();
    const { tenantId } = user;
    const id = params.id;
    const body = await request.json();

    const existing = await prisma.dailyReport.findFirst({ where: { id, tenantId } });
    if (!existing) {
      return NextResponse.json({ error: 'Not Found or Unauthorized' }, { status: 404 });
    }

    const { allowed } = await assertCanModifyReport(user.id, user.role, existing.userId);
    if (!allowed) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const updated = await prisma.dailyReport.update({
      where: { id },
      data: {
        activitiesJson: JSON.stringify(body.activities || []),
        ...(body.date ? { date: body.date } : {}),
      },
    });

    return NextResponse.json(serializeDailyReport(updated));
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await authorize();
    const { tenantId } = user;
    const id = params.id;

    const existing = await prisma.dailyReport.findFirst({ where: { id, tenantId } });
    if (!existing) {
      return NextResponse.json({ error: 'Not Found or Unauthorized' }, { status: 404 });
    }

    const { allowed } = await assertCanModifyReport(user.id, user.role, existing.userId);
    if (!allowed) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await prisma.dailyReport.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
