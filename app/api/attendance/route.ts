import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { authorize } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    await authorize();
    const a = await request.json();

    // SERVER-SIDE GEOFENCING VALIDATION
    // Fetch office location source of truth from DB
    const resSettings = await pool.query('SELECT office_lat, office_lng FROM settings LIMIT 1');
    if (resSettings.rows.length > 0) {
       const { office_lat, office_lng } = resSettings.rows[0];
       const R = 6371e3; // metres
       const φ1 = a.location.lat * Math.PI/180;
       const φ2 = office_lat * Math.PI/180;
       const Δφ = (office_lat - a.location.lat) * Math.PI/180;
       const Δλ = (office_lng - a.location.lng) * Math.PI/180;

       const haversine = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
                Math.cos(φ1) * Math.cos(φ2) *
                Math.sin(Δλ/2) * Math.sin(Δλ/2);
       const c = 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1-haversine));
       const dist = R * c;

       // Hardcoded 500m tolerance (or strictly match OFFICE_RADIUS_METERS constant)
       // Giving slightly more buffer on server side (e.g. 100m) to account for GPS jitter
       if (dist > 10) { 
          return NextResponse.json(
            { error: 'GEOFENCE_VIOLATION', message: `Lokasi tidak valid. Jarak ke kantor: ${Math.round(dist)}m. Batas Maksimal: 10m` }, 
            { status: 403 }
          );
       }
    }

    await pool.query(
      `INSERT INTO attendance (id, user_id, date, time_in, time_out, is_late, late_reason, selfie_url, checkout_selfie_url, location_lat, location_lng)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        a.id, a.userId, a.date, a.timeIn, a.timeOut || null, a.isLate ? 1 : 0,
        a.lateReason || null, a.selfieUrl, a.checkOutSelfieUrl || null, a.location.lat, a.location.lng
      ]
    );
    return NextResponse.json(a, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
