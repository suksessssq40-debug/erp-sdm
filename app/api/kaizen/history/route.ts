import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authorize } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    const actor = await authorize();
    const { tenantId } = actor;

    // Only Kaizen Master or OWNER can view history
    const actorUser = await prisma.user.findUnique({ where: { id: actor.id } });
    if (!actorUser) return NextResponse.json({ error: 'User tidak ditemukan' }, { status: 404 });

    const isOwner = actor.role === 'OWNER' || actor.role === 'SUPERADMIN';
    const isKaizenMaster = !!actorUser.isKaizenMaster;

    if (!isOwner && !isKaizenMaster) {
      return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 });
    }

    // Parse query params
    const url = new URL(request.url);
    const userId = url.searchParams.get('userId'); // optional filter
    const limit = Math.min(Number(url.searchParams.get('limit') || '100'), 500);

    // Get users in this tenant for filtering
    const tenantUsers = await prisma.user.findMany({
      where: { tenantId },
      select: { id: true, name: true, username: true }
    });
    const tenantUserIds = tenantUsers.map(u => u.id);
    const userMap = new Map(tenantUsers.map(u => [u.id, u.name || u.username]));

    // Build where clause
    const where: Record<string, unknown> = {
      userId: { in: tenantUserIds }
    };
    if (userId && tenantUserIds.includes(userId)) {
      where.userId = userId;
    }

    const deductions = await prisma.kaizenDeduction.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit
    });

    // Populate names
    const result = deductions.map(d => ({
      id: d.id,
      userId: d.userId,
      userName: userMap.get(d.userId) || 'Unknown',
      deductedBy: d.deductedBy,
      deductedByName: userMap.get(d.deductedBy) || 'Unknown',
      amount: d.amount,
      category: d.category,
      reason: d.reason,
      createdAt: d.createdAt.toISOString()
    }));

    // Also get current points for all tenant users
    const usersWithPoints = await prisma.user.findMany({
      where: { tenantId },
      select: {
        id: true,
        name: true,
        username: true,
        role: true,
        isKaizenMaster: true,
        kaizenPoints: true,
        kaizenPointsResetAt: true
      }
    });

    return NextResponse.json({
      deductions: result,
      users: usersWithPoints.map(u => ({
        id: u.id,
        name: u.name || u.username,
        role: u.role,
        isKaizenMaster: u.isKaizenMaster,
        kaizenPoints: u.kaizenPoints ?? 100,
        kaizenPointsResetAt: u.kaizenPointsResetAt?.toISOString() || null,
        isOwner: u.role === 'OWNER' || u.role === 'SUPERADMIN'
      }))
    });
  } catch (error: unknown) {
    console.error('[KAIZEN HISTORY ERROR]', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'Gagal mengambil riwayat', details: msg }, { status: 500 });
  }
}
