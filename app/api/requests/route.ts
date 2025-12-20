import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { authorize } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    await authorize();
    const r = await request.json();
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
