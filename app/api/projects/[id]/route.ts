
import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { authorize } from '@/lib/auth';

// PUT is Legacy (Full Overwrite). Use PATCH for Atomic Updates.
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

export async function PATCH(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const client = await pool.connect();
  try {
    await authorize();
    const id = params.id;
    const payload = await request.json();
    const { action, data } = payload;

    await client.query('BEGIN');
    
    // LOCK the row to prevent race conditions
    const res = await client.query('SELECT * FROM projects WHERE id = $1 FOR UPDATE', [id]);
    if (res.rows.length === 0) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }
    
    const project = res.rows[0];
    let tasks = JSON.parse(project.tasks_json || '[]');
    let comments = JSON.parse(project.comments_json || '[]');
    let status = project.status;
    let title = project.title;

    const user = await authorize();
    
    // Apply Changes Atomically
    if (action === 'MOVE_STATUS') {
        // SECURITY PATCH: Prevent STAFF from moving to DONE
        if (data.status === 'DONE' && user.role === 'STAFF') {
           await client.query('ROLLBACK');
           return NextResponse.json({ error: 'STAFF forbidden from finalizing project (DONE)' }, { status: 403 });
        }
        status = data.status;
    } else if (action === 'ADD_TASK') {
        tasks.push(data.task);
    } else if (action === 'UPDATE_TASK') {
        tasks = tasks.map((t: any) => t.id === data.taskId ? { ...t, ...data.task } : t);
    } else if (action === 'ADD_COMMENT') {
        comments.push(data.comment);
    } else if (action === 'UPDATE_DETAILS') {
        // Safe update for title/desc/deadline only
        if (data.title) title = data.title;
        // Add other fields as needed
    }

    // Save
    await client.query(
        `UPDATE projects SET status=$1, tasks_json=$2, comments_json=$3, title=$4 WHERE id=$5`,
        [status, JSON.stringify(tasks), JSON.stringify(comments), title, id]
    );

    await client.query('COMMIT');
    
    // Return updated project logic (simplify return for now)
    // Correctly format the response object to match Frontend interfaces
    const updated = {
        ...project,
        status,
        title,
        tasks,
        comments,
        collaborators: typeof project.collaborators_json === 'string' 
            ? JSON.parse(project.collaborators_json || '[]') 
            : (project.collaborators_json || []),
        isManagementOnly: project.is_management_only === 1 || project.is_management_only === true,
        createdBy: project.created_by,
        createdAt: Number(project.created_at),
        // Remove internal DB fields
        tasks_json: undefined, 
        comments_json: undefined,
        collaborators_json: undefined,
        is_management_only: undefined,
        created_by: undefined,
        created_at: undefined
    };

    return NextResponse.json(updated);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error("PATCH Error:", error);
    return NextResponse.json({ error: 'Atomic Update Failed' }, { status: 500 });
  } finally {
    client.release();
  }
}

export async function DELETE(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    await authorize();
    const id = params.id;

    // Check if project exists
    const check = await pool.query('SELECT title FROM projects WHERE id = $1', [id]);
    if (check.rows.length === 0) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }
    const projectTitle = check.rows[0].title;

    await pool.query('DELETE FROM projects WHERE id = $1', [id]);
    
    return NextResponse.json({ success: true, id, title: projectTitle });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to delete project' }, { status: 500 });
  }
}
