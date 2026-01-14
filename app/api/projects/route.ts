import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authorize } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    const user = await authorize();
    const { tenantId } = user;
    
    // Filter by Tenant
    const projects = await prisma.project.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' }, 
        take: 100
    });

    const formatted = projects.map(p => ({
          id: p.id,
          title: p.title,
          tenantId: (p as any).tenantId,
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
  } catch(e: any) {
      console.error(e);
      return NextResponse.json({ error: 'Failed', details: e.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await authorize(); 
    const { tenantId } = user;
    const p = await request.json();
    
    await prisma.project.create({
      data: {
        id: p.id,
        tenantId,
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
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: 'Failed', details: error.message }, { status: 500 });
  }
}
