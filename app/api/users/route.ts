import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authorize } from '@/lib/auth';
import bcrypt from 'bcryptjs';

export async function POST(request: Request) {
  try {
    await authorize(['OWNER', 'MANAGER', 'FINANCE']);
    const body = await request.json();
    const { id, name, username, telegramId, telegramUsername, role, password, isFreelance } = body;
    
    if (!id || !name || !username || !role) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    if (!password || password.length < 6) return NextResponse.json({ error: 'Weak password' }, { status: 400 });

    const hash = await bcrypt.hash(password, 10);
    
    try {
        await prisma.user.create({
          data: {
            id,
            name,
            username,
            telegramId: telegramId || '',
            telegramUsername: telegramUsername || '',
            role,
            passwordHash: hash,
            isFreelance: !!isFreelance,
            deviceIds: [] // Initialize empty
          }
        });
        
        return NextResponse.json({ id, name, username, telegramId, telegramUsername, role, isFreelance }, { status: 201 });
    } catch (e: any) {
        if (e.code === 'P2002') { // Prisma Unique Constraint
          return NextResponse.json({ error: 'Username already exists' }, { status: 409 });
        }
        throw e;
    }
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
  }
}
