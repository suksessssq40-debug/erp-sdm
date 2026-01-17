import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authorize } from '@/lib/auth';
import bcrypt from 'bcryptjs';

export async function POST(request: Request) {
  try {
    const creator = await authorize(['OWNER', 'MANAGER', 'FINANCE']);
    const { tenantId } = creator;
    const body = await request.json();
    const { id, name, username, telegramId, telegramUsername, role, password, isFreelance } = body;
    
    if (!id || !name || !username || !role) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    if (!password || password.length < 6) return NextResponse.json({ error: 'Weak password' }, { status: 400 });

    const hash = await bcrypt.hash(password, 10);
    
    try {
        const newUser = await prisma.user.create({
          data: {
            id,
            tenantId,
            name,
            username,
            telegramId: telegramId || '',
            telegramUsername: telegramUsername || '',
            role,
            passwordHash: hash,
            isFreelance: !!isFreelance,
            deviceIds: [] // Initialize empty
          } as any
        });

        // MUST also create TenantAccess for the user to be able to access this tenant
        await prisma.tenantAccess.create({
            data: {
                userId: newUser.id,
                tenantId: tenantId,
                role: role,
                isActive: true
            }
        });
        
        return NextResponse.json({ id, name, username, telegramId, telegramUsername, role, isFreelance, tenantId }, { status: 201 });
    } catch (e: any) {
        if (e.code === 'P2002') { 
          return NextResponse.json({ error: 'Username already exists' }, { status: 409 });
        }
        throw e;
    }
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
  }
}
