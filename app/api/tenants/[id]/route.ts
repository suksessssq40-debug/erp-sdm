
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authorize } from '@/lib/auth';
import { UserRole } from '@/types';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    // Allow all authenticated users to fetch basic tenant info (needed for App Shell / Attendance)
    const user = await authorize(); 
    const tenantId = params.id;

    // Security: Users can only fetch their own tenant (unless SuperAdmin)
    if (user.role !== UserRole.SUPERADMIN && user.tenantId !== tenantId) {
         return NextResponse.json({ error: 'Unauthorized access to this tenant' }, { status: 403 });
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        settings: true,
        shifts: true
      }
    });

    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }

    // Sanitize Sensitive Data for Non-Admins
    if (user.role !== UserRole.OWNER && user.role !== UserRole.SUPERADMIN) {
        if (tenant.settings) {
            // Mask sensitive tokens
            tenant.settings.telegramBotToken = null; 
            tenant.settings.telegramOwnerChatId = null;
        }
    }

    return NextResponse.json(tenant);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to fetch tenant' }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await authorize([UserRole.OWNER, UserRole.SUPERADMIN]);
    const tenantId = params.id;
    const body = await request.json();
    const { name, description, workStrategy, radiusTolerance, lateGracePeriod, isActive, featuresJson } = body;

    const updated = await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        name,
        description,
        workStrategy,
        radiusTolerance: radiusTolerance !== undefined ? Number(radiusTolerance) : undefined,
        lateGracePeriod: lateGracePeriod !== undefined ? Number(lateGracePeriod) : undefined,
        isActive,
        featuresJson
      }
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to update tenant' }, { status: 500 });
  }
}
