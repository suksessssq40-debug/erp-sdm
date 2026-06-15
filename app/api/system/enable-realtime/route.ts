
import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET() {
  try {
    // 1. Enable REPLICA IDENTITY FULL (Required for proper Realtime updates on some operations)
    await pool.query(`ALTER TABLE projects REPLICA IDENTITY FULL;`);
    
    // 2. Add table to supabase_realtime publication
    // Note: 'supabase_realtime' is the default publication name in Supabase
    try {
        await pool.query(`ALTER PUBLICATION supabase_realtime ADD TABLE projects;`);
    } catch (e: any) {
        // Ignore if already added (Postgres might throw "relation already in publication")
        if (!e.message.includes('already is in publication')) {
            console.warn("Publication add warning:", e.message);
        }
    }

    return NextResponse.json({ success: true, message: "Realtime replication enabled for 'projects'" });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
