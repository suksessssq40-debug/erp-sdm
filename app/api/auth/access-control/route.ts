
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authorize } from '@/lib/auth';
import { UserRole } from '@/types';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const admin = await authorize([UserRole.OWNER, UserRole.SUPERADMIN]);
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    
    if (userId) {
        // Fetch specific user access
        const access = await prisma.tenantAccess.findMany({
            where: { userId },
            include: {
                tenant: { select: { name: true } }
            }
        });
        return NextResponse.json(access);
    }

    // Get all users and their tenant access list
    const users = await prisma.user.findMany({
      select: {
          id: true,
          name: true,
          username: true,
          role: true,
          tenantAccess: {
              include: {
                  tenant: { select: { id: true, name: true } }
              }
          }
      },
      orderBy: { name: 'asc' }
    });

    return NextResponse.json(users);
  } catch (error) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }
}

export async function POST(request: Request) {
  try {
    const admin = await authorize([UserRole.OWNER, UserRole.SUPERADMIN]);
    const body = await request.json();
    const { userId, tenantId, role, isActive } = body;

    if (!userId || !tenantId) {
      return NextResponse.json({ error: 'User ID and Tenant ID are required' }, { status: 400 });
    }

    const access = await prisma.tenantAccess.upsert({
      where: {
        userId_tenantId: {
          userId,
          tenantId
        }
      },
      update: {
        role: role || 'STAFF',
        isActive: isActive !== undefined ? isActive : true
      },
      create: {
        id: `acc_${userId}_${tenantId}`,
        userId,
        tenantId,
        role: role || 'STAFF',
        isActive: true
      }
    });

    return NextResponse.json(access);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to update access' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
    try {
        const admin = await authorize([UserRole.OWNER, UserRole.SUPERADMIN]);
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('userId');
        const tenantId = searchParams.get('tenantId');

        if (!userId || !tenantId) {
            return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
        }

        await prisma.tenantAccess.delete({
            where: {
                userId_tenantId: {
                    userId,
                    tenantId
                }
            }
        });

        return NextResponse.json({ success: true });
    } catch (e) {
        return NextResponse.json({ error: 'Failed' }, { status: 500 });
    }
}
