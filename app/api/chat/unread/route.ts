import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { authorize } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const user = await authorize();
    
    // Count unread messages across all joined rooms efficiently
    // We join chat_messages with chat_members (for the current user)
    // Condition: message in a room I joined AND message created AFTER my last_read_at
    const res = await pool.query(`
      SELECT COUNT(m.id) as unread_count
      FROM chat_messages m
      INNER JOIN chat_members cm ON m.room_id = cm.room_id AND cm.user_id = $1
      WHERE m.created_at > COALESCE(cm.last_read_at, 0)
    `, [user.id]);
    
    const count = Number(res.rows[0]?.unread_count || 0);
    return NextResponse.json({ count });

  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed to fetch unread count' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  // Purpose: Mark a room as read (update last_read_at)
  try {
    const user = await authorize();
    const body = await request.json();
    const { roomId } = body;
    
    if (!roomId) return NextResponse.json({ error: 'Room ID required' }, { status: 400 });

    const now = Date.now();
    await pool.query(`
       UPDATE chat_members 
       SET last_read_at = $1 
       WHERE room_id = $2 AND user_id = $3
    `, [now, roomId, user.id]);

    return NextResponse.json({ success: true, lastReadAt: now });

  } catch (err) {
      console.error(err);
      return NextResponse.json({ error: 'Failed to mark as read' }, { status: 500 });
  }
}
