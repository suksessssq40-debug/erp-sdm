
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authorize } from '@/lib/auth';
import { sign } from 'jsonwebtoken';

export const dynamic = 'force-dynamic';

const JWT_SECRET = process.env.JWT_SECRET || 'secret';

export async function POST(request: Request) {
  try {
    const currentUser = await authorize(); // Any role can switch if they have access
    const body = await request.json();
    const { targetTenantId } = body;

    if (!targetTenantId) {
        return NextResponse.json({ error: 'Target Tenant ID is required' }, { status: 400 });
    }

    // 1. Verify Access via TenantAccess Table
    // We look for a record linking currentUser.id -> targetTenantId
    const access = await prisma.tenantAccess.findFirst({
        where: {
            userId: currentUser.id,
            tenantId: targetTenantId,
            isActive: true
        },
        include: { tenant: true }
    });

    if (!access) {
        return NextResponse.json({ error: 'Access Denied: You do not have permission to access this unit.' }, { status: 403 });
    }

    // 2. Generate NEW JWT with switched context
    // We keep the SAME User ID, but change the Tenant ID and Role in the token payload
    const userPayload = {
      id: currentUser.id,      // Keep original User ID (Unified Identity)
      name: currentUser.name,
      username: currentUser.username,
      tenantId: access.tenantId, // NEW Context
      role: access.role,         // Role for this specific tenant
      telegramId: currentUser.telegramId || '',
      telegramUsername: currentUser.telegramUsername || '',
      features: access.tenant.featuresJson // Pass features to frontend!
    };

    const token = sign(userPayload, JWT_SECRET, { expiresIn: '7d' });

    console.log(`User ${currentUser.username} switched to tenant ${access.tenant.name} (${access.tenantId}) as ${access.role}`);

    return NextResponse.json({ 
        user: { ...userPayload, roleSlug: access.role.toLowerCase() }, 
        token 
    });

  } catch (error) {
    console.error('Tenant Switch Error:', error);
    return NextResponse.json({ error: 'Failed to switch unit' }, { status: 500 });
  }
}
