import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authorize } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    await authorize();
    
    // Future Optimization: Filter by status != ARCHIVED
    const projects = await prisma.project.findMany({
        orderBy: { createdAt: 'desc' }, // Recent first
        take: 100
    });

    const formatted = projects.map(p => ({
          id: p.id,
          title: p.title,
          description: p.description || '',
          collaborators: typeof p.collaboratorsJson === 'string' ? JSON.parse(p.collaboratorsJson) : [],
          deadline: p.deadline ? p.deadline.toISOString().split('T')[0] : '',
          status: p.status,
          tasks: typeof p.tasksJson === 'string' ? JSON.parse(p.tasksJson) : [],
          comments: typeof p.commentsJson === 'string' ? JSON.parse(p.commentsJson) : [],
          isManagementOnly: !!p.isManagementOnly,
          priority: p.priority,
          createdBy: p.createdBy,
          createdAt: p.createdAt ? Number(p.createdAt) : Date.now()
    }));

     return NextResponse.json(formatted);
  } catch(e) {
      console.error(e);
      return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await authorize(); 
    const p = await request.json();
    
    await prisma.project.create({
      data: {
        id: p.id,
        title: p.title,
        description: p.description || '',
        collaboratorsJson: JSON.stringify(p.collaborators || []),
        deadline: p.deadline ? new Date(p.deadline) : null,
        status: p.status,
        tasksJson: JSON.stringify(p.tasks || []),
        commentsJson: JSON.stringify(p.comments || []),
        isManagementOnly: (p.isManagementOnly ? 1 : 0) as any,
        priority: p.priority,
        createdBy: p.createdBy,
        createdAt: (p.createdAt ? BigInt(new Date(p.createdAt).getTime()) : BigInt(Date.now())) as any
      }
    });

    return NextResponse.json(p, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
