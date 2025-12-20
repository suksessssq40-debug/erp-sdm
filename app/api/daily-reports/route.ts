import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { authorize } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    await authorize();
    const r = await request.json();
    await pool.query(
      `INSERT INTO daily_reports (id, user_id, date, activities_json) VALUES ($1, $2, $3, $4)`,
      [r.id, r.userId, r.date, JSON.stringify(r.activities || [])]
    );
    return NextResponse.json(r, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
