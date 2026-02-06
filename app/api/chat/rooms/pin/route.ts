import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authorize } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const user = await authorize();
    const body = await request.json();
    const { roomId } = body;

    if (!roomId) return NextResponse.json({ error: 'Room ID required' }, { status: 400 });

    const membership = await prisma.chatMember.findUnique({
      where: { roomId_userId: { roomId, userId: user.id } }
    });

    if (!membership) return NextResponse.json({ error: 'Not a member' }, { status: 403 });

    const newPin = !membership.isPinned;

    await prisma.chatMember.update({
      where: { roomId_userId: { roomId, userId: user.id } },
      data: { isPinned: newPin }
    });

    return NextResponse.json({ success: true, isPinned: newPin });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

