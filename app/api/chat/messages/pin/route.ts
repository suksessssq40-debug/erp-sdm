
import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { authorize } from '@/lib/auth';
import { UserRole } from '@/types';

export async function POST(request: Request) {
  try {
    const user = await authorize();
    const { tenantId } = user;
    const body = await request.json();
    const { messageId } = body;

    if (!messageId) return NextResponse.json({ error: 'Message ID required' }, { status: 400 });

    // Verify message exists and room belongs to tenant
    const msgCheck = await pool.query(`
        SELECT m.room_id, m.sender_id, m.is_pinned 
        FROM chat_messages m
        INNER JOIN chat_rooms r ON m.room_id = r.id
        WHERE m.id = $1 AND r.tenant_id = $2
    `, [messageId, tenantId]);

    if (msgCheck.rows.length === 0) return NextResponse.json({ error: 'Message not found' }, { status: 404 });
    
    const msg = msgCheck.rows[0];
    const canPin = user.role === UserRole.OWNER || user.role === UserRole.MANAGER || msg.sender_id === user.id;

    if (!canPin) {
       return NextResponse.json({ error: 'Unauthorized to pin' }, { status: 403 });
    }

    const newPin = !(msg.is_pinned || false);

    await pool.query(
        'UPDATE chat_messages SET is_pinned = $1 WHERE id = $2',
        [newPin, messageId]
    );

    return NextResponse.json({ success: true, isPinned: newPin, roomId: msg.room_id });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function GET(request: Request) {
    try {
        const user = await authorize();
        const { tenantId } = user;
        const { searchParams } = new URL(request.url);
        const roomId = searchParams.get('roomId');
        if (!roomId) return NextResponse.json({ error: 'Room ID required' }, { status: 400 });

        // Verify room belongs to tenant
        const roomCheck = await pool.query('SELECT 1 FROM chat_rooms WHERE id = $1 AND tenant_id = $2', [roomId, tenantId]);
        if (roomCheck.rows.length === 0) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

        const res = await pool.query(`
            SELECT m.*, u.name as sender_name 
            FROM chat_messages m
            LEFT JOIN users u ON m.sender_id = u.id
            WHERE m.room_id = $1 AND m.is_pinned = TRUE
            ORDER BY m.created_at DESC
            LIMIT 1
        `, [roomId]);

        if (res.rows.length === 0) return NextResponse.json({ pinnedMessage: null });

        const row = res.rows[0];
        return NextResponse.json({
            pinnedMessage: {
                id: row.id,
                content: row.content,
                senderName: row.sender_name,
                createdAt: Number(row.created_at)
            }
        });

    } catch (err) {
        return NextResponse.json({ error: 'Failed' }, { status: 500 });
    }
}
