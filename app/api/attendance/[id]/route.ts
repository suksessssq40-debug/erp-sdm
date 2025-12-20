import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { authorize } from '@/lib/auth';

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    await authorize();
    const id = params.id;
    const a = await request.json();

    await pool.query(
      `UPDATE attendance SET time_in=$1, time_out=$2, is_late=$3, late_reason=$4, selfie_url=$5, checkout_selfie_url=$6, location_lat=$7, location_lng=$8 WHERE id=$9`,
      [
        a.timeIn, a.timeOut || null, a.isLate ? 1 : 0, a.lateReason || null,
        a.selfieUrl, a.checkOutSelfieUrl || null, a.location.lat, a.location.lng, id
      ]
    );

    return NextResponse.json(a);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
