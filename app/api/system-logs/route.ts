import { NextResponse } from 'next/server';
import pool from '@/lib/db';

import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
    try {
        const logs = await prisma.systemLog.findMany({
            orderBy: { timestamp: 'desc' },
            take: 50
        });

        const formatted = logs.map(l => ({
          id: l.id,
          timestamp: Number(l.timestamp), // Convert BigInt
          actorId: l.actorId,
          actorName: l.actorName,
          actorRole: l.actorRole,
          actionType: l.actionType,
          details: l.details,
          target: l.targetObj || undefined,
          metadata: l.metadataJson ? JSON.parse(l.metadataJson) : undefined
        }));

        return NextResponse.json(formatted);
    } catch(e) {
        console.error(e);
        return NextResponse.json({ error: 'Failed' }, { status: 500 });
    }
}

export async function POST(request: Request) {
  try {
    const log = await request.json();
    const client = await pool.connect();
    
    try {
      await client.query(
        `INSERT INTO system_logs (id, timestamp, actor_id, actor_name, actor_role, action_type, details, target_obj, metadata_json)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          log.id, 
          log.timestamp, 
          log.actorId, 
          log.actorName, 
          log.actorRole, 
          log.actionType, 
          log.details, 
          log.target || null, 
          log.metadata ? JSON.stringify(log.metadata) : null
        ]
      );
      
      return NextResponse.json({ success: true });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Failed to save log', err);
    return NextResponse.json({ error: 'Failed to save log' }, { status: 500 });
  }
}
