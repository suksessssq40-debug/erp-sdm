import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authorize } from '@/lib/auth';
import { serialize } from '@/lib/serverUtils';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const user = await authorize();
    const { tenantId } = user;

    // 1. Get rooms where user is member AND room belongs to user tenant
    const rooms = await prisma.chatRoom.findMany({
      where: {
        tenantId,
        members: { some: { userId: user.id } }
      },
      include: {
        members: {
          select: { userId: true, lastReadAt: true, isPinned: true }
        },
        messages: {
          take: 1,
          orderBy: { createdAt: 'desc' },
          include: { sender: { select: { name: true } } }
        }
      }
    });

    const formattedRooms = await Promise.all(rooms.map(async (room) => {
      const myMemberInfo = room.members.find(m => m.userId === user.id);
      const lastMsg = room.messages[0];

      // Efficiently count unread based on lastReadAt
      const unreadCount = await prisma.chatMessage.count({
        where: {
          roomId: room.id,
          createdAt: { gt: myMemberInfo?.lastReadAt || 0 }
        }
      });

      return {
        id: room.id,
        name: room.name,
        type: room.type,
        tenantId: room.tenantId,
        createdBy: room.createdBy,
        createdAt: Number(room.createdAt),
        memberIds: room.members.map(m => m.userId),
        lastMessage: lastMsg ? {
          content: lastMsg.content,
          senderName: lastMsg.sender?.name || 'Unknown',
          timestamp: Number(lastMsg.createdAt)
        } : undefined,
        unreadCount,
        isPinned: myMemberInfo?.isPinned || false
      };
    }));

    // Final sorting for premium feel
    formattedRooms.sort((a, b) => {
      if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
      const timeA = a.lastMessage?.timestamp || a.createdAt;
      const timeB = b.lastMessage?.timestamp || b.createdAt;
      return timeB - timeA;
    });

    return NextResponse.json(serialize(formattedRooms));
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
    const { name, type, memberIds } = body;

    if (!name) return NextResponse.json({ error: 'Name required' }, { status: 400 });

    const roomId = Math.random().toString(36).substr(2, 9);
    const now = BigInt(Date.now());

    // Filter memberIds to only include those in the same tenant
    const validMembers = [user.id];
    if (Array.isArray(memberIds)) {
      const potentialMembers = await prisma.user.findMany({
        where: { id: { in: memberIds }, tenantId },
        select: { id: true }
      });
      potentialMembers.forEach(m => { if (m.id !== user.id) validMembers.push(m.id); });
    }

    const newRoom = await prisma.chatRoom.create({
      data: {
        id: roomId,
        tenantId,
        name,
        type: type || 'GROUP',
        createdBy: user.id,
        createdAt: now,
        members: {
          create: validMembers.map(mid => ({
            userId: mid,
            joinedAt: now
          }))
        }
      }
    });

    return NextResponse.json(serialize(newRoom));
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await authorize();
    const { tenantId } = user;
    const { searchParams } = new URL(request.url);
    const roomId = searchParams.get('id');

    if (!roomId) return NextResponse.json({ error: 'ID required' }, { status: 400 });
    if (roomId.startsWith('general-')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const room = await prisma.chatRoom.findFirst({
      where: { id: roomId, tenantId }
    });
    if (!room) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // Transactional delete
    await prisma.$transaction([
      prisma.chatMessage.deleteMany({ where: { roomId } }),
      prisma.chatMember.deleteMany({ where: { roomId } }),
      prisma.chatRoom.delete({ where: { id: roomId } })
    ]);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
