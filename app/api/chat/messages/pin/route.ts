
import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { authorize } from '@/lib/auth';
import { UserRole } from '@/types';

export async function POST(request: Request) {
  try {
    const user = await authorize();
    const body = await request.json();
    const { messageId } = body;

    if (!messageId) return NextResponse.json({ error: 'Message ID required' }, { status: 400 });

    // Check message existence and sender
    // Allow OWNER, MANAGER to pin ANY message?
    // Allow Sender to pin THEIR own message?
    // Let's allow OWNER, MANAGER, and the Sender to pin.
    
    const msgCheck = await pool.query('SELECT room_id, sender_id, is_pinned FROM chat_messages WHERE id = $1', [messageId]);
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
    return NextResponse.json({ error: 'Failed to toggle pin' }, { status: 500 });
  }
}

export async function GET(request: Request) {
    // Get Pinned Message for a Room (Simple single sticky)
    try {
        await authorize();
        const { searchParams } = new URL(request.url);
        const roomId = searchParams.get('roomId');
        if (!roomId) return NextResponse.json({ error: 'Room ID required' }, { status: 400 });

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
