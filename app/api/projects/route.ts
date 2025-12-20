import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { authorize } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    await authorize(); // Auth check
    const p = await request.json();
    
    await pool.query(
      `INSERT INTO projects (id, title, description, collaborators_json, deadline, status, tasks_json, comments_json, is_management_only, priority, created_by, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        p.id, p.title, p.description || '', JSON.stringify(p.collaborators || []),
        p.deadline, p.status, JSON.stringify(p.tasks || []), JSON.stringify(p.comments || []),
        p.isManagementOnly ? 1 : 0, p.priority, p.createdBy, p.createdAt
      ]
    );
    return NextResponse.json(p, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
