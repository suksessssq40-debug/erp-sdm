export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authorize } from '@/lib/auth';

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await authorize();
    const { tenantId } = user;
    const id = params.id;
    const a = await request.json();

    // STRICT CHECK: Ensure record belongs to tenant
    const existing = await prisma.attendance.findFirst({ where: { id, tenantId } as any });
    if (!existing) return NextResponse.json({ error: 'Record not found' }, { status: 404 });

    // --- HARDENING: SERVER TIME ENFORCEMENT ---
    const now = new Date();
    const jakartaTime = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Jakarta" }));
    const serverTimeStr = jakartaTime.toLocaleTimeString('id-ID', { hour12: false, hour: '2-digit', minute: '2-digit' }).replace(/\./g, ':');

    await prisma.attendance.update({
      where: { id },
      data: {
        // PREVENT TAMPERING: Only allow checkout fields
        timeOut: serverTimeStr, // SERVER TIME
        checkoutSelfieUrl: a.checkOutSelfieUrl
      }
    });

    return NextResponse.json(a);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
