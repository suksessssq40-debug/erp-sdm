import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authorize } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const user = await authorize();
    const { tenantId } = user;

    // Efficiently count unread based on lastReadAt
    const unreadCount = await prisma.chatMessage.count({
      where: {
        room: { tenantId, members: { some: { userId: user.id } } },
        createdAt: {
          gt: 0 // Default comparison if lastReadAt is complex
        }
      }
    });

    // Note: To be perfectly accurate, we'd need to compare against each room's lastReadAt.
    // However, for a quick badge, we can simplify or use a more complex aggregate.
    // Let's use the actual accurate logic.

    const memberships = await prisma.chatMember.findMany({
      where: { userId: user.id, room: { tenantId } },
      select: { roomId: true, lastReadAt: true }
    });

    let totalUnread = 0;
    for (const m of memberships) {
      const count = await prisma.chatMessage.count({
        where: {
          roomId: m.roomId,
          createdAt: { gt: m.lastReadAt || 0 }
        }
      });
      totalUnread += count;
    }

    return NextResponse.json({ count: totalUnread });

  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await authorize();
    const { tenantId } = user;
    const body = await request.json();
    const { roomId } = body;

    if (!roomId) return NextResponse.json({ error: 'Room ID required' }, { status: 400 });

    const room = await prisma.chatRoom.findFirst({ where: { id: roomId, tenantId } });
    if (!room) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const now = BigInt(Date.now());
    await prisma.chatMember.update({
      where: { roomId_userId: { roomId, userId: user.id } },
      data: { lastReadAt: now }
    });

    return NextResponse.json({ success: true, lastReadAt: Number(now) });

  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

