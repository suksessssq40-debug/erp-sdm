
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authorize } from '@/lib/auth';
import { recordSystemLog, serialize } from '@/lib/serverUtils';

export async function GET(request: Request) {
    try {
        const user = await authorize(['OWNER', 'MANAGER', 'FINANCE', 'STAFF']);
        const outlets = await (prisma as any).rentalPsOutlet.findMany({
            where: { tenantId: user.tenantId },
            orderBy: { name: 'asc' }
        });
        return NextResponse.json(serialize(outlets));
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const user = await authorize(['OWNER', 'MANAGER', 'FINANCE']);
        const { name } = await request.json();

        if (!name) return NextResponse.json({ error: 'Nama outlet diperlukan' }, { status: 400 });

        const outlet = await (prisma as any).rentalPsOutlet.create({
            data: {
                name,
                tenantId: user.tenantId
            }
        });

        await recordSystemLog({
            actorId: user.id, actorName: user.name, actorRole: user.role, tenantId: user.tenantId,
            actionType: 'RENTAL_OUTLET_CREATE',
            details: `Menambah outlet baru: ${name}`,
            targetObj: 'RentalPsOutlet'
        });

        return NextResponse.json(serialize(outlet));
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        const user = await authorize(['OWNER', 'MANAGER', 'FINANCE']);
        const { id, name, isActive } = await request.json();

        if (!id) return NextResponse.json({ error: 'ID outlet diperlukan' }, { status: 400 });

        const outlet = await (prisma as any).rentalPsOutlet.update({
            where: { id, tenantId: user.tenantId },
            data: { name, isActive }
        });

        await recordSystemLog({
            actorId: user.id, actorName: user.name, actorRole: user.role, tenantId: user.tenantId,
            actionType: 'RENTAL_OUTLET_UPDATE',
            details: `Mengupdate outlet: ${name} (Active: ${isActive})`,
            targetObj: 'RentalPsOutlet'
        });

        return NextResponse.json(serialize(outlet));
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const user = await authorize(['OWNER', 'MANAGER']);
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) return NextResponse.json({ error: 'ID outlet diperlukan' }, { status: 400 });

        // Check if has records
        const hasRecords = await (prisma as any).rentalRecord.findFirst({ where: { outletId: id } });
        if (hasRecords) return NextResponse.json({ error: 'Outlet tidak bisa dihapus karena sudah memiliki histori transaksi. Silakan nonaktifkan saja.' }, { status: 400 });

        await (prisma as any).rentalPsOutlet.delete({
            where: { id, tenantId: user.tenantId }
        });

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
