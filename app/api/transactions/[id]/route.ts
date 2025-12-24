
import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { authorize } from '@/lib/auth';

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    // Owner and Finance can edit
    await authorize(['OWNER', 'FINANCE']);
    const id = params.id;
    const body = await request.json();

    // Prevent editing if not owner maybe? No, requested "Finance role also can".
    // Basic validation
    if (!body.amount || !body.account) {
        return NextResponse.json({ error: 'Invalid data' }, { status: 400 });
    }

    await pool.query(
      `UPDATE transactions 
       SET date = $1, amount = $2, type = $3, category = $4, description = $5, account = $6, image_url = $7
       WHERE id = $8`,
      [body.date, body.amount, body.type, body.category || null, body.description, body.account, body.imageUrl || null, id]
    );

    return NextResponse.json(body);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to update transaction' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    await authorize(['OWNER', 'FINANCE']);
    const id = params.id;

    await pool.query('DELETE FROM transactions WHERE id = $1', [id]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to delete transaction' }, { status: 500 });
  }
}
