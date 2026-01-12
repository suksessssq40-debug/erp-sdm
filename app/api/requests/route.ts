import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authorize } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    await authorize();
    const r = await request.json();

    await prisma.leaveRequest.create({
      data: {
        id: r.id,
        userId: r.userId,
        type: r.type,
        description: r.description,
        startDate: new Date(r.startDate),
        endDate: r.endDate ? new Date(r.endDate) : new Date(r.startDate),
        attachmentUrl: r.attachmentUrl || null,
        status: r.status,
        createdAt: r.createdAt ? BigInt(new Date(r.createdAt).getTime()) : BigInt(Date.now())
      }
    });

    return NextResponse.json(r, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
