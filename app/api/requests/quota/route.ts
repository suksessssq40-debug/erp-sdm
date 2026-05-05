export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authorize } from '@/lib/auth';
import { serialize } from '@/lib/serverUtils';

export async function GET(request: Request) {
    try {
        const user = await authorize();
        const { tenantId } = user;
        const currentYear = new Date().getFullYear();

        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('userId') || user.id;

        // Security: Self only unless management
        const isAdmin = ['OWNER', 'MANAGER', 'FINANCE'].includes(user.role);
        if (!isAdmin && userId !== user.id) {
            return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 });
        }

        const quota = await prisma.leaveQuota.findUnique({
            where: {
                userId_year: {
                    userId,
                    year: currentYear
                }
            }
        });

        // Default quota if not found
        if (!quota) {
            const tenant = await prisma.tenant.findUnique({
                where: { id: tenantId },
                select: { leaveAnnualQuota: true }
            });
            const total = tenant?.leaveAnnualQuota || 12;

            return NextResponse.json({
                userId,
                year: currentYear,
                totalQuota: total,
                usedQuota: 0,
                remainingQuota: total
            });
        }

        return NextResponse.json(serialize(quota));
    } catch (e: any) {
        return NextResponse.json({ error: 'Failed', details: e.message }, { status: 500 });
    }
}
