
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authorize } from '@/lib/auth';
import { UserRole } from '@/types';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const user = await authorize([UserRole.OWNER, UserRole.SUPERADMIN]);
    
    // 1. Get all tenants the owner has access to
    const memberships = await prisma.tenantAccess.findMany({
        where: { userId: user.id, role: 'OWNER', isActive: true },
        include: { tenant: true }
    });

    const tenantIds = memberships.map(m => m.tenantId);

    // 2. Aggregate stats for each tenant
    // Note: This might be heavy if there are 100+ tenants, but for ERP-SDM it should be < 20.
    const stats = await Promise.all(tenantIds.map(async (tid) => {
        const [
            userCount,
            activeProjects,
            pendingRequests,
            todayAttendance,
            lateAttendance
        ] = await Promise.all([
            prisma.user.count({ where: { tenantId: tid } }),
            prisma.project.count({ where: { tenantId: tid, status: { not: 'DONE' } } as any }),
            prisma.leaveRequest.count({ where: { tenantId: tid, status: 'PENDING' } as any }),
            prisma.attendance.count({ where: { tenantId: tid, date: new Date().toISOString().split('T')[0] } as any }),
            prisma.attendance.count({ where: { tenantId: tid, date: new Date().toISOString().split('T')[0], isLate: 1 } as any })
        ]);

        // Finance: Get latest balance (Sum of liquid accounts)
        const accounts = await prisma.financialAccount.findMany({ where: { tenantId: tid, isActive: true } });
        // NOTE: COA Balance would be more accurate, but for high-level, sum of banks is a good proxy.
        // We'll try to get it from transactions if possible later, for now sum of accounts.
        // Since account balance is not stored in the record (it's calculated), let's calculate it.
        
        const transactions = await prisma.transaction.findMany({
            where: { tenantId: tid, status: 'PAID' } as any,
            select: { amount: true, type: true }
        });
        
        const balance = transactions.reduce((acc, t) => {
            return t.type === 'INCOME' ? acc + Number(t.amount) : acc - Number(t.amount);
        }, 0);

        return {
            tenantId: tid,
            name: memberships.find(m => m.tenantId === tid)?.tenant.name || tid,
            metrics: {
                users: userCount,
                projects: activeProjects,
                requests: pendingRequests,
                attendanceRate: userCount > 0 ? (todayAttendance / userCount) : 0,
                lateRate: todayAttendance > 0 ? (lateAttendance / todayAttendance) : 0,
                balance: balance
            }
        };
    }));

    return NextResponse.json(stats);
  } catch (error: any) {
    console.error('Multi-tenant metrics error:', error);
    return NextResponse.json({ error: 'Failed to aggregate metrics' }, { status: 500 });
  }
}
