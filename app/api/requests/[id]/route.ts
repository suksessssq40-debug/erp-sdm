import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authorize } from '@/lib/auth';

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await authorize(['OWNER', 'MANAGER', 'FINANCE']);
    const { tenantId } = user;
    const id = params.id;
    const r = await request.json();

    // STRICT CHECK: Ownership & Tenant match
    const existing = await prisma.leaveRequest.findFirst({ where: { id, tenantId } as any });
    if (!existing) return NextResponse.json({ error: 'Request not found or unauthorized' }, { status: 404 });

    const isApprovalAction = r.status === 'APPROVED' || r.status === 'REJECTED';

    const activeUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { name: true }
    });
    const approverRealName = activeUser?.name || 'Unknown Approver';

    await prisma.leaveRequest.update({
      where: { id },
      data: {
        type: r.type,
        description: r.description,
        startDate: new Date(r.startDate),
        endDate: r.endDate ? new Date(r.endDate) : new Date(r.startDate),
        attachmentUrl: r.attachmentUrl || null,
        status: r.status,
        
        // Audit Trail (Only updated if explicit action is taken)
        ...(isApprovalAction && {
            approverId: user.id,
            approverName: approverRealName,
            actionNote: r.actionNote || null,
            actionAt: BigInt(Date.now())
        })
      }
    });

    return NextResponse.json(r);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
