export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authorize } from '@/lib/auth';
import bcrypt from 'bcryptjs';

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    const actor = await authorize(); // Any logged in user
    const { tenantId } = actor;
    const id = params.id;
    const body = await request.json();

    // 1. Identify Target
    const target = await prisma.user.findUnique({
      where: { id },
      include: { tenantAccess: true }
    });

    if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    // 2. SECURITY CHECKS
    const isSelf = actor.id === target.id;
    const isOwner = actor.role === 'OWNER' || actor.role === 'SUPERADMIN';
    const isManager = actor.role === 'MANAGER';

    // Staff cannot update others
    if (!isSelf && !isOwner && !isManager) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Role hierarchy: Managers cannot update Owners/Superadmins
    if (isManager && !isOwner && (target.role === 'OWNER' || target.role === 'SUPERADMIN')) {
      return NextResponse.json({ error: 'Cannot update superior' }, { status: 403 });
    }

    // Tenant Isolation: If not self, must be in same tenant
    if (!isSelf && target.tenantId !== tenantId) {
      // Double check if target has access to actor's tenant
      const hasAccess = target.tenantAccess.some(a => a.tenantId === tenantId);
      if (!hasAccess) return NextResponse.json({ error: 'Tenant mismatch' }, { status: 403 });
    }

    // 3. Selective Update
    const { name, username, telegramId, telegramUsername, role, password, isFreelance, avatarUrl } = body;

    const data: any = {};

    // Anyone (self or admin) can update basic info
    if (name !== undefined) data.name = name;
    if (telegramUsername !== undefined) data.telegramUsername = telegramUsername;
    if (avatarUrl !== undefined) data.avatarUrl = avatarUrl;

    // Security Sensitive: Only Owners/Managers can change these for others, or Owners for themselves
    if (isOwner || isManager) {
      if (username !== undefined) data.username = username;
      if (role !== undefined) data.role = role;
      if (isFreelance !== undefined) data.isFreelance = !!isFreelance;
      if (telegramId !== undefined) data.telegramId = telegramId;
    }

    // Password Update
    if (password && password.length >= 6) {
      data.passwordHash = await bcrypt.hash(password, 10);
    }

    const updated = await prisma.user.update({
      where: { id },
      data
    });

    return NextResponse.json({
      id: updated.id,
      name: updated.name,
      username: updated.username,
      role: updated.role,
      avatarUrl: updated.avatarUrl,
      telegramUsername: updated.telegramUsername,
      isFreelance: !!updated.isFreelance
    });
  } catch (error: any) {
    console.error('[API User Update Error]', error);
    return NextResponse.json({ error: 'Failed to update user', details: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const actor = await authorize(['OWNER']);
    const { tenantId } = actor;
    const id = params.id;

    const target = await prisma.user.findFirst({ where: { id, tenantId } });
    if (!target) return NextResponse.json({ error: 'Not found or unauthorized' }, { status: 404 });
    if (target.role === 'OWNER') return NextResponse.json({ error: 'Cannot delete owner' }, { status: 400 });

    await prisma.user.delete({ where: { id } });

    return NextResponse.json({ message: 'User deleted' });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
