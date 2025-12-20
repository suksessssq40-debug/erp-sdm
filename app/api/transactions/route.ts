import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { authorize } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    await authorize(['OWNER', 'FINANCE']);
    const t = await request.json();
    await pool.query(
      `INSERT INTO transactions (id, date, amount, type, category, description, account, image_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [t.id, t.date, t.amount, t.type, t.category || null, t.description, t.account, t.imageUrl || null]
    );
    return NextResponse.json(t, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
