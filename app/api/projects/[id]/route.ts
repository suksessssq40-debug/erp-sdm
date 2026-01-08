import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authorize } from '@/lib/auth';

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await authorize();
    const id = params.id;
    const p = await request.json();

    if (p.status === 'DONE' && user.role === 'STAFF') {
      return NextResponse.json({ error: 'Not allowed to mark DONE' }, { status: 403 });
    }

    await prisma.project.update({
      where: { id },
      data: {
        title: p.title,
        description: p.description || '',
        collaboratorsJson: JSON.stringify(p.collaborators || []),
        deadline: p.deadline ? new Date(p.deadline) : null,
        status: p.status,
        tasksJson: JSON.stringify(p.tasks || []),
        commentsJson: JSON.stringify(p.comments || []),
        isManagementOnly: (p.isManagementOnly ? 1 : 0) as any,
        priority: p.priority
      }
    });

    return NextResponse.json(p);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

// Support PATCH for atomic updates (e.g., add comment, move status)
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await authorize();
    const id = params.id;
    const body = await request.json(); // { action: '...', data: ... }
    const { action, data } = body;

    // Fetch current project first
    const currentProject = await prisma.project.findUnique({ where: { id } });
    if (!currentProject) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    let updateData: any = {};

    if (action === 'MOVE_STATUS') {
      // 1. Status Update
      if (data.status === 'DONE' && user.role === 'STAFF') {
        return NextResponse.json({ error: 'Staff cannot mark as DONE' }, { status: 403 });
      }
      updateData.status = data.status;
    } 
    else if (action === 'UPDATE_TASK') {
      // 2. Task Update (Atomic replacement of the specific task in JSON array)
      let tasks: any[] = [];
      try {
        tasks = JSON.parse(currentProject.tasksJson || '[]');
        if (!Array.isArray(tasks)) tasks = [];
      } catch (e) { tasks = []; }
      
      const updatedTasks = tasks.map((t: any) => t.id === data.taskId ? data.task : t);
      updateData.tasksJson = JSON.stringify(updatedTasks);
    }
    else if (action === 'ADD_COMMENT') {
       // 3. Add Project Comment
       const comments = JSON.parse(currentProject.commentsJson || '[]');
       comments.push(data.comment);
       updateData.commentsJson = JSON.stringify(comments);
    }
    // Fallback? If logic is complex, maybe just rely on standard PUT if 'data' is full object.
    // But store.ts uses PATCH specifically for 'atomic' names. 
    
    // Perform Update
    const updated = await prisma.project.update({
      where: { id },
      data: updateData
    });

    // Fix BigInt serialization
    const serialized = JSON.parse(JSON.stringify(updated, (key, value) =>
        typeof value === 'bigint'
            ? Number(value)
            : value // return everything else unchanged
    ));

    return NextResponse.json(serialized);
  } catch (error) {
    console.error("PATCH Error:", error);
    return NextResponse.json({ error: 'Failed to patch project' }, { status: 500 });
  }
}

// Support DELETE if required by recent user requests
export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    await authorize(['OWNER', 'MANAGER', 'FINANCE']); // Management Level Delete
    const id = params.id;
    await prisma.project.delete({ where: { id } });
    return NextResponse.json({ message: 'Deleted' });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
