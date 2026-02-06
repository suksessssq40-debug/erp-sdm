export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authorize } from '@/lib/auth';
import { serialize, recordSystemLog } from '@/lib/serverUtils';

export async function GET(request: Request) {
  try {
    const user = await authorize();
    const { tenantId } = user;

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('start');
    const endDate = searchParams.get('end');

    const isAdmin = ['OWNER', 'MANAGER', 'FINANCE'].includes(user.role);
    const where: any = { tenantId };
    if (!isAdmin) where.userId = user.id;

    if (startDate && endDate) {
      where.date = { gte: startDate, lte: endDate };
    } else if (startDate) {
      where.date = { gte: startDate };
    }

    const reports = await prisma.dailyReport.findMany({
      where,
      orderBy: { date: 'desc' },
      take: startDate ? undefined : 200
    });

    return NextResponse.json(serialize(reports));
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: 'Failed', details: e.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await authorize();
    const { tenantId } = user;
    const r = await request.json();

    if (user.role === 'STAFF' && r.userId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const created = await prisma.dailyReport.create({
      data: {
        id: r.id,
        tenantId,
        userId: r.userId,
        date: r.date,
        activitiesJson: JSON.stringify(r.activities || [])
      }
    });

    await recordSystemLog({
      actorId: user.id,
      actorName: user.name,
      actorRole: user.role,
      actionType: 'REPORT_SUBMIT',
      details: `Submit laporan harian: ${r.date}`,
      targetObj: 'DailyReport',
      tenantId
    });

    return NextResponse.json(serialize(created), { status: 201 });
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: 'Failed', details: error.message }, { status: 500 });
  }
}

