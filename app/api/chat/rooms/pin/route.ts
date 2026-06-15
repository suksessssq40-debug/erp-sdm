
import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { authorize } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const user = await authorize();
    const body = await request.json();
    const { roomId } = body;

    if (!roomId) return NextResponse.json({ error: 'Room ID required' }, { status: 400 });

    // Check current pin status
    const res = await pool.query(
        'SELECT is_pinned FROM chat_members WHERE room_id = $1 AND user_id = $2',
        [roomId, user.id]
    );

    if (res.rows.length === 0) return NextResponse.json({ error: 'Not a member' }, { status: 403 });

    const currentPin = res.rows[0].is_pinned || false;
    const newPin = !currentPin;

    await pool.query(
        'UPDATE chat_members SET is_pinned = $1 WHERE room_id = $2 AND user_id = $3',
        [newPin, roomId, user.id]
    );

    return NextResponse.json({ success: true, isPinned: newPin });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed to toggle pin' }, { status: 500 });
  }
}
