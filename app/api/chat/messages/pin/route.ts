import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authorize } from '@/lib/auth';
import { UserRole } from '@/types';
import { serialize } from '@/lib/serverUtils';

export async function POST(request: Request) {
    try {
        const user = await authorize();
        const { tenantId } = user;
        const body = await request.json();
        const { messageId } = body;

        if (!messageId) return NextResponse.json({ error: 'Message ID required' }, { status: 400 });

        const msg = await prisma.chatMessage.findUnique({
            where: { id: messageId },
            include: { room: { select: { tenantId: true } } }
        });

        if (!msg || !msg.room || msg.room.tenantId !== tenantId) {
            return NextResponse.json({ error: 'Not found' }, { status: 404 });
        }

        const canPin = user.role === UserRole.OWNER || user.role === UserRole.MANAGER || msg.senderId === user.id;
        if (!canPin) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

        const newPin = !msg.isPinned;
        await prisma.chatMessage.update({
            where: { id: messageId },
            data: { isPinned: newPin }
        });

        return NextResponse.json({ success: true, isPinned: newPin, roomId: msg.roomId });
    } catch (err) {
        console.error(err);
        return NextResponse.json({ error: 'Failed' }, { status: 500 });
    }
}

export async function GET(request: Request) {
    try {
        const user = await authorize();
        const { tenantId } = user;
        const { searchParams } = new URL(request.url);
        const roomId = searchParams.get('roomId');
        if (!roomId) return NextResponse.json({ error: 'Room ID required' }, { status: 400 });

        const room = await prisma.chatRoom.findFirst({ where: { id: roomId, tenantId } });
        if (!room) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

        const pinned = await prisma.chatMessage.findFirst({
            where: { roomId, isPinned: true },
            orderBy: { createdAt: 'desc' },
            include: { sender: { select: { name: true } } }
        });

        if (!pinned) return NextResponse.json({ pinnedMessage: null });

        return NextResponse.json(serialize({
            pinnedMessage: {
                id: pinned.id,
                content: pinned.content,
                senderName: pinned.sender?.name,
                createdAt: pinned.createdAt
            }
        }));

    } catch (err) {
        console.error(err);
        return NextResponse.json({ error: 'Failed' }, { status: 500 });
    }
}

