
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authorize } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const user = await authorize();
    
    // Fetch all tenants where this user has access
    const memberships = await prisma.tenantAccess.findMany({
        where: {
            userId: user.id,
            isActive: true
        },
        include: {
            tenant: {
                select: {
                    id: true,
                    name: true,
                    description: true,
                    featuresJson: true
                }
            }
        },
        orderBy: { tenant: { name: 'asc' } }
    });

    const tenants = memberships.map(m => ({
        id: m.tenant.id,
        name: m.tenant.name,
        description: m.tenant.description,
        role: m.role,
        features: m.tenant.featuresJson,
        current: m.tenant.id === user.tenantId
    }));

    return NextResponse.json(tenants);
  } catch(e: any) {
    console.error(e);
    return NextResponse.json({ error: 'Failed', details: e.message }, { status: 500 });
  }
}
