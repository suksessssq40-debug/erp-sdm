import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authorize } from '@/lib/auth';
import { serialize, getJakartaNow } from '@/lib/serverUtils';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const user = await authorize(['OWNER', 'MANAGER', 'FINANCE']);
    const tenantId = user.tenantId;
    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant ID missing' }, { status: 400 });
    }

    const jkt = getJakartaNow();
    const todayISO = jkt.isoDate;
    const now = new Date();

    const [
      totalEmployees,
      attendanceToday,
      activeProjects,
      pendingRequests,
      lateCount,
      overdueProjects,
      latestReports,
      projectDistribution,
      recentLeaves
    ] = await Promise.all([
      // Only count active staff/managers/finance for percentage. Exclude Owner & Superadmin
      prisma.user.count({
        where: {
          tenantId,
          isActive: true,
          role: { notIn: ['OWNER', 'SUPERADMIN'] }
        }
      }),
      prisma.attendance.count({ where: { tenantId, date: todayISO } }),
      prisma.project.count({ where: { tenantId, status: 'ON_GOING' } }),
      prisma.leaveRequest.count({ where: { tenantId, status: 'PENDING' } }),
      prisma.attendance.count({ where: { tenantId, date: todayISO, isLate: 1 } }),
      prisma.project.count({
        where: {
          tenantId,
          status: { not: 'DONE' },
          deadline: { lt: now }
        }
      }),
      prisma.dailyReport.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: { user: { select: { name: true, avatarUrl: true, role: true } } }
      }),
      prisma.project.groupBy({
        by: ['status'],
        where: { tenantId },
        _count: { id: true }
      }),
      prisma.leaveRequest.findMany({
        where: { tenantId, status: 'PENDING' },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: { user: { select: { name: true, avatarUrl: true } } }
      })
    ]);

    return NextResponse.json(serialize({
      employees: totalEmployees,
      attendance: attendanceToday,
      projects: activeProjects,
      requests: pendingRequests,
      lateCount: lateCount,
      overdueProjects: overdueProjects,
      serverTime: todayISO,
      latestReports,
      projectDistribution,
      recentLeaves
    }));

  } catch (error: any) {
    console.error('[DASHBOARD_STATS_ERROR]', error);
    return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
  }
}

