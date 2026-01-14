
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authorize } from '@/lib/auth';
import { UserRole } from '@/types';
import { sign } from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'secret';

export async function POST(request: Request) {
  try {
    const currentUser = await authorize([UserRole.OWNER, UserRole.SUPERADMIN]);
    const body = await request.json();
    const { targetTenantId } = body;

    if (!targetTenantId) {
        return NextResponse.json({ error: 'Target Tenant ID is required' }, { status: 400 });
    }

    // 1. Verify existence of target tenant
    const tenant = await prisma.tenant.findUnique({ where: { id: targetTenantId } });
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

    // 2. Find the user record for this person in the target tenant
    // Strategy: Look for username pattern "originalUsername.targetTenantId" 
    const baseUsername = currentUser.username 
        ? currentUser.username.split('.')[0] 
        : (await prisma.user.findUnique({ where: { id: currentUser.id } }))?.username?.split('.')[0];
    
    if (!baseUsername) return NextResponse.json({ error: 'User identity not found' }, { status: 404 });

    const targetUsername = `${baseUsername}.${targetTenantId}`;

    let targetUser = await prisma.user.findFirst({
        where: {
            tenantId: targetTenantId,
            OR: [
                { username: targetUsername },
                { id: `${currentUser.id.split('-')[0]}-${targetTenantId}` },
                { role: 'OWNER' }
            ]
        }
    });

    // --- SELF-HEALING: If no owner record exists in target tenant, CREATE IT ---
    if (!targetUser && currentUser.role === UserRole.OWNER) {
        console.log(`Cloning owner ${currentUser.id} into tenant ${targetTenantId}...`);
        const originalUser = await prisma.user.findUnique({ where: { id: currentUser.id } });
        if (originalUser) {
            targetUser = await prisma.user.create({
                data: {
                    id: `${currentUser.id.split('-')[0]}-${targetTenantId}`,
                    tenantId: targetTenantId,
                    name: originalUser.name,
                    username: targetUsername,
                    passwordHash: originalUser.passwordHash,
                    role: 'OWNER',
                    telegramId: originalUser.telegramId,
                    telegramUsername: originalUser.telegramUsername,
                    deviceIds: [],
                    isFreelance: false
                }
            });
        }
    }

    if (!targetUser) {
        return NextResponse.json({ error: 'You do not have an account in this unit and self-provisioning failed.' }, { status: 403 });
    }

    // 3. Generate NEW JWT for the target user
    const userPayload = {
      id: targetUser.id,
      name: targetUser.name,
      username: targetUser.username,
      tenantId: targetTenantId,
      role: targetUser.role,
      telegramId: targetUser.telegramId || '',
      telegramUsername: targetUser.telegramUsername || '',
    };

    const token = sign(userPayload, JWT_SECRET, { expiresIn: '7d' });

    return NextResponse.json({ 
        user: { ...userPayload, roleSlug: targetUser.role?.toLowerCase() }, 
        token 
    });

  } catch (error) {
    console.error('Tenant Switch Error:', error);
    return NextResponse.json({ error: 'Failed to switch unit' }, { status: 500 });
  }
}
