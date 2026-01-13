import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authorize } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    const user = await authorize();
    
    const isAdmin = ['OWNER', 'MANAGER', 'FINANCE'].includes(user.role);
    const where = isAdmin ? {} : { userId: user.id };

    const requests = await prisma.leaveRequest.findMany({
       where,
       orderBy: { createdAt: 'desc' },
       take: 100
    });

    const formatted = requests.map(r => ({
          id: r.id,
          userId: r.userId,
          type: r.type,
          description: r.description,
          startDate: r.startDate ? r.startDate.toISOString().split('T')[0] : '',
          endDate: r.endDate ? r.endDate.toISOString().split('T')[0] : (r.startDate ? r.startDate.toISOString().split('T')[0] : ''),
          attachmentUrl: r.attachmentUrl || undefined,
          status: r.status,
          createdAt: r.createdAt ? Number(r.createdAt) : Date.now()
    }));

    return NextResponse.json(formatted);
  } catch(e) {
      console.error(e);
      return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

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
