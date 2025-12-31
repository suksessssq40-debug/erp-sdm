import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { authorize } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const user = await authorize();
    // 1. AUTO-MIGRATION & LAZY INIT
    // Ensure tables exist before checking content. This fixes "Missing Table" error on Vercel/New Configs.
    await pool.query('BEGIN');
    try {
        await pool.query(`
          CREATE TABLE IF NOT EXISTS chat_rooms (
            id VARCHAR(50) PRIMARY KEY,
            name VARCHAR(100),
            type VARCHAR(20),
            created_by VARCHAR(50),
            created_at BIGINT
          );
          CREATE TABLE IF NOT EXISTS chat_members (
            room_id VARCHAR(50),
            user_id VARCHAR(50),
            joined_at BIGINT,
            PRIMARY KEY (room_id, user_id)
          );
          
          
          -- Upgrade Schema: Add last_read_at, is_pinned if missing
          DO $$
          BEGIN
              IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='chat_members' AND column_name='last_read_at') THEN
                  ALTER TABLE chat_members ADD COLUMN last_read_at BIGINT DEFAULT 0;
              END IF;
              
              IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='chat_members' AND column_name='is_pinned') THEN
                  ALTER TABLE chat_members ADD COLUMN is_pinned BOOLEAN DEFAULT FALSE;
              END IF;

              IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='chat_messages' AND column_name='is_pinned') THEN
                  ALTER TABLE chat_messages ADD COLUMN is_pinned BOOLEAN DEFAULT FALSE;
              END IF;
          END
          $$;

          CREATE TABLE IF NOT EXISTS chat_messages (
            id VARCHAR(50) PRIMARY KEY,
            room_id VARCHAR(50),
            sender_id VARCHAR(50),
            content TEXT,
            attachment_url TEXT,
            reply_to_id VARCHAR(50),
            created_at BIGINT,
            is_pinned BOOLEAN DEFAULT FALSE
          );
        `);

        // Check General Room
        const checkGeneral = await pool.query("SELECT 1 FROM chat_rooms WHERE id = 'general'");
        if (checkGeneral.rows.length === 0) {
           console.log("Initializing Default General Room...");
           await pool.query(
            "INSERT INTO chat_rooms (id, name, type, created_by, created_at) VALUES ($1, $2, $3, $4, $5)",
            ['general', 'General Forum', 'GROUP', 'system', Date.now()]
           );
           // Auto-enroll all current users
           const allUsers = await pool.query("SELECT id FROM users");
           for (const u of allUsers.rows) {
             await pool.query(
               "INSERT INTO chat_members (room_id, user_id, joined_at) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING",
               ['general', u.id, Date.now()]
             );
           }
        }
        await pool.query('COMMIT');
    } catch (e) {
        await pool.query('ROLLBACK');
        console.error("Auto-migration failed:", e);
    }

    // Get rooms where user is member
    const res = await pool.query(`
      SELECT r.*, 
             COALESCE(
               (SELECT json_agg(user_id) FROM chat_members WHERE room_id = r.id), '[]'
             ) as member_ids,
             (SELECT json_build_object('content', content, 'senderName', (SELECT name FROM users WHERE id = chat_messages.sender_id), 'timestamp', created_at) 
              FROM chat_messages WHERE room_id = r.id ORDER BY created_at DESC LIMIT 1) as last_message,
             (SELECT COUNT(*)::int FROM chat_messages 
              WHERE room_id = r.id 
              AND created_at > COALESCE(cm.last_read_at, 0)) as unread_count,
             (SELECT json_object_agg(user_id, last_read_at) FROM chat_members WHERE room_id = r.id) as read_status,
             COALESCE(cm.is_pinned, FALSE) as is_pinned_room
      FROM chat_rooms r
      INNER JOIN chat_members cm ON r.id = cm.room_id
      WHERE cm.user_id = $1
      ORDER BY 
        cm.is_pinned DESC,
        CASE WHEN (SELECT created_at FROM chat_messages WHERE room_id = r.id ORDER BY created_at DESC LIMIT 1) IS NOT NULL 
        THEN (SELECT created_at FROM chat_messages WHERE room_id = r.id ORDER BY created_at DESC LIMIT 1)
        ELSE r.created_at END DESC
    `, [user.id]);
    
    // Transform to match interface
    const rooms = res.rows.map(row => ({
      id: row.id,
      name: row.name,
      type: row.type,
      createdBy: row.created_by,
      createdAt: Number(row.created_at),
      memberIds: row.member_ids,
      lastMessage: row.last_message ? {
         content: row.last_message.content,
         senderName: row.last_message.senderName || 'Unknown',
         timestamp: Number(row.last_message.timestamp)
      } : undefined,
      unreadCount: Number(row.unread_count || 0),
      readStatus: row.read_status || {},
      isPinned: row.is_pinned_room
    }));

    return NextResponse.json(rooms);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed to fetch rooms' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await authorize();
    const body = await request.json();
    const { name, type, memberIds } = body; // memberIds is array of string

    if (!name) return NextResponse.json({ error: 'Name required' }, { status: 400 });

    const roomId = Math.random().toString(36).substr(2, 9);
    const createdAt = Date.now();

    await pool.query('BEGIN');
    
    await pool.query(
      'INSERT INTO chat_rooms (id, name, type, created_by, created_at) VALUES ($1, $2, $3, $4, $5)',
      [roomId, name, type || 'GROUP', user.id, createdAt]
    );

    // Add creator
    await pool.query(
      'INSERT INTO chat_members (room_id, user_id, joined_at) VALUES ($1, $2, $3)',
      [roomId, user.id, createdAt]
    );

    // Add other members
    if (Array.isArray(memberIds)) {
      for (const mid of memberIds) {
        if (mid !== user.id) {
           await pool.query(
             'INSERT INTO chat_members (room_id, user_id, joined_at) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
             [roomId, mid, createdAt]
           );
        }
      }
    }

    await pool.query('COMMIT');
    
    return NextResponse.json({ id: roomId, name, type, createdBy: user.id, createdAt, memberIds: [user.id, ...(memberIds || [])] });
  } catch (err) {
    await pool.query('ROLLBACK');
    console.error(err);
    return NextResponse.json({ error: 'Failed to create room' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await authorize();
    const { searchParams } = new URL(request.url);
    const roomId = searchParams.get('id');

    if (!roomId) return NextResponse.json({ error: 'Room ID required' }, { status: 400 });
    if (roomId === 'general') return NextResponse.json({ error: 'Cannot delete general room' }, { status: 403 });

    // Allow ANY user to delete (as requested: "semua user bisa hapus")
    // But logically, they should at least be a member or it should exist
    const roomCheck = await pool.query('SELECT 1 FROM chat_rooms WHERE id = $1', [roomId]);
    if (roomCheck.rows.length === 0) return NextResponse.json({ error: 'Room not found' }, { status: 404 });

    await pool.query('BEGIN');
    await pool.query('DELETE FROM chat_messages WHERE room_id = $1', [roomId]);
    await pool.query('DELETE FROM chat_members WHERE room_id = $1', [roomId]);
    await pool.query('DELETE FROM chat_rooms WHERE id = $1', [roomId]);
    await pool.query('COMMIT');

    return NextResponse.json({ success: true, id: roomId });
  } catch (err) {
    await pool.query('ROLLBACK');
    console.error(err);
    return NextResponse.json({ error: 'Failed to delete room' }, { status: 500 });
  }
}
