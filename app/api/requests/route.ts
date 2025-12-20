import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { authorize } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    await authorize();
    const r = await request.json();

    // SERVER-SIDE VALIDATION
    // 1. Logic Date Validation
    if (new Date(r.endDate || r.startDate) < new Date(r.startDate)) {
       return NextResponse.json({ error: 'INVALID_DATE', message: 'Tanggal selesai tidak boleh sebelum tanggal mulai.' }, { status: 400 });
    }

    // 2. Mandatory Proof Validation
    if ((r.type === 'SAKIT' || r.type === 'CUTI') && !r.attachmentUrl) {
       return NextResponse.json({ error: 'MISSING_PROOF', message: 'Wajib melampirkan bukti untuk SAKIT atau CUTI.' }, { status: 400 });
    }

    await pool.query(
      `INSERT INTO leave_requests (id, user_id, type, description, start_date, end_date, attachment_url, status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [r.id, r.userId, r.type, r.description, r.startDate, r.endDate || r.startDate, r.attachmentUrl || null, r.status, r.createdAt]
    );
    return NextResponse.json(r, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
