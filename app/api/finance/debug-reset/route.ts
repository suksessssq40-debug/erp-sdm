import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authorize } from '@/lib/auth';

export async function GET(request: Request) {
    try {
        const user = await authorize(['OWNER', 'FINANCE']);
        const { tenantId } = user;

        const result = await prisma.transaction.deleteMany({
            where: { tenantId }
        });

        return NextResponse.json({ success: true, count: result.count });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
