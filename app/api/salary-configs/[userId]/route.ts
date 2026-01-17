import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authorize } from '@/lib/auth';

export async function PUT(request: Request, { params }: { params: { userId: string } }) {
  try {
    const actor = await authorize(['OWNER', 'FINANCE']);
    const { tenantId } = actor;
    const userId = params.userId;
    const c = await request.json();

    // STRICT CHECK: Ensure target user belongs to same tenant
    const targetUser = await prisma.user.findFirst({ where: { id: userId, tenantId } });
    if (!targetUser) return NextResponse.json({ error: 'User not found or unauthorized' }, { status: 404 });

    await prisma.salaryConfig.upsert({
      where: { userId },
      create: {
        userId,
        basicSalary: c.basicSalary,
        allowance: c.allowance,
        mealAllowance: c.mealAllowance,
        lateDeduction: c.lateDeduction
      },
      update: {
        basicSalary: c.basicSalary,
        allowance: c.allowance,
        mealAllowance: c.mealAllowance,
        lateDeduction: c.lateDeduction
      }
    });

    return NextResponse.json(c);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
