import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authorize } from '@/lib/auth';

export async function GET(request: Request) {
    try {
        const user = await authorize(['OWNER', 'FINANCE', 'MANAGER']);
        const { tenantId } = user;

        // Filter by Tenant via User relationship
        const records = await prisma.payrollRecord.findMany({
            where: {
                user: { tenantId }
            },
            orderBy: { processedAt: 'desc' },
            take: 100
        });

        const formatted = records.map(pr => ({
            id: pr.id,
            userId: pr.userId,
            month: pr.month,
            basicSalary: Number(pr.basicSalary),
            allowance: Number(pr.allowance),
            totalMealAllowance: Number(pr.totalMealAllowance),
            bonus: Number(pr.bonus),
            deductions: Number(pr.deductions),
            netSalary: Number(pr.netSalary),
            isSent: !!pr.isSent,
            processedAt: pr.processedAt ? Number(pr.processedAt) : Date.now(),
            metadata: typeof pr.metadataJson === 'string' ? JSON.parse(pr.metadataJson) : undefined
        }));

        return NextResponse.json(formatted);
    } catch (e) {
        console.error(e);
        return NextResponse.json({ error: 'Failed' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const user = await authorize(['OWNER', 'FINANCE']);
        const { tenantId } = user;
        const pr = await request.json();

        // Security: Verify target user belongs to this tenant
        const targetUser = await prisma.user.findFirst({
            where: { id: pr.userId, tenantId }
        });

        if (!targetUser) {
            return NextResponse.json({ error: 'User not found in this tenant' }, { status: 404 });
        }

        // Transaction: Create Payroll Record + Auto Journal
        await prisma.$transaction(async (tx) => {
            // 1. Create Pay Record
            await tx.payrollRecord.create({
                data: {
                    id: pr.id,
                    userId: pr.userId,
                    month: pr.month,
                    basicSalary: pr.basicSalary,
                    allowance: pr.allowance,
                    totalMealAllowance: pr.totalMealAllowance,
                    bonus: pr.bonus,
                    deductions: pr.deductions,
                    netSalary: pr.netSalary,
                    isSent: (pr.isSent ? 1 : 0) as any,
                    processedAt: BigInt(pr.processedAt || Date.now()),
                    metadataJson: pr.metadata ? JSON.stringify(pr.metadata) : null
                }
            });

            // 2. Auto Journal - MUST INCLUDE tenantId
            const transactionId = Math.random().toString(36).substr(2, 9);
            const today = new Date();
            const desc = `Gaji Bulan ${pr.month} (Auto)`;

            await tx.transaction.create({
                data: {
                    id: transactionId,
                    tenantId: tenantId, // CRITICAL FIX
                    date: today,
                    amount: pr.netSalary,
                    type: 'OUT',
                    category: 'SALARY',
                    description: desc,
                    account: 'MAIN',
                    imageUrl: null
                }
            });
        });

        return NextResponse.json(pr, { status: 201 });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Failed' }, { status: 500 });
    }
}
