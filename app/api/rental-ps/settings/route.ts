
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authorize } from '@/lib/auth';
import { serialize } from '@/lib/serverUtils';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const user = await authorize(['OWNER', 'MANAGER', 'FINANCE']);

        // 1. Fetch current settings for the tenant
        const settings = await (prisma as any).settings.findUnique({
            where: { tenantId: user.tenantId },
            select: {
                rentalPsCashAccountId: true,
                rentalPsTransferAccountId: true,
                rentalPsReceivableCoaId: true,
                rentalPsSalesCoaId: true,
                rentalPsTargetTenantId: true
            }
        });

        const { searchParams } = new URL(request.url);
        const targetTenant = searchParams.get('target') || settings?.rentalPsTargetTenantId || 'sdm';

        // 2. Fetch all available Tenants (for target selection)
        const tenants = await prisma.tenant.findMany({
            select: { id: true, name: true }
        });

        // 3. Fetch all available financial accounts (Bank/Cash) from TARGET tenant
        const financialAccounts = await prisma.financialAccount.findMany({
            where: { tenantId: targetTenant, isActive: true },
            select: { id: true, name: true, bankName: true, accountNumber: true }
        });

        // 4. Fetch all available COAs from TARGET tenant
        const coas = await prisma.chartOfAccount.findMany({
            where: { tenantId: targetTenant, isActive: true },
            orderBy: { code: 'asc' },
            select: { id: true, code: true, name: true }
        });

        return NextResponse.json(serialize({
            settings: settings || {
                rentalPsCashAccountId: null,
                rentalPsTransferAccountId: null,
                rentalPsReceivableCoaId: null,
                rentalPsSalesCoaId: null,
                rentalPsTargetTenantId: 'sdm'
            },
            financialAccounts,
            coas,
            tenants
        }));
    } catch (e: any) {
        console.error('Fetch Rental Settings Error:', e);
        return NextResponse.json({ error: 'Failed' }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        const user = await authorize(['OWNER', 'FINANCE']);
        const body = await request.json();
        const {
            rentalPsCashAccountId,
            rentalPsTransferAccountId,
            rentalPsReceivableCoaId,
            rentalPsSalesCoaId,
            rentalPsTargetTenantId
        } = body;

        const existing = await (prisma as any).settings.findFirst({ where: { tenantId: user.tenantId } });

        const data = {
            rentalPsCashAccountId,
            rentalPsTransferAccountId,
            rentalPsReceivableCoaId,
            rentalPsSalesCoaId,
            rentalPsTargetTenantId
        };

        if (!existing) {
            await (prisma as any).settings.create({
                data: {
                    tenantId: user.tenantId,
                    ...data
                }
            });
        } else {
            await (prisma as any).settings.update({
                where: { id: existing.id },
                data
            });
        }

        return NextResponse.json({ success: true });
    } catch (e: any) {
        console.error('Update Rental Settings Error:', e);
        return NextResponse.json({ error: 'Failed' }, { status: 500 });
    }
}
