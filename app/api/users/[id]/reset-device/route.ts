import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { authorize } from '@/lib/auth';

export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    await authorize(['OWNER', 'MANAGER', 'FINANCE']);
    const id = params.id;
    // Reset both legacy and new array
    await pool.query("UPDATE users SET device_id = NULL, device_ids = '[]' WHERE id = $1", [id]);
    return NextResponse.json({ message: 'Device reset' });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
