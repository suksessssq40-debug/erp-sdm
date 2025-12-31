import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { authorize } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const user = await authorize();
    const { searchParams } = new URL(request.url);
    const roomId = searchParams.get('roomId');
    const after = searchParams.get('after'); // timestamp
    const before = searchParams.get('before'); // timestamp for history pagination

    if (!roomId) return NextResponse.json({ error: 'Room ID required' }, { status: 400 });

    // Verify membership
    const membership = await pool.query('SELECT 1 FROM chat_members WHERE room_id=$1 AND user_id=$2', [roomId, user.id]);
    if (membership.rows.length === 0) {
      return NextResponse.json({ error: 'Not a member' }, { status: 403 });
    }

    let query = `
      SELECT m.*, 
             u.name as sender_name, u.role as sender_role,
             r.content as reply_content, r.sender_id as reply_sender_id,
             ru.name as reply_sender_name
      FROM chat_messages m
      LEFT JOIN users u ON m.sender_id = u.id
      LEFT JOIN chat_messages r ON m.reply_to_id = r.id
      LEFT JOIN users ru ON r.sender_id = ru.id
      WHERE m.room_id = $1
    `;
    const params: any[] = [roomId];

    if (before && Number(before) > 0) {
       // Load History: Messages OLDER than 'before'
       // Logic: Get 50 messages < before ORDER BY DESC (closest to before), then ASC them back
       query = `SELECT * FROM (${query} AND m.created_at < $2 ORDER BY m.created_at DESC LIMIT 50) sub ORDER BY sub.created_at ASC`;
       params.push(BigInt(before));
    } else if (after && Number(after) > 0) {
       // Load New: Messages NEWER than 'after'
       query += ` AND m.created_at > $2 ORDER BY m.created_at ASC`;
       params.push(BigInt(after));
    } else {
       // Initial Load: Last 50 messages
       query = `SELECT * FROM (${query} ORDER BY m.created_at DESC LIMIT 50) sub ORDER BY sub.created_at ASC`;
    }

    const res = await pool.query(query, params);

    const messages = res.rows.map(row => ({
      id: row.id,
      roomId: row.room_id,
      senderId: row.sender_id,
      content: row.content,
      attachmentUrl: row.attachment_url,
      replyToId: row.reply_to_id,
      replyToMessage: row.reply_to_id ? {
         id: row.reply_to_id,
         senderName: row.reply_sender_name || 'Unknown',
         content: row.reply_content || 'Message deleted'
      } : undefined,
      createdAt: Number(row.created_at),
      senderName: row.sender_name,
      senderRole: row.sender_role,
      isPinned: row.is_pinned || false
    }));

    // Fetch Read Status for Room (Realtime Update)
    const memberRes = await pool.query('SELECT user_id, last_read_at FROM chat_members WHERE room_id = $1', [roomId]);
    const readStatus: Record<string, number> = {};
    memberRes.rows.forEach(r => {
       if (r.last_read_at) readStatus[r.user_id] = Number(r.last_read_at);
    });

    return NextResponse.json({ messages, readStatus });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await authorize();
    const body = await request.json();
    const { roomId, content, attachmentUrl, replyToId } = body;

    if (!roomId || (!content && !attachmentUrl)) return NextResponse.json({ error: 'Invalid message' }, { status: 400 });

    // Basic membership check
    const membership = await pool.query('SELECT 1 FROM chat_members WHERE room_id=$1 AND user_id=$2', [roomId, user.id]);
    if (membership.rows.length === 0) {
      return NextResponse.json({ error: 'Not a member' }, { status: 403 });
    }

    const id = Math.random().toString(36).substr(2, 9);
    const createdAt = Date.now();

    await pool.query(
      'INSERT INTO chat_messages (id, room_id, sender_id, content, attachment_url, reply_to_id, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [id, roomId, user.id, content || '', attachmentUrl || '', replyToId || null, createdAt]
    );

    // Fetch sender details to return full object immediately
    const senderRes = await pool.query('SELECT name, role FROM users WHERE id = $1', [user.id]);
    const sender = senderRes.rows[0];

    // If reply exists, fetch basic reply info for immediate UI update
    let replyInfo = undefined;
    if (replyToId) {
       const replyRes = await pool.query(`
         SELECT m.content, u.name as sender_name 
         FROM chat_messages m 
         LEFT JOIN users u ON m.sender_id = u.id 
         WHERE m.id = $1
       `, [replyToId]);
       if (replyRes.rows.length > 0) {
          replyInfo = {
             id: replyToId,
             senderName: replyRes.rows[0].sender_name,
             content: replyRes.rows[0].content
          };
       }
    }

    return NextResponse.json({
       id, roomId, senderId: user.id, content, attachmentUrl, createdAt, 
       replyToId, replyToMessage: replyInfo,
       senderName: sender?.name || 'Unknown', senderRole: sender?.role || user.role 
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed to send' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const user = await authorize();
    const body = await request.json();
    const { messageId, content } = body;

    if (!messageId || !content) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });

    const msgCheck = await pool.query('SELECT sender_id FROM chat_messages WHERE id = $1', [messageId]);
    if (msgCheck.rows.length === 0) return NextResponse.json({ error: 'Message not found' }, { status: 404 });
    
    if (msgCheck.rows[0].sender_id !== user.id) {
       return NextResponse.json({ error: 'Unauthorized to edit' }, { status: 403 });
    }

    await pool.query('UPDATE chat_messages SET content = $1 WHERE id = $2', [content, messageId]);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
  }
}
