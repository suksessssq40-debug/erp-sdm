
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authorize } from '@/lib/auth';
import { UserRole } from '@/types';

// EDIT TENANT
export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await authorize([UserRole.OWNER, UserRole.SUPERADMIN]);
    const { id } = params;
    const body = await request.json();
    const { name, description, features, isActive } = body;

    const updated = await prisma.tenant.update({
      where: { id },
      data: {
        name,
        description,
        isActive,
        featuresJson: features ? JSON.stringify(features) : undefined
      }
    });

    console.log(`Tenant ${id} updated by ${user.username}`);
    return NextResponse.json(updated);
  } catch (error: any) {
    console.error('Update Tenant Error:', error);
    return NextResponse.json({ error: 'Gagal memperbarui unit bisnis' }, { status: 500 });
  }
}

// DELETE TENANT
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await authorize([UserRole.OWNER, UserRole.SUPERADMIN]);
    const { id } = params;

    if (id === 'sdm') {
        return NextResponse.json({ error: 'Kantor Pusat (SDM) tidak boleh dihapus.' }, { status: 400 });
    }

    // --- ATOMIC PURGE TRANSACTION ---
    // We must delete dependent records in order to satisfy Foreign Key constraints (P2003)
    await prisma.$transaction(async (tx) => {
      const tid = id;

      // 1. Settings (The one currently blocking)
      await tx.settings.deleteMany({ where: { tenantId: tid } });

      // 2. Access Lists & Memberships
      await tx.tenantAccess.deleteMany({ where: { tenantId: tid } });
      
      // 3. Operational Data (Kanban, Chat, Attendance)
      await tx.chatMessage.deleteMany({ where: { room: { tenantId: tid } } });
      await tx.chatMember.deleteMany({ where: { room: { tenantId: tid } } });
      await tx.chatRoom.deleteMany({ where: { tenantId: tid } });
      await tx.attendance.deleteMany({ where: { tenantId: tid } });
      await tx.leaveRequest.deleteMany({ where: { tenantId: tid } });
      await tx.dailyReport.deleteMany({ where: { tenantId: tid } });
      await tx.project.deleteMany({ where: { tenantId: tid } });

      // 4. Financial Data
      await tx.transaction.deleteMany({ where: { tenantId: tid } });
      await tx.financialAccount.deleteMany({ where: { tenantId: tid } });
      await tx.transactionCategory.deleteMany({ where: { tenantId: tid } });
      await tx.chartOfAccount.deleteMany({ where: { tenantId: tid } });
      await tx.businessUnit.deleteMany({ where: { tenantId: tid } });

      // 5. User Cleanup
      // Important: We don't necessarily want to delete the User account if it's used elsewhere,
      // but for "Unified Identity", we at least need to detach them from this tenant.
      // However, if the user's primary 'tenantId' is this one, we set it back to 'sdm' or null.
      await tx.user.updateMany({
          where: { tenantId: tid },
          data: { tenantId: 'sdm' }
      });

      // 6. Finally, Delete the Tenant Identity
      await tx.tenant.delete({
        where: { id: tid }
      });
    });

    console.log(`Tenant ${id} and all its associated data PURGED by ${user.username}`);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Delete Tenant Error:', error);
    let errorMsg = 'Gagal menghapus unit bisnis.';
    if (error.code === 'P2003') {
        errorMsg = 'Gagal: Unit ini masih memiliki data terkait yang tidak bisa dihapus otomatis.';
    }
    return NextResponse.json({ error: errorMsg, detail: error.message }, { status: 500 });
  }
}
