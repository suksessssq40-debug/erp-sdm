import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authorize } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const actor = await authorize();
    const { tenantId } = actor;

    // Only Kaizen Master or OWNER can deduct
    const actorUser = await prisma.user.findUnique({ where: { id: actor.id } });
    if (!actorUser) return NextResponse.json({ error: 'User tidak ditemukan' }, { status: 404 });

    const isOwner = actor.role === 'OWNER' || actor.role === 'SUPERADMIN';
    const isKaizenMaster = !!actorUser.isKaizenMaster;

    if (!isOwner && !isKaizenMaster) {
      return NextResponse.json({ error: 'Hanya Kaizen Master atau Owner yang bisa memotong poin' }, { status: 403 });
    }

    const { userId, category, amount, reason, violationDate } = await request.json();

    // Validation
    if (!userId || !category || !amount) {
      return NextResponse.json({ error: 'userId, category, dan amount wajib diisi' }, { status: 400 });
    }

    if (!['RINGAN', 'SEDANG', 'BERAT'].includes(category)) {
      return NextResponse.json({ error: 'Kategori harus RINGAN, SEDANG, atau BERAT' }, { status: 400 });
    }

    const deductAmount = Number(amount);
    if (isNaN(deductAmount) || deductAmount < 1 || deductAmount > 100) {
      return NextResponse.json({ error: 'Jumlah poin harus antara 1-100' }, { status: 400 });
    }

    // Check target user
    const target = await prisma.user.findFirst({ where: { id: userId, tenantId } });
    if (!target) {
      return NextResponse.json({ error: 'User target tidak ditemukan di tenant ini' }, { status: 404 });
    }

    // OWNER is immune
    if (target.role === 'OWNER' || target.role === 'SUPERADMIN') {
      return NextResponse.json({ error: 'Owner tidak bisa dipotong poinnya' }, { status: 403 });
    }

    // Deduct points
    const currentPoints = target.kaizenPoints ?? 100;
    const newPoints = Math.max(0, currentPoints - deductAmount);

    await prisma.$transaction([
      // Update user points
      prisma.user.update({
        where: { id: userId },
        data: { kaizenPoints: newPoints }
      }),
      // Create deduction record
      prisma.kaizenDeduction.create({
        data: {
          userId,
          deductedBy: actor.id,
          amount: deductAmount,
          category,
          reason: reason || null,
          createdAt: violationDate ? new Date(violationDate + 'T12:00:00') : new Date()
        }
      }),
      // Log to system_logs
      prisma.systemLog.create({
        data: {
          id: Math.random().toString(36).substr(2, 9),
          timestamp: BigInt(Date.now()),
          actorId: actor.id,
          actorName: actor.name || actor.username,
          actorRole: actor.role,
          actionType: 'KAIZEN_DEDUCT',
          details: `Potong poin ${deductAmount} (${category}) dari ${target.name || target.username}. Alasan: ${reason || '-'}`,
          targetObj: userId,
          tenantId
        }
      })
    ]);

    return NextResponse.json({
      success: true,
      userId,
      previousPoints: currentPoints,
      deducted: deductAmount,
      newPoints,
      category,
      reason
    });
  } catch (error: unknown) {
    console.error('[KAIZEN DEDUCT ERROR]', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'Gagal memotong poin', details: msg }, { status: 500 });
  }
}
