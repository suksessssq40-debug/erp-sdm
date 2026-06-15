import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authorize } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const actor = await authorize(['OWNER', 'SUPERADMIN']);
    const { tenantId } = actor;

    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: 'userId wajib diisi' }, { status: 400 });
    }

    // Check target user exists in this tenant
    const target = await prisma.user.findFirst({ where: { id: userId, tenantId } });
    if (!target) {
      return NextResponse.json({ error: 'User tidak ditemukan di tenant ini' }, { status: 404 });
    }

    // Reset points to 100
    const now = new Date();
    await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: {
          kaizenPoints: 100,
          kaizenPointsResetAt: now
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any
      }),
      prisma.systemLog.create({
        data: {
          id: Math.random().toString(36).substr(2, 9),
          timestamp: BigInt(Date.now()),
          actorId: actor.id,
          actorName: actor.name || actor.username,
          actorRole: actor.role,
          actionType: 'KAIZEN_RESET',
          details: `Reset poin kaizen ${target.name || target.username} ke 100`,
          targetObj: userId,
          tenantId
        }
      })
    ]);

    return NextResponse.json({
      success: true,
      userId,
      newPoints: 100,
      resetAt: now.toISOString()
    });
  } catch (error: unknown) {
    console.error('[KAIZEN RESET ERROR]', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'Gagal reset poin', details: msg }, { status: 500 });
  }
}
