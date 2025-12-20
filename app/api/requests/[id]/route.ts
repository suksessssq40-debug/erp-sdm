import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { authorize } from '@/lib/auth';

export async function PUT(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    await authorize(['OWNER', 'MANAGER']); // Only management can update status/edit requests generally
    const id = params.id;
    const r = await request.json();

    await pool.query(
      `UPDATE leave_requests SET type=$1, description=$2, start_date=$3, end_date=$4, attachment_url=$5, status=$6, created_at=$7 WHERE id=$8`,
      [r.type, r.description, r.startDate, r.endDate || r.startDate, r.attachmentUrl || null, r.status, r.createdAt, id]
    );

    return NextResponse.json(r);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
