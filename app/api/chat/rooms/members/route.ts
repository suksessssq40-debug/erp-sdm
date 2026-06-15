import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { authorize } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const currentUser = await authorize();
    const { tenantId } = currentUser;
    const body = await request.json();
    const { roomId, userIds } = body;

    if (!roomId || !Array.isArray(userIds)) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });

    // Verify room belongs to tenant AND current user is a member
    const roomCheck = await pool.query(`
        SELECT 1 FROM chat_rooms r
        INNER JOIN chat_members cm ON r.id = cm.room_id
        WHERE r.id = $1 AND cm.user_id = $2 AND r.tenant_id = $3
    `, [roomId, currentUser.id, tenantId]);

    if (roomCheck.rows.length === 0) {
      return NextResponse.json({ error: 'Unauthorized to add members' }, { status: 403 });
    }

    // Insert new members - STRICT TENANT CHECK
    for (const uid of userIds) {
       // Only allow adding users within same tenant
       const userCheck = await pool.query('SELECT 1 FROM users WHERE id = $1 AND tenant_id = $2', [uid, tenantId]);
       if (userCheck.rows.length > 0) {
          await pool.query(
            'INSERT INTO chat_members (room_id, user_id, joined_at) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
            [roomId, uid, Date.now()]
          );
       }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
