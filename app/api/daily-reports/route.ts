import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authorize } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    const user = await authorize();
    const { tenantId } = user;
    
    const isAdmin = ['OWNER', 'MANAGER', 'FINANCE'].includes(user.role);
    const where: any = { tenantId };
    if (!isAdmin) where.userId = user.id;

    const reports = await prisma.dailyReport.findMany({
       where,
       orderBy: { date: 'desc' },
       take: 100 
    });

    const formatted = reports.map(r => ({
        id: r.id,
        userId: r.userId,
        tenantId: (r as any).tenantId,
        date: r.date,
        activities: typeof r.activitiesJson === 'string' ? JSON.parse(r.activitiesJson) : []
    }));

    return NextResponse.json(formatted);
  } catch(e: any) {
      console.error(e);
      return NextResponse.json({ error: 'Failed', details: e.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await authorize();
    const { tenantId } = user;
    const r = await request.json();

    // Security: Prevent User Spoofing within Tenant
    if (user.role === 'STAFF' && r.userId !== user.id) {
        return NextResponse.json({ error: 'Forbidden: Cannot submit report for others' }, { status: 403 });
    }

    await prisma.dailyReport.create({
      data: {
        id: r.id,
        tenantId,
        userId: r.userId,
        date: r.date,
        activitiesJson: JSON.stringify(r.activities || [])
      }
    });

    return NextResponse.json(r, { status: 201 });
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: 'Failed', details: error.message }, { status: 500 });
  }
}
