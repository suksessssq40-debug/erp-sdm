
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authorize } from '@/lib/auth';
import { serialize, recordSystemLog } from '@/lib/serverUtils';

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
                rentalPsTargetTenantId: true,
                rentalPsTargetBusinessUnitId: true
            }
        });

        const { searchParams } = new URL(request.url);
        const targetTenant = searchParams.get('target') || settings?.rentalPsTargetTenantId || 'sdm';

        // 2. Fetch all available Tenants
        // Using prisma.tenant directly since generate was successful
        const tenants = await (prisma as any).tenant.findMany({
            where: { isActive: true },
            select: { id: true, name: true },
            orderBy: { name: 'asc' }
        });

        console.log(`[RentalSettings] User: ${user.username}, Role: ${user.role}, UserTenant: ${user.tenantId}`);
        console.log(`[RentalSettings] Fetched ${tenants.length} tenants. Target: ${targetTenant}`);

        // 3. Fetch financial accounts
        const financialAccounts = await (prisma as any).financialAccount.findMany({
            where: { tenantId: targetTenant, isActive: true },
            select: { id: true, name: true, bankName: true, accountNumber: true }
        });

        // 4. Fetch COAs
        const coas = await (prisma as any).chartOfAccount.findMany({
            where: { tenantId: targetTenant, isActive: true },
            orderBy: { code: 'asc' },
            select: { id: true, code: true, name: true }
        });

        // 5. Fetch Business Units
        const businessUnits = await (prisma as any).businessUnit.findMany({
            where: { tenantId: targetTenant, isActive: true },
            select: { id: true, name: true }
        });

        return NextResponse.json(serialize({
            settings: settings || {
                rentalPsCashAccountId: '',
                rentalPsTransferAccountId: '',
                rentalPsReceivableCoaId: '',
                rentalPsSalesCoaId: '',
                rentalPsTargetTenantId: 'sdm',
                rentalPsTargetBusinessUnitId: 'eke1tjt1u'
            },
            financialAccounts,
            coas,
            tenants,
            businessUnits
        }));
    } catch (e: any) {
        console.error('Fetch Rental Settings Error:', e);
        return NextResponse.json({ error: 'Failed', message: e.message }, { status: 500 });
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
            rentalPsTargetTenantId,
            rentalPsTargetBusinessUnitId
        } = body;

        const existing = await (prisma as any).settings.findFirst({ where: { tenantId: user.tenantId } });

        const data = {
            rentalPsCashAccountId,
            rentalPsTransferAccountId,
            rentalPsReceivableCoaId,
            rentalPsSalesCoaId,
            rentalPsTargetTenantId,
            rentalPsTargetBusinessUnitId
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
