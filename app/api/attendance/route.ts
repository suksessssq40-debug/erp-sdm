import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { authorize } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    await authorize();
    const a = await request.json();
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
