import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authorize } from '@/lib/auth';

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await authorize();
    const id = params.id;
    const r = await request.json();

    // Security: Ensure user owns the report (unless Admin)
    const existing = await prisma.dailyReport.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: 'Not Found' }, { status: 404 });

    const isOwner = user.id === existing.userId;
    const isAdmin = ['OWNER', 'MANAGER', 'FINANCE'].includes(user.role);

    if (!isOwner && !isAdmin) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Logic: Allowed to edit? Maybe limit to same day?
    // User requested "Edit Feature", we assume full edit for now or let Frontend handle logic.
    // Ideally, lock editing after 24 hours. But let's be flexible first.

    await prisma.dailyReport.update({
      where: { id },
      data: {
        activitiesJson: JSON.stringify(r.activities || [])
        // Date usually shouldn't change, but if they want to fix date? Let's allow it for admins only?
        // For simplicity, just update activities.
      }
    });

    return NextResponse.json(r);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await authorize();
    const id = params.id;

    // Security
    const existing = await prisma.dailyReport.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: 'Not Found' }, { status: 404 });

    const isOwner = user.id === existing.userId;
    const isAdmin = ['OWNER', 'MANAGER', 'FINANCE'].includes(user.role);

    if (!isOwner && !isAdmin) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await prisma.dailyReport.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
