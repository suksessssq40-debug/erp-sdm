import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authorize } from '@/lib/auth';

/**
 * Helper: hitung jumlah workdays (Senin-Jumat) dalam rentang tanggal
 */
function countWorkdays(start: Date, end: Date): number {
  let count = 0;
  const current = new Date(start);
  current.setHours(0, 0, 0, 0);
  const endDate = new Date(end);
  endDate.setHours(23, 59, 59, 999);

  while (current <= endDate) {
    const day = current.getDay();
    if (day !== 0 && day !== 6) count++; // 0=Minggu, 6=Sabtu
    current.setDate(current.getDate() + 1);
  }
  return count;
}

/**
 * Helper: generate semua tanggal dalam rentang
 */
function getAllDatesInRange(start: Date, end: Date): string[] {
  const dates: string[] = [];
  const current = new Date(start);
  current.setHours(0, 0, 0, 0);
  const endDate = new Date(end);
  endDate.setHours(23, 59, 59, 999);

  while (current <= endDate) {
    const y = current.getFullYear();
    const m = String(current.getMonth() + 1).padStart(2, '0');
    const d = String(current.getDate()).padStart(2, '0');
    dates.push(`${y}-${m}-${d}`);
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

export async function GET(request: Request) {
  try {
    // Allow any authenticated user, then check permissions manually
    const user = await authorize();
    const { tenantId } = user;
    const isAdmin = ['OWNER', 'MANAGER', 'FINANCE', 'SUPERADMIN'].includes(user.role);

    // Check if user is Kaizen Master (also gets full access)
    const actorUser = await prisma.user.findUnique({ where: { id: user.id } });
    const isKaizenMaster = !!(actorUser as any)?.isKaizenMaster;
    const hasFullAccess = isAdmin || isKaizenMaster;

    // Deny access if not admin or kaizen master
    if (!hasFullAccess) {
      return NextResponse.json({ error: 'Forbidden: Akses ditolak' }, { status: 403 });
    }

    // Parse query params
    const url = new URL(request.url);
    const startDateStr = url.searchParams.get('startDate');
    const endDateStr = url.searchParams.get('endDate');

    if (!startDateStr || !endDateStr) {
      return NextResponse.json(
        { error: 'Parameter startDate dan endDate wajib diisi (format: YYYY-MM-DD)' },
        { status: 400 }
      );
    }

    const startDate = new Date(startDateStr);
    const endDate = new Date(endDateStr);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return NextResponse.json(
        { error: 'Format tanggal tidak valid. Gunakan YYYY-MM-DD.' },
        { status: 400 }
      );
    }

    // Validasi: startDate tidak boleh setelah endDate
    if (startDate > endDate) {
      return NextResponse.json(
        { error: 'Tanggal mulai tidak boleh setelah tanggal akhir.' },
        { status: 400 }
      );
    }

    // Validasi: batasi maksimal rentang 365 hari
    const diffDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays > 365) {
      return NextResponse.json(
        { error: 'Rentang tanggal maksimal 365 hari.' },
        { status: 400 }
      );
    }

    // Hitung total workdays
    const totalWorkdays = countWorkdays(startDate, endDate);

    // Ambil user dalam tenant (admin/kaizen lihat semua, staff lihat sendiri)
    // Exclude OWNER, SUPERADMIN from summary (they don't do regular attendance)
    // Only include active users (isActive = true)
    const users = await prisma.user.findMany({
      where: {
        tenantId,
        isActive: true,
        role: { notIn: ['OWNER', 'SUPERADMIN'] },
        ...(hasFullAccess ? {} : { id: user.id }),
      } as any,
      select: {
        id: true,
        name: true,
        username: true,
        role: true,
        jobTitle: true,
      },
    });

    // Ambil attendance dalam rentang
    const attendanceRecords = await prisma.attendance.findMany({
      where: {
        tenantId,
        date: {
          gte: startDateStr,
          lte: endDateStr,
        },
        ...(hasFullAccess ? {} : { userId: user.id }),
      },
      select: {
        id: true,
        userId: true,
        date: true,
        timeIn: true,
        isLate: true,
      },
    });

    // Ambil LeaveRequest type=IZIN, status=APPROVED dalam rentang
    const leaveRequests = await prisma.leaveRequest.findMany({
      where: {
        tenantId,
        type: 'IZIN',
        status: 'APPROVED',
        // LeaveRequest uses startDate/endDate as Date fields in DB
        // We need to find leaves that intersect with the report date range
        startDate: { lte: new Date(endDateStr + 'T23:59:59Z') },
        endDate: { gte: new Date(startDateStr + 'T00:00:00Z') },
        ...(hasFullAccess ? {} : { userId: user.id }),
      },
      select: {
        id: true,
        userId: true,
        startDate: true,
        endDate: true,
      },
    });

    // Build per-user summary
    const report = users.map((u: any) => {
      // Attendance dates (unique)
      const userCheckins = attendanceRecords
        .filter(a => a.userId === u.id)
        .map(a => a.date);

      const uniqueDates = new Set<string>();
      userCheckins.forEach(d => { if (d) uniqueDates.add(d); });
      const uniqueCheckinDates = Array.from(uniqueDates).sort();

      // Leave dates: untuk setiap leave request, generate semua tanggal dalam rentangnya
      const leaveDatesSet = new Set<string>();
      leaveRequests
        .filter(lr => lr.userId === u.id)
        .forEach(lr => {
          const lrStart = lr.startDate ? new Date(lr.startDate) : null;
          const lrEnd = lr.endDate ? new Date(lr.endDate) : null;
          if (lrStart && lrEnd) {
            // Intersect leave range with report range
            const effectiveStart = lrStart > startDate ? lrStart : startDate;
            const effectiveEnd = lrEnd < endDate ? lrEnd : endDate;
            const dates = getAllDatesInRange(effectiveStart, effectiveEnd);
            dates.forEach(d => leaveDatesSet.add(d));
          }
        });

      const leaveDates = Array.from(leaveDatesSet).sort();

      // Filter leave dates to only workdays
      const workdayLeaveDates = leaveDates.filter(d => {
        const day = new Date(d).getDay();
        return day !== 0 && day !== 6;
      });

      const hadir = uniqueCheckinDates.length;
      const izin = workdayLeaveDates.length;
      const absen = Math.max(0, totalWorkdays - hadir - izin);

      // Count late days
      const userLateRecords = attendanceRecords
        .filter(a => a.userId === u.id && a.isLate === 1);
      const lateDatesSet = new Set<string>();
      userLateRecords.forEach(a => { if (a.date) lateDatesSet.add(a.date); });
      const terlambat = lateDatesSet.size;

      return {
        userId: u.id,
        nama: u.name || u.username,
        jabatan: u.jobTitle || '-',
        role: u.role,
        hadir,
        izin,
        absen,
        terlambat,
        tanggalHadir: uniqueCheckinDates,
        tanggalIzin: leaveDates.filter(d => {
          const day = new Date(d).getDay();
          return day !== 0 && day !== 6;
        }),
        totalWorkdays,
      };
    });

    return NextResponse.json({
      totalWorkdays,
      startDate: startDateStr,
      endDate: endDateStr,
      users: report,
    });
  } catch (e) {
    console.error('Attendance Report Error:', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'Gagal mengambil data laporan absensi' }, { status: 500 });
  }
}
