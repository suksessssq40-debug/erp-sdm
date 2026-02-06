export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authorize } from '@/lib/auth';
import { calculateDistance } from '@/utils';
import { serialize, getJakartaNow, recordSystemLog } from '@/lib/serverUtils';

export async function GET(request: Request) {
  try {
    const user = await authorize();
    const { tenantId } = user;

    const isAdmin = ['OWNER', 'MANAGER', 'FINANCE', 'SUPERADMIN'].includes(user.role);
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('start');
    const endDate = searchParams.get('end');

    const targetUserId = searchParams.get('userId');

    const where: any = { tenantId };

    if (targetUserId) {
      // Security: Non-admins can only see their own data
      if (!isAdmin && targetUserId !== user.id) {
        return NextResponse.json({ error: 'Unauthorized view of other users' }, { status: 403 });
      }
      where.userId = targetUserId;
    } else {
      // Default behavior: Staff sees only self, Admin sees all
      if (!isAdmin) where.userId = user.id;
    }

    if (startDate && endDate) {
      where.date = { gte: startDate, lte: endDate };
    }

    const records = await prisma.attendance.findMany({
      where,
      orderBy: [
        { date: 'desc' },
        { timeIn: 'desc' }
      ],
      take: 200
    });

    return NextResponse.json(serialize(records));
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const userPayload = await authorize();
    const { tenantId } = userPayload;
    const a = await request.json();

    if (!a.location || typeof a.location.lat !== 'number' || typeof a.location.lng !== 'number') {
      return NextResponse.json({ error: 'Data lokasi tidak valid (GPS Required)' }, { status: 400 });
    }

    const jkt = getJakartaNow();
    let finalDateStr = jkt.isoDate;
    const serverTimeStr = jkt.isoTime;

    // NIGHT SHIFT LOGIC (Fixed for Consistency)
    // If hour < 6 AM, it belongs to the "Previous Working Day"
    const currentHourNum = parseInt(jkt.parts.hh);
    if (currentHourNum < 6) {
      const yesterday = new Date(jkt.isoDate); // Parse from Jakarta Date String
      yesterday.setDate(yesterday.getDate() - 1);
      finalDateStr = yesterday.toISOString().split('T')[0];
      console.log(`[SHIFT DETECTED] Before 06:00 WIB. Date rolled back to ${finalDateStr}`);
    }

    // ... (Tenant Check Code remains same, skipping for brevity in replacement) ...
    // We need to re-fetch tenant here if not including full block, 
    // BUT since we are replacing a block, let's keep the flow correct.

    // Validate Tenant & Settings
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { settings: true }
    });
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

    const strategy = tenant.workStrategy || 'FIXED';
    const radiusLimit = tenant.radiusTolerance || 50;
    const graceMinutes = tenant.lateGracePeriod || 15;
    const settings = tenant.settings;

    // Radius Check
    const user = await prisma.user.findUnique({ where: { id: userPayload.id } });
    if (user && !user.isFreelance && settings?.officeLat && settings?.officeLng) {
      const dist = calculateDistance(
        Number(a.location.lat),
        Number(a.location.lng),
        Number(settings.officeLat),
        Number(settings.officeLng)
      );

      if (dist > radiusLimit) {
        return NextResponse.json({
          error: `OUT_OF_RADIUS: ${Math.round(dist)}m from center (Limit: ${radiusLimit}m)`
        }, { status: 400 });
      }
    }

    // Late Calculation
    let isLateCalculated = false;
    let effectiveStartTime = '08:00';
    let shiftId = a.shiftId || null;

    if (strategy === 'FIXED') {
      effectiveStartTime = settings?.officeStartTime || '08:00';
    } else if (strategy === 'SHIFT') {
      if (!shiftId) return NextResponse.json({ error: 'Shift required for SHIFT strategy' }, { status: 400 });
      const shift = await prisma.shift.findUnique({ where: { id: shiftId } });
      if (!shift) return NextResponse.json({ error: 'Invalid Shift ID provided' }, { status: 400 });
      effectiveStartTime = shift.startTime;
    }

    if (strategy !== 'FLEXIBLE') {
      const [currH, currM] = serverTimeStr.split(':').map(Number);
      const [limitH, limitM] = effectiveStartTime.split(':').map(Number);
      let currTotal = currH * 60 + currM;
      const limitTotal = limitH * 60 + limitM;

      // Handle Overnight Shift Limit (e.g. start 23:00, now 00:15)
      // If Limit > 18:00 and Current < 06:00, add 24h to Current
      if (limitTotal > 1080 && currTotal < 360) currTotal += 1440;

      isLateCalculated = currTotal > (limitTotal + graceMinutes);
    }

    // FINAL CREATE (WITH createdAt!)
    const created = await prisma.attendance.create({
      data: {
        id: a.id,
        userId: userPayload.id,
        tenantId,
        date: finalDateStr,
        timeIn: serverTimeStr,
        isLate: isLateCalculated ? 1 : 0,
        lateReason: isLateCalculated ? (a.lateReason || 'Terlambat') : null,
        selfieUrl: a.selfieUrl,
        locationLat: a.location.lat,
        locationLng: a.location.lng,
        shiftId: shiftId,
        createdAt: new Date() // CRITICAL FIX: Add server timestamp for sorting
      }
    });

    await recordSystemLog({
      actorId: userPayload.id,
      actorName: userPayload.name,
      actorRole: userPayload.role,
      actionType: 'ATTENDANCE_IN',
      details: `Check-In pada ${serverTimeStr}${isLateCalculated ? ' (TERLAMBAT)' : ''}`,
      targetObj: 'Attendance',
      tenantId
    });

    return NextResponse.json(serialize(created), { status: 201 });
  } catch (error: any) {
    console.error("Attendance POST Error:", error);
    return NextResponse.json({ error: 'Internal Error', details: error.message }, { status: 500 });
  }
}

