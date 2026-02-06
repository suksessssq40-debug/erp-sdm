import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authorize } from '@/lib/auth';
import { serialize } from '@/lib/serverUtils';
import { UserRole } from '@/types';

export async function GET(request: Request) {
  try {
    const user = await authorize([UserRole.OWNER, UserRole.MANAGER]);
    const { tenantId } = user;

    const { searchParams } = new URL(request.url);
    const target = searchParams.get('target');

    const logs = await prisma.systemLog.findMany({
      where: {
        tenantId,
        ...(target ? { targetObj: target } : {})
      },
      orderBy: { timestamp: 'desc' },
      take: 100
    });

    const formatted = logs.map(l => ({
      ...l,
      target: l.targetObj,
      metadata: l.metadataJson ? JSON.parse(l.metadataJson) : null,
      timestamp: Number(l.timestamp)
    }));

    return NextResponse.json(serialize(formatted));
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: 'Failed', details: e.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await authorize();
    const { tenantId } = user;
    const body = await request.json();

    const created = await prisma.systemLog.create({
      data: {
        id: body.id || Math.random().toString(36).substr(2, 9),
        timestamp: BigInt(body.timestamp || Date.now()),
        actorId: body.actorId || user.id,
        actorName: body.actorName || user.name || 'Unknown',
        actorRole: body.actorRole || user.role || 'STAFF',
        actionType: body.actionType,
        details: body.details,
        targetObj: body.target,
        metadataJson: body.metadata ? JSON.stringify(body.metadata) : null,
        tenantId
      }
    });

    return NextResponse.json(serialize(created), { status: 201 });
  } catch (err: any) {
    console.error('Failed to save log', err);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

