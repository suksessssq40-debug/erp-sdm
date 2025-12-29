import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authorize } from '@/lib/auth';
import bcrypt from 'bcryptjs';

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    const actor = await authorize(['OWNER', 'MANAGER']);
    const id = params.id;
    const body = await request.json();

    // Prevent non-Owners from editing Owners or Superadmins
    const target = await prisma.user.findUnique({ where: { id } });
    if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    if (actor.role !== 'OWNER' && (target.role === 'OWNER' || target.role === 'SUPERADMIN')) {
         return NextResponse.json({ error: 'Forbidden to edit this user' }, { status: 403 });
    }

    const { name, username, telegramId, telegramUsername, role, password, isFreelance } = body;

    const data: any = {
       name, username, telegramId, telegramUsername, role, isFreelance: !!isFreelance
    };

    if (password && password.length >= 6) {
       data.passwordHash = await bcrypt.hash(password, 10);
    }

    await prisma.user.update({
       where: { id },
       data
    });

    return NextResponse.json(body);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const actor = await authorize(['OWNER']);
    const id = params.id;

    const target = await prisma.user.findUnique({ where: { id } });
    if (!target) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (target.role === 'OWNER') return NextResponse.json({ error: 'Cannot delete owner' }, { status: 400 });

    await prisma.user.delete({ where: { id } });
    
    return NextResponse.json({ message: 'User deleted' });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
