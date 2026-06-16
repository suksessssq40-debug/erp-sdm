import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authorize } from '@/lib/auth';
import { serializeDailyReport } from '@/lib/dailyReport';

export async function GET(request: Request) {
  try {
    const user = await authorize();
    const { tenantId } = user;

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('start');
    const endDate = searchParams.get('end');

    const actorUser = await prisma.user.findUnique({ where: { id: user.id } });
    const isAdmin = ['OWNER', 'MANAGER', 'FINANCE'].includes(user.role) || !!actorUser?.isKaizenMaster;
    const where: Record<string, unknown> = { tenantId };
    if (!isAdmin) where.userId = user.id;

    if (startDate && endDate) {
      where.date = { gte: startDate, lte: endDate };
    } else if (startDate) {
      where.date = { gte: startDate };
    }

    const reports = await prisma.dailyReport.findMany({
      where,
      orderBy: { date: 'desc' },
      take: startDate ? undefined : 200,
    });

    return NextResponse.json(reports.map(serializeDailyReport));
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    console.error(e);
    return NextResponse.json({ error: 'Failed', details: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await authorize();
    const { tenantId } = user;
    const body = await request.json();

    if (user.role === 'STAFF' && body.userId !== user.id) {
      return NextResponse.json({ error: 'Forbidden: Cannot submit report for others' }, { status: 403 });
    }

    const now = new Date();
    const created = await prisma.dailyReport.create({
      data: {
        id: body.id,
        tenantId,
        userId: body.userId,
        date: body.date,
        activitiesJson: JSON.stringify(body.activities || []),
        createdAt: now,
        updatedAt: now,
      },
    });

    return NextResponse.json(serializeDailyReport(created), { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(error);
    return NextResponse.json({ error: 'Failed', details: message }, { status: 500 });
  }
}
