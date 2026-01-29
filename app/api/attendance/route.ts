import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authorize } from '@/lib/auth';
import { calculateDistance } from '@/utils';
import { OFFICE_RADIUS_METERS } from '@/constants';

export async function GET(request: Request) {
  try {
    const user = await authorize();
    const { tenantId } = user;

    // Admin sees all in tenant, Staff sees own in tenant
    const isAdmin = ['OWNER', 'MANAGER', 'FINANCE', 'SUPERADMIN'].includes(user.role);

    let records: any[] = [];
    try {
      const where: any = { tenantId };
      if (!isAdmin) where.userId = user.id;

      records = await prisma.attendance.findMany({
        where,
        orderBy: [
          { createdAt: 'desc' }, // Primary sort by timestamp
          { date: 'desc' },      // Fallback
          { timeIn: 'desc' }
        ],
        take: 200 // Increased limit to ensure we catch recent items
      });
    } catch (e) {
      console.error("Attendance Fetch Error:", e);
      return NextResponse.json({ error: 'Failed to fetch attendance' }, { status: 500 });
    }

    const formatted = records.map(a => ({
      id: a.id,
      userId: a.userId,
      tenantId: (a as any).tenantId,
      date: a.date,
      timeIn: a.timeIn,
      timeOut: a.timeOut || undefined,
      isLate: !!a.isLate,
      lateReason: a.lateReason || undefined,
      selfieUrl: a.selfieUrl,
      checkOutSelfieUrl: a.checkoutSelfieUrl || undefined,
      location: { lat: Number(a.locationLat), lng: Number(a.locationLng) },
      createdAt: a.createdAt ? new Date(a.createdAt).getTime() : undefined
    }));

    return NextResponse.json(formatted);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to fetch attendance' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const payload = await authorize();
    const { tenantId } = payload;
    const a = await request.json();

    // 🛡️ SECURITY: Sanity Check Input
    if (!a.location || typeof a.location.lat !== 'number' || typeof a.location.lng !== 'number') {
      return NextResponse.json({ error: 'Data lokasi tidak valid (Wajib GPS)' }, { status: 400 });
    }

    const now = new Date();
    // Gunakan Intl.DateTimeFormat untuk mendapatkan waktu Jakarta yang akurat
    const jakartaFormatter = new Intl.DateTimeFormat('id-ID', {
      timeZone: 'Asia/Jakarta',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });

    // Parse parts manually to avoid locale format issues (DD/MM/YYYY vs MM/DD/YYYY)
    const parts = jakartaFormatter.formatToParts(now);
    const getPart = (type: string) => parts.find(p => p.type === type)?.value || '';

    const yyyy = getPart('year');
    const mm = getPart('month');
    const dd = getPart('day');
    const hh = getPart('hour');
    const min = getPart('minute'); // Changed from 'min' to 'minute' based on Intl standard type

    // 1. STANDARD ISO DATE (YYYY-MM-DD) - Kunci Laporan Akurat
    let finalDateStr = `${yyyy}-${mm}-${dd}`;
    const serverTimeStr = `${hh}:${min}`;

    // 2. NIGHT SHIFT LOGIC (Penyelamat Shift Malam)
    // Jika Check-In dilakukan sebelum jam 06:00 pagi, anggap masuk shift hari kemarin.
    // Contoh: Masuk jam 01:00 pagi tanggal 22, dihitung shift tanggal 21.
    const currentHourNum = parseInt(hh);
    if (currentHourNum < 6) {
      // Rollback 1 hari
      const yesterday = new Date(now);
      yesterday.setHours(now.getHours() - 24); // Mundur 24 jam aman

      // Re-format yesterday
      const yParts = jakartaFormatter.formatToParts(yesterday);
      const yGet = (type: string) => yParts.find(p => p.type === type)?.value || '';
      finalDateStr = `${yGet('year')}-${yGet('month')}-${yGet('day')}`;
      console.log(`[SHIFT DETECTED] Rolling back date to ${finalDateStr} (Action at ${serverTimeStr})`);
    }

    // 1. Fetch Tenant Configuration
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { settings: true }
    });

    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

    const strategy = tenant.workStrategy || 'FIXED';
    const radiusLimit = tenant.radiusTolerance || 50;
    const graceMinutes = tenant.lateGracePeriod || 15;
    const settings = tenant.settings;

    // 2. Location Validation (Only for STAFF and non-Flexible if needed, but let's apply to non-Freelance)
    const user = await prisma.user.findUnique({ where: { id: payload.id } });
    if (user && !user.isFreelance && settings?.officeLat && settings?.officeLng) {
      const dist = calculateDistance(
        Number(a.location.lat),
        Number(a.location.lng),
        Number(settings.officeLat),
        Number(settings.officeLng)
      );

      if (dist > radiusLimit) {
        return NextResponse.json({
          error: `GAGAL: Lokasi Anda terdeteksi ${Math.round(dist)}m dari kantor. Batas radius adalah ${radiusLimit}m.`
        }, { status: 400 });
      }
    }

    // 3. Late Calculation based on Strategy
    let isLateCalculated = false;
    let effectiveStartTime = '08:00';
    let shiftId = a.shiftId || null;

    if (strategy === 'FIXED') {
      effectiveStartTime = settings?.officeStartTime || '08:00';
    } else if (strategy === 'SHIFT') {
      if (!shiftId) return NextResponse.json({ error: 'Shift ID is required for this unit' }, { status: 400 });
      const shift = await prisma.shift.findUnique({ where: { id: shiftId } });
      if (!shift) return NextResponse.json({ error: 'Invalid Shift ID' }, { status: 400 });
      effectiveStartTime = shift.startTime;
    } else if (strategy === 'FLEXIBLE') {
      isLateCalculated = false; // No lateness in flexible mode
    }

    if (strategy !== 'FLEXIBLE') {
      const [currH, currM] = serverTimeStr.split(':').map(Number);
      const [limitH, limitM] = effectiveStartTime.split(':').map(Number);

      let currTotal = currH * 60 + currM;
      const limitTotal = limitH * 60 + limitM;

      // LOGIC FIX: Handle Overnight Late Calculation
      // If shift starts in the evening (e.g. 22:00) and user comes after midnight (e.g. 01:00)
      if (limitTotal > 1080 && currTotal < 360) {
        currTotal += 1440; // Add 24 hours to normalize comparison
      }

      isLateCalculated = currTotal > (limitTotal + graceMinutes);
    }

    const attendanceData: any = {
      id: a.id,
      userId: payload.id,
      tenantId,
      date: finalDateStr, // NOW USING ISO YYYY-MM-DD
      timeIn: serverTimeStr,
      timeOut: null,
      isLate: isLateCalculated ? 1 : 0,
      lateReason: isLateCalculated ? (a.lateReason || 'Terlambat') : null,
      selfieUrl: a.selfieUrl,
      locationLat: a.location.lat,
      locationLng: a.location.lng,
      shiftId: shiftId,
      createdAt: new Date()
    };

    const created = await prisma.attendance.create({
      data: attendanceData
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error("Attendance POST Error:", error);
    return NextResponse.json({ error: 'Failed to record attendance' }, { status: 500 });
  }
}
