import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authorize } from '@/lib/auth';
import { serialize } from '@/lib/serverUtils';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const user = await authorize();
    const { tenantId } = user;
    const { searchParams } = new URL(request.url);
    const roomId = searchParams.get('roomId');
    const before = searchParams.get('before');

    if (!roomId) return NextResponse.json({ error: 'Room ID required' }, { status: 400 });

    // Verify membership AND tenant ownership
    const membership = await prisma.chatMember.findUnique({
      where: { roomId_userId: { roomId, userId: user.id } },
      include: { room: { select: { tenantId: true } } }
    });

    if (!membership || membership.room.tenantId !== tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const messages = await prisma.chatMessage.findMany({
      where: {
        roomId,
        ...(before ? { createdAt: { lt: BigInt(before) } } : {})
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        sender: { select: { name: true, role: true } },
        ...({
          replyTo: {
            select: {
              id: true,
              content: true,
              sender: { select: { name: true } }
            }
          }
        } as any)
      }
    } as any);

    // Transform for frontend
    const formatted = messages.reverse().map((m: any) => ({
      id: m.id,
      roomId: m.roomId,
      senderId: m.senderId,
      content: m.content,
      attachmentUrl: m.attachmentUrl,
      replyToId: m.replyToId,
      replyToMessage: m.replyTo ? {
        id: m.replyTo.id,
        senderName: m.replyTo.sender?.name || 'Unknown',
        content: m.replyTo.content
      } : undefined,
      createdAt: Number(m.createdAt),
      senderName: m.sender?.name || 'Unknown',
      senderRole: m.sender?.role || 'STAFF',
      isPinned: m.isPinned
    }));

    return NextResponse.json(serialize(formatted));
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
    const { roomId, content, attachmentUrl, replyToId } = body;

    if (!roomId || (!content && !attachmentUrl)) return NextResponse.json({ error: 'Invalid' }, { status: 400 });

    // Verify membership AND tenant isolation
    const membership = await prisma.chatMember.findUnique({
      where: { roomId_userId: { roomId, userId: user.id } },
      include: { room: { select: { tenantId: true } } }
    });

    if (!membership || membership.room.tenantId !== tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const id = Math.random().toString(36).substr(2, 9);
    const now = BigInt(Date.now());

    const created = await (prisma.chatMessage as any).create({
      data: {
        id,
        roomId,
        senderId: user.id,
        content: content || '',
        attachmentUrl: attachmentUrl || '',
        replyToId: replyToId || null,
        createdAt: now
      },
      include: {
        sender: { select: { name: true, role: true } },
        replyTo: {
          select: {
            id: true,
            content: true,
            sender: { select: { name: true } }
          }
        }
      }
    });

    return NextResponse.json(serialize({
      ...created,
      senderName: created.sender?.name || 'Unknown',
      senderRole: created.sender?.role || 'STAFF',
      replyToMessage: created.replyTo ? {
        id: created.replyTo.id,
        senderName: created.replyTo.sender?.name || 'Unknown',
        content: created.replyTo.content
      } : undefined
    }));
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const user = await authorize();
    const { tenantId } = user;
    const body = await request.json();
    const { messageId, content } = body;

    if (!messageId || !content) return NextResponse.json({ error: 'Invalid' }, { status: 400 });

    const msg = await prisma.chatMessage.findUnique({
      where: { id: messageId },
      include: { room: { select: { tenantId: true } } }
    });

    if (!msg || !msg.room || msg.room.tenantId !== tenantId) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    if (msg.senderId !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    await prisma.chatMessage.update({
      where: { id: messageId },
      data: { content }
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

