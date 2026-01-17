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
  } catch(e) {
      console.error(e);
      return NextResponse.json({ error: 'Failed to fetch attendance' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const payload = await authorize();
    const { tenantId } = payload;
    const a = await request.json();

    const now = new Date();
    const jakartaTime = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Jakarta" }));
    
    const serverTimeStr = jakartaTime.toLocaleTimeString('id-ID', { hour12: false, hour: '2-digit', minute: '2-digit' }).replace(/\./g, ':');
    const serverDateStr = jakartaTime.toDateString(); 

    // Settings for this Tenant
    const settings = await prisma.settings.findFirst({ where: { tenantId } });
    const startHour = settings?.officeStartTime || '08:00';

    // User check within Tenant
    const user = await prisma.user.findUnique({ 
        where: { id: payload.id, tenantId } // Security: Must match tenant
    } as any);
    
    if (user && !user.isFreelance && settings?.officeLat && settings?.officeLng) {
       const dist = calculateDistance(
          Number(a.location.lat), 
          Number(a.location.lng),
          Number(settings.officeLat), 
          Number(settings.officeLng)
       );
       
       if (dist > OFFICE_RADIUS_METERS) {
          return NextResponse.json({ 
             error: `GAGAL: Lokasi Anda terdeteksi ${Math.round(dist)}m dari kantor. Batas radius adalah ${OFFICE_RADIUS_METERS}m.` 
          }, { status: 400 });
       }
    }
    
    const [h, m] = serverTimeStr.split(':').map(Number);
    const [limitH, limitM] = startHour.split(':').map(Number);
    const isLateCalculated = (h > limitH) || (h === limitH && m > limitM);

    const attendanceData: any = {
        id: a.id,
        userId: a.userId,
        date: serverDateStr,
        timeIn: serverTimeStr,
        timeOut: null,
        isLate: (isLateCalculated ? 1 : 0) as any,
        lateReason: isLateCalculated ? (a.lateReason || 'Terlambat') : null,
        selfieUrl: a.selfieUrl,
        checkoutSelfieUrl: null,
        locationLat: a.location.lat,
        locationLng: a.location.lng,
        createdAt: new Date() // Explicitly set timestamp to prevent NULLs
    };

    try {
        await prisma.attendance.create({
            data: { ...attendanceData, tenantId }
        });
    } catch (err) {
        console.error("Attendance Create Error:", err);
        return NextResponse.json({ error: 'Gagal mencatat absensi' }, { status: 500 });
    }

    return NextResponse.json(a, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
