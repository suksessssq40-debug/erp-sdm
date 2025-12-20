import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { authorize } from '@/lib/auth';

export async function PUT(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const user = await authorize();
    const id = params.id;
    const p = await request.json();

    if (p.status === 'DONE' && user.role === 'STAFF') {
        return NextResponse.json({ error: 'Not allowed to mark DONE' }, { status: 403 });
    }

    await pool.query(
      `UPDATE projects SET 
        title=$1, description=$2, collaborators_json=$3, deadline=$4, status=$5, tasks_json=$6, comments_json=$7, is_management_only=$8, priority=$9 
       WHERE id=$10`,
      [
        p.title, p.description || '', JSON.stringify(p.collaborators || []), p.deadline,
        p.status, JSON.stringify(p.tasks || []), JSON.stringify(p.comments || []),
        p.isManagementOnly ? 1 : 0, p.priority, id
      ]
    );

    return NextResponse.json(p);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
