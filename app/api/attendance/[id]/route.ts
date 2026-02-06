export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authorize } from '@/lib/auth';
import { serialize, getJakartaNow, recordSystemLog } from '@/lib/serverUtils';

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await authorize();
    const { tenantId } = user;
    const id = params.id;
    const a = await request.json();

    const existing = await prisma.attendance.findFirst({
      where: { id, tenantId }
    });
    if (!existing) return NextResponse.json({ error: 'Record not found' }, { status: 404 });

    const jkt = getJakartaNow();
    const serverTimeStr = jkt.isoTime;

    const updated = await prisma.attendance.update({
      where: { id },
      data: {
        timeOut: serverTimeStr,
        checkoutSelfieUrl: a.checkOutSelfieUrl
      }
    });

    await recordSystemLog({
      actorId: user.id,
      actorName: user.name,
      actorRole: user.role,
      actionType: 'ATTENDANCE_OUT',
      details: `Check-Out pada ${serverTimeStr}`,
      targetObj: 'Attendance',
      tenantId
    });

    return NextResponse.json(serialize(updated));
  } catch (error: any) {
    console.error("Attendance PUT Error:", error);
    return NextResponse.json({ error: 'Internal Error', details: error.message }, { status: 500 });
  }
}
