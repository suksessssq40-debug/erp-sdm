
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authorize } from '@/lib/auth';

// FORCE DYNAMIC: Agar data selalu fresh (real-time), tidak di-cache browser
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // 1. SECURITY: Pastikan hanya Owner/Manager/Finance yang bisa akses
    // authorize() otomatis ambil headers, cukup pass allowed roles
    const user = await authorize(['OWNER', 'MANAGER', 'FINANCE']);

    // authorize() throw error jika gagal, jadi code di bawah aman
    if (user.role === 'STAFF') {
      // Double check (walaupun sudah difilter di atas, guard extra ok)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tenantId = user.tenantId;
    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant ID missing' }, { status: 400 });
    }

    // 2. TIME SYNC: Gunakan Waktu Jakarta (Sama seperti Logic Absensi Baru)
    const now = new Date();
    const jakartaFormatter = new Intl.DateTimeFormat('id-ID', {
      timeZone: 'Asia/Jakarta',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour12: false
    });
    const parts = jakartaFormatter.formatToParts(now);
    const getPart = (type: string) => parts.find(p => p.type === type)?.value || '';
    const todayISO = `${getPart('year')}-${getPart('month')}-${getPart('day')}`;

    // 3. PARALLEL QUERY (TURBO MODE) ⚡
    const [
      totalEmployees,
      attendanceToday,
      activeProjects,
      pendingRequests,
      lateCount,
      overdueProjects
    ] = await Promise.all([
      // A. Total Karyawan
      prisma.user.count({ where: { tenantId, role: { not: 'OWNER' } } }),

      // B. Absensi Hari Ini
      prisma.attendance.count({ where: { tenantId, date: { startsWith: todayISO } } }),

      // C. Proyek Aktif
      prisma.project.count({ where: { tenantId, status: 'ON_GOING' } }),

      // D. Request Pending
      prisma.leaveRequest.count({ where: { tenantId, status: 'PENDING' } }),

      // E. Late Count
      prisma.attendance.count({ where: { tenantId, date: { startsWith: todayISO }, isLate: 1 } }),

      // F. Overdue Projects
      prisma.project.count({
        where: {
          tenantId,
          status: { not: 'DONE' },
          deadline: { lt: now } // Simple date comparison
        }
      })
    ]);

    // 4. RETURN HASIL
    return NextResponse.json({
      employees: totalEmployees,
      attendance: attendanceToday,
      projects: activeProjects,
      requests: pendingRequests,
      lateCount: lateCount,
      overdueProjects: overdueProjects,
      serverTime: todayISO
    });

  } catch (error: any) {
    console.error('[DASHBOARD_STATS_ERROR]', error);
    return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
  }
}
