import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authorize } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const user = await authorize();
    const r = await request.json();

    // Security: Prevent User Spoofing
    // If user is STAFF (not management), they can ONLY report for themselves.
    if (user.role === 'STAFF' && r.userId !== user.id) {
        return NextResponse.json({ error: 'Forbidden: Cannot submit report for others' }, { status: 403 });
    }

    await prisma.dailyReport.create({
      data: {
        id: r.id,
        userId: r.userId,
        date: r.date,
        activitiesJson: JSON.stringify(r.activities || [])
      }
    });

    return NextResponse.json(r, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
