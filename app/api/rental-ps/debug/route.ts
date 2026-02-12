
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { serialize } from '@/lib/serverUtils';

export async function GET() {
    try {
        const settings = await prisma.settings.findMany();
        return NextResponse.json(serialize(settings));
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
