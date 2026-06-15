import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { authorize } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const user = await authorize();
    const { tenantId } = user;
    
    // 1. AUTO-MIGRATION & LAZY INIT
    // Ensure tables exist before checking content. This fixes "Missing Table" error on Vercel/New Configs.
    await pool.query('BEGIN');
    try {
        await pool.query(`
          CREATE TABLE IF NOT EXISTS chat_rooms (
            id VARCHAR(50) PRIMARY KEY,
            tenant_id VARCHAR(50) DEFAULT 'sdm',
            name VARCHAR(100),
            type VARCHAR(20),
            created_by VARCHAR(50),
            created_at BIGINT
          );
          
          -- Upgrade: add tenant_id if missing
          DO $$
          BEGIN
              IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='chat_rooms' AND column_name='tenant_id') THEN
                  ALTER TABLE chat_rooms ADD COLUMN tenant_id VARCHAR(50) DEFAULT 'sdm';
              END IF;
          END
          $$;

          CREATE TABLE IF NOT EXISTS chat_members (
            room_id VARCHAR(50),
            user_id VARCHAR(50),
            joined_at BIGINT,
            PRIMARY KEY (room_id, user_id)
          );
          
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

        // Check General Room for THIS Tenant
        const generalRoomId = `general-${tenantId}`;
        const checkGeneral = await pool.query("SELECT 1 FROM chat_rooms WHERE id = $1 AND tenant_id = $2", [generalRoomId, tenantId]);
        if (checkGeneral.rows.length === 0) {
           console.log(`Initializing General Forum for tenant: ${tenantId}`);
           await pool.query(
            "INSERT INTO chat_rooms (id, tenant_id, name, type, created_by, created_at) VALUES ($1, $2, $3, $4, $5, $6)",
            [generalRoomId, tenantId, 'General Forum', 'GROUP', 'system', Date.now()]
           );
           // Auto-enroll all users of THIS tenant
           const tenantUsers = await pool.query("SELECT id FROM users WHERE tenant_id = $1", [tenantId]);
           for (const u of tenantUsers.rows) {
             await pool.query(
               "INSERT INTO chat_members (room_id, user_id, joined_at) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING",
               [generalRoomId, u.id, Date.now()]
             );
           }
        }
        await pool.query('COMMIT');
    } catch (e) {
        await pool.query('ROLLBACK');
        console.error("Chat migration failed:", e);
    }

    // Get rooms where user is member AND room belongs to user tenant
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
      WHERE cm.user_id = $1 AND r.tenant_id = $2
      ORDER BY 
        cm.is_pinned DESC,
        CASE WHEN (SELECT created_at FROM chat_messages WHERE room_id = r.id ORDER BY created_at DESC LIMIT 1) IS NOT NULL 
        THEN (SELECT created_at FROM chat_messages WHERE room_id = r.id ORDER BY created_at DESC LIMIT 1)
        ELSE r.created_at END DESC
    `, [user.id, tenantId]);
    
    // Transform to match interface
    const rooms = res.rows.map(row => ({
      id: row.id,
      name: row.name,
      type: row.type,
      tenantId: row.tenant_id,
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
    const { tenantId } = user;
    const body = await request.json();
    const { name, type, memberIds } = body; 

    if (!name) return NextResponse.json({ error: 'Name required' }, { status: 400 });

    const roomId = Math.random().toString(36).substr(2, 9);
    const createdAt = Date.now();

    await pool.query('BEGIN');
    
    await pool.query(
      'INSERT INTO chat_rooms (id, tenant_id, name, type, created_by, created_at) VALUES ($1, $2, $3, $4, $5, $6)',
      [roomId, tenantId, name, type || 'GROUP', user.id, createdAt]
    );

    // Add creator
    await pool.query(
      'INSERT INTO chat_members (room_id, user_id, joined_at) VALUES ($1, $2, $3)',
      [roomId, user.id, createdAt]
    );

    // Add other members - STRICT TENANT CHECK
    if (Array.isArray(memberIds)) {
      for (const mid of memberIds) {
        if (mid !== user.id) {
           // Verify mid belongs to same tenant
           const userCheck = await pool.query('SELECT 1 FROM users WHERE id = $1 AND tenant_id = $2', [mid, tenantId]);
           if (userCheck.rows.length > 0) {
              await pool.query(
                'INSERT INTO chat_members (room_id, user_id, joined_at) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
                [roomId, mid, createdAt]
              );
           }
        }
      }
    }

    await pool.query('COMMIT');
    
    return NextResponse.json({ id: roomId, name, type, tenantId, createdBy: user.id, createdAt, memberIds: [user.id, ...(memberIds || [])] });
  } catch (err) {
    await pool.query('ROLLBACK');
    console.error(err);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await authorize();
    const { tenantId } = user;
    const { searchParams } = new URL(request.url);
    const roomId = searchParams.get('id');

    if (!roomId) return NextResponse.json({ error: 'Room ID required' }, { status: 400 });
    if (roomId.startsWith('general-')) return NextResponse.json({ error: 'Cannot delete general room' }, { status: 403 });

    // Allow ANY user to delete (as requested: "semua user bisa hapus")
    // But logically, they should at least be a member or it should exist
    // Verify room belongs to tenant
    const roomCheck = await pool.query('SELECT 1 FROM chat_rooms WHERE id = $1 AND tenant_id = $2', [roomId, tenantId]);
    if (roomCheck.rows.length === 0) return NextResponse.json({ error: 'Room not found or unauthorized' }, { status: 404 });

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
