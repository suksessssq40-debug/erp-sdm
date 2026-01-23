import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authorize } from '@/lib/auth';

// UPDATE (Edit) Request
export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    // 1. Authorize - Get user info
    const user = await authorize(); 
    const { tenantId, role, id: authUserId } = user;
    const id = params.id;
    const r = await request.json();

    // 2. Fetch existing request
    const existing = await prisma.leaveRequest.findUnique({ 
        where: { id },
        include: { user: true }
    });

    if (!existing || existing.tenantId !== tenantId) {
        return NextResponse.json({ error: 'Data tidak ditemukan atau akses ditolak' }, { status: 404 });
    }

    // 3. Permission Logic
    const isOwnerOrManagerOrFinance = ['OWNER', 'MANAGER', 'FINANCE'].includes(role);
    const isApplicant = existing.userId === authUserId;
    
    // Logic Rule: 
    // - Management can ALWAYS edit.
    // - Applicant can ONLY edit if status is PENDING.
    if (!isOwnerOrManagerOrFinance) {
        if (!isApplicant) {
            return NextResponse.json({ error: 'Hanya pemilik atau manajemen yang bisa mengubah data ini' }, { status: 403 });
        }
        if (existing.status !== 'PENDING') {
            return NextResponse.json({ error: 'Data yang sudah diproses tidak dapat diubah oleh staf' }, { status: 403 });
        }
    }

    // 4. Perform Update
    const isApprovalAction = (r.status === 'APPROVED' || r.status === 'REJECTED') && r.status !== existing.status;

    const dataToUpdate: any = {
        type: r.type,
        description: r.description,
        startDate: new Date(r.startDate),
        endDate: r.endDate ? new Date(r.endDate) : new Date(r.startDate),
        attachmentUrl: r.attachmentUrl || null,
    };

    // If it's a management role changing the status
    if (isOwnerOrManagerOrFinance && r.status) {
        dataToUpdate.status = r.status;
        
        if (isApprovalAction) {
            const activeUser = await prisma.user.findUnique({
                where: { id: user.id },
                select: { name: true }
            });
            dataToUpdate.approverId = user.id;
            dataToUpdate.approverName = activeUser?.name || 'Manager';
            dataToUpdate.actionNote = r.actionNote || null;
            dataToUpdate.actionAt = BigInt(Date.now());
        }
    }

    const updated = await prisma.leaveRequest.update({
      where: { id },
      data: dataToUpdate
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Gagal memperbarui data' }, { status: 500 });
  }
}

// DELETE Request
export async function DELETE(request: Request, { params }: { params: { id: string } }) {
    try {
        // ONLY Management can DELETE
        const user = await authorize(['OWNER', 'MANAGER', 'FINANCE']);
        const { tenantId } = user;
        const id = params.id;

        const existing = await prisma.leaveRequest.findFirst({
            where: { id, tenantId }
        });

        if (!existing) {
            return NextResponse.json({ error: 'Data tidak ditemukan' }, { status: 404 });
        }

        await prisma.leaveRequest.delete({
            where: { id }
        });

        return NextResponse.json({ success: true, message: 'Data berhasil dihapus' });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Gagal menghapus data' }, { status: 500 });
    }
}
