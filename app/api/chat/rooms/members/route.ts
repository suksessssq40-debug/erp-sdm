import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authorize } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const currentUser = await authorize();
    const { tenantId } = currentUser;
    const body = await request.json();
    const { roomId, userIds } = body;

    if (!roomId || !Array.isArray(userIds)) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });

    // Verify room belongs to tenant AND current user is a member
    const membership = await prisma.chatMember.findUnique({
      where: { roomId_userId: { roomId, userId: currentUser.id } },
      include: { room: { select: { tenantId: true } } }
    });

    if (!membership || membership.room.tenantId !== tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const now = BigInt(Date.now());

    // Filter valid members in the same tenant
    const validUsers = await prisma.user.findMany({
      where: { id: { in: userIds }, tenantId },
      select: { id: true }
    });

    if (validUsers.length > 0) {
      await prisma.chatMember.createMany({
        data: validUsers.map(u => ({
          roomId,
          userId: u.id,
          joinedAt: now
        })),
        skipDuplicates: true
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

