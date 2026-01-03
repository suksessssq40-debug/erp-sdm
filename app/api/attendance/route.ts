import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authorize } from '@/lib/auth';
import { calculateDistance } from '@/utils';
import { OFFICE_RADIUS_METERS } from '@/constants';

export async function POST(request: Request) {
  try {
    const payload = await authorize();
    const a = await request.json();

    // --- HARDENING: SERVER TIME ENFORCEMENT ---
    const now = new Date();
    const jakartaTime = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Jakarta" }));
    
    // Format: "08:30" (HH:mm)
    const serverTimeStr = jakartaTime.toLocaleTimeString('id-ID', { hour12: false, hour: '2-digit', minute: '2-digit' }).replace(/\./g, ':');
    const serverDateStr = jakartaTime.toDateString(); // "Wed Dec 27 2023"

    // Calculate Late Status (Server Side)
    const settings = await prisma.settings.findFirst();
    const startHour = settings?.officeStartTime || '08:00';

    // --- SECURITY: RADIUS VALIDATION ---
    // Fetch full user to check 'isFreelance' status
    const user = await prisma.user.findUnique({ where: { id: payload.id } });
    
    if (user && !user.isFreelance && settings?.officeLat && settings?.officeLng) {
       const dist = calculateDistance(
          Number(a.location.lat), 
          Number(a.location.lng),
          Number(settings.officeLat), 
          Number(settings.officeLng)
       );
       
       // Allow slight buffer for GPS drift (e.g. 50m hard limit from constants)
       if (dist > OFFICE_RADIUS_METERS) {
          return NextResponse.json({ 
             error: `GAGAL: Lokasi Anda terdeteksi ${Math.round(dist)}m dari kantor. Batas radius adalah ${OFFICE_RADIUS_METERS}m. Harap mendekat ke kantor.` 
          }, { status: 400 });
       }
    }
    
    // Compare H:mStrings
    const [h, m] = serverTimeStr.split(':').map(Number);
    const [limitH, limitM] = startHour.split(':').map(Number);
    const isLateCalculated = (h > limitH) || (h === limitH && m > limitM);

    await prisma.attendance.create({
      data: {
        id: a.id, // ID from client is okay for optimistic UI, or consider UUID()
        userId: a.userId,
        date: serverDateStr, // SERVER DATE
        timeIn: serverTimeStr, // SERVER TIME
        timeOut: null,
        isLate: (isLateCalculated ? 1 : 0) as any, // SERVER LOGIC
        lateReason: isLateCalculated ? (a.lateReason || 'Terlambat') : null,
        selfieUrl: a.selfieUrl,
        checkoutSelfieUrl: null,
        locationLat: a.location.lat,
        locationLng: a.location.lng
      }
    });

    return NextResponse.json(a, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
