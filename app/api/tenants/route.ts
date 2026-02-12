
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authorize } from '@/lib/auth';
import { UserRole } from '@/types';
export const dynamic = 'force-dynamic';

// Admin-only API to Manage Tenants (Offices)
export async function GET(request: Request) {
    try {
        const user = await authorize([UserRole.OWNER, UserRole.SUPERADMIN]);

        // Fetch all tenants
        const tenants = await prisma.tenant.findMany({
            orderBy: { createdAt: 'desc' },
            include: {
                // Optional: Count users strictly for this tenant
                _count: {
                    select: { users: true }
                }
            }
        });

        return NextResponse.json(tenants);
    } catch (e) {
        console.error(e);
        return NextResponse.json({ error: 'Failed to fetch tenants' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const user = await authorize([UserRole.OWNER, UserRole.SUPERADMIN]);
        const body = await request.json();
        const { id, name, description, features, workStrategy, radiusTolerance, lateGracePeriod } = body;

        const selectedFeatures = Array.isArray(features) ? features : [];

        if (!id || !name) {
            return NextResponse.json({ error: 'ID (slug) and Name are required' }, { status: 400 });
        }

        const tenantIdSlug = id.toLowerCase().trim().replace(/\s+/g, '-');

        // 1. Check existing
        const existing = await prisma.tenant.findUnique({ where: { id: tenantIdSlug } });
        if (existing) {
            return NextResponse.json({ error: `ID Kantor "${tenantIdSlug}" sudah terdaftar. Gunakan ID lain.` }, { status: 409 });
        }

        console.log(`Creating tenant: ${tenantIdSlug}...`);
        // 2. Create Tenant (Transaction)
        const newTenant = await prisma.$transaction(async (tx) => {
            // A. Create Tenant
            const t = await tx.tenant.create({
                data: {
                    id: tenantIdSlug,
                    name,
                    description: description || '',
                    isActive: true,
                    featuresJson: JSON.stringify(selectedFeatures),
                    workStrategy: workStrategy || 'FIXED',
                    radiusTolerance: Number(radiusTolerance) || 50,
                    lateGracePeriod: Number(lateGracePeriod) || 15
                }
            });

            // B. Create Settings explicit linking
            await tx.settings.create({
                data: {
                    tenantId: t.id, // Explicitly link
                    officeLat: -6.1754,
                    officeLng: 106.8272,
                    officeStartTime: '08:00',
                    officeEndTime: '17:00',
                    telegramBotToken: '',
                    telegramGroupId: '',
                    telegramOwnerChatId: '',
                    dailyRecapTime: '17:00',
                    dailyRecapContent: '["attendance", "kanban"]',
                    companyProfileJson: JSON.stringify({
                        name: name,
                        address: 'Alamat Kantor...',
                        phone: '08...'
                    })
                } as any
            });

            return t;
        });

        // 3. ENROLL THE OWNER as the Admin of the NEW Tenant (Unified Identity)
        // We don't create a new user record anymore. We just link the existing user to the new tenant.
        await prisma.tenantAccess.upsert({
            where: {
                userId_tenantId: {
                    userId: user.id,
                    tenantId: tenantIdSlug
                }
            },
            update: { role: 'OWNER', isActive: true },
            create: {
                userId: user.id,
                tenantId: tenantIdSlug,
                role: 'OWNER',
                isActive: true
            }
        });

        // 4. Also init the General Chat Room for this new tenant
        try {
            await prisma.chatRoom.upsert({
                where: { id: `general-${tenantIdSlug}` },
                update: {},
                create: {
                    id: `general-${tenantIdSlug}`,
                    tenantId: tenantIdSlug,
                    name: 'General Forum',
                    type: 'GROUP',
                    createdBy: 'system',
                    createdAt: BigInt(Date.now())
                } as any
            });

            // Add the owner to this room (using unified user ID)
            await prisma.chatMember.upsert({
                where: {
                    roomId_userId: {
                        roomId: `general-${tenantIdSlug}`,
                        userId: user.id
                    }
                },
                update: {},
                create: {
                    roomId: `general-${tenantIdSlug}`,
                    userId: user.id,
                    joinedAt: BigInt(Date.now())
                } as any
            });
        } catch (e) {
            console.warn("Auto-chat init failed in tenant creation:", e);
        }

        return NextResponse.json({ tenant: newTenant });
    } catch (error: any) {
        console.error('Tenant Creation Error:', error);
        // Provide a more helpful error message
        let message = 'Gagal membuat kantor baru';
        if (error.code === 'P2002') {
            message = `Gagal: ID atau Data yang dimasukkan sudah terdaftar (${error.meta?.target || 'id'})`;
        }
        return NextResponse.json({ error: message, detail: error.message }, { status: 500 });
    }
}
