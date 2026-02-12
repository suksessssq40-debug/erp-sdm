
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authorize } from '@/lib/auth';
import { serialize } from '@/lib/serverUtils';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const user = await authorize();
        const { tenantId } = user;
        const { searchParams } = new URL(request.url);
        const outletId = searchParams.get('outletId');

        if (!outletId) return NextResponse.json([], { status: 200 });

        const prices = await (prisma as any).rentalPsPrice.findMany({
            where: { tenantId, outletId, isActive: true },
            orderBy: { name: 'asc' }
        });

        return NextResponse.json(serialize(prices));
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch prices' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const user = await authorize(['OWNER', 'MANAGER', 'FINANCE', 'STAFF']);
        const { tenantId } = user;
        const body = await request.json();
        const { name, pricePerHour, outletId } = body;

        if (!name || !pricePerHour || !outletId) {
            return NextResponse.json({ error: 'Name, price, and outletId are required' }, { status: 400 });
        }

        const price = await (prisma as any).rentalPsPrice.upsert({
            where: {
                tenantId_outletId_name: {
                    tenantId,
                    outletId,
                    name
                }
            },
            update: {
                pricePerHour: Number(pricePerHour),
                isActive: true
            },
            create: {
                tenantId,
                outletId,
                name,
                pricePerHour: Number(pricePerHour)
            }
        });

        return NextResponse.json(serialize(price));
    } catch (error: any) {
        console.error('Price Update Error:', error);
        return NextResponse.json({ error: 'Failed to update price', details: error.message }, { status: 500 });
    }
}
