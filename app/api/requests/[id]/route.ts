import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authorize } from '@/lib/auth';

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await authorize(['OWNER', 'MANAGER', 'FINANCE']);
    const id = params.id;
    const r = await request.json();

    // Prepare Update Data
    // We conditionally update fields only if present to allow partial updates (e.g. just status update)
    // Or we assume the frontend sends full object. Based on typical React forms, usually full object.
    
    // Critical Logic: If status is changing to APPROVED/REJECTED, we must log the Approver.
    const isApprovalAction = r.status === 'APPROVED' || r.status === 'REJECTED';

    // But wait, the `user` from authorize() might be just { id, role }. We need the name.
    // Fetch the full user details to get the Name for audit trail
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
            approverName: approverRealName, // FIXED: Use fetched name
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
