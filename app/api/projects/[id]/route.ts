export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authorize } from '@/lib/auth';
import { serialize, recordSystemLog } from '@/lib/serverUtils';

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await authorize();
    const { tenantId } = user;
    const id = params.id;
    const p = await request.json();

    // Security: Check ownership & existence within tenant
    const existing = await prisma.project.findFirst({ where: { id, tenantId } });
    if (!existing) return NextResponse.json({ error: 'Project not found or unauthorized' }, { status: 404 });

    if (p.status === 'DONE' && user.role !== 'OWNER') {
      return NextResponse.json({ error: 'Only OWNER can mark project as DONE' }, { status: 403 });
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
        isManagementOnly: p.isManagementOnly ? 1 : 0,
        priority: p.priority
      }
    });

    await recordSystemLog({
      actorId: user.id,
      actorName: user.name,
      actorRole: user.role,
      actionType: 'PROJECT_UPDATE',
      details: `Project details updated (Full Put)`,
      targetObj: id,
      tenantId
    });

    return NextResponse.json(serialize(p));
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

// Support PATCH for atomic updates (e.g., add comment, move status)
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await authorize();
    const { tenantId } = user;
    const id = params.id;
    const body = await request.json(); // { action: '...', data: ... }
    const { action, data } = body;

    // Fetch current project first - STRICT TENANT CHECK
    const currentProject = await prisma.project.findFirst({ where: { id, tenantId } });
    if (!currentProject) {
      return NextResponse.json({ error: 'Project not found or unauthorized' }, { status: 404 });
    }

    let updateData: any = {};

    if (action === 'MOVE_STATUS') {
      // 1. Status Update
      if (data.status === 'DONE' && user.role !== 'OWNER') {
        return NextResponse.json({ error: 'Only OWNER can mark project as DONE' }, { status: 403 });
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

    // Perform Update
    const updated = await prisma.project.update({
      where: { id },
      data: updateData
    });

    // LOGGING
    let logAction = 'PROJECT_UPDATE';
    let logDetail = `Update proyek: ${action}`;

    if (action === 'MOVE_STATUS') {
      logAction = 'PROJECT_MOVE_STATUS';
      logDetail = `Status berubah menjadi ${data.status}`;
    } else if (action === 'ADD_COMMENT') {
      logAction = 'PROJECT_COMMENT';
      logDetail = `Komentar baru ditambahkan`;
    } else if (action === 'UPDATE_TASK') {
      const t = data.task;
      if (t.isCompleted) {
        logAction = 'PROJECT_TASK_COMPLETE';
        logDetail = `Tugas "${t.title}" diselesaikan`;
      } else {
        logDetail = `Update tugas "${t.title}"`;
      }
    }

    await recordSystemLog({
      actorId: user.id,
      actorName: user.name,
      actorRole: user.role,
      actionType: logAction,
      details: logDetail,
      targetObj: id, // Target is Project ID
      tenantId
    });

    return NextResponse.json(serialize(updated));
  } catch (error) {
    console.error("PATCH Error:", error);
    return NextResponse.json({ error: 'Failed to patch project' }, { status: 500 });
  }
}
// Import recordSystemLog at the top if not present!

// Support DELETE - Management Level
export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await authorize(['OWNER', 'MANAGER', 'FINANCE']);
    const { tenantId } = user;
    const id = params.id;

    // Verify existence & ownership
    const existing = await prisma.project.findFirst({ where: { id, tenantId } });
    if (!existing) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    await prisma.project.delete({ where: { id } });
    return NextResponse.json({ message: 'Deleted' });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
