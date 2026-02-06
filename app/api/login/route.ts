import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { recordSystemLog } from '@/lib/serverUtils';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'sdm_erp_dev_secret';

export async function POST(request: Request) {
  try {
    const { username, password, deviceId } = await request.json();

    if (!username || !password) {
      return NextResponse.json({ error: 'Username and password required' }, { status: 400 });
    }

    const u = await prisma.user.findFirst({
      where: {
        username: {
          equals: username,
          mode: 'insensitive'
        }
      }
    });

    if (!u) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    if (u.passwordHash) {
      const ok = await bcrypt.compare(password, u.passwordHash);
      if (!ok) {
        return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
      }
    } else {
      const hash = await bcrypt.hash(password, 10);
      await prisma.user.update({
        where: { id: u.id },
        data: { passwordHash: hash }
      });
    }

    const currentDeviceIds: string[] = Array.isArray(u.deviceIds) ? (u.deviceIds as string[]) : [];
    const legacyDeviceId = (u as any).deviceId;

    let updatedDeviceIds = [...currentDeviceIds];
    const isOwner = u.role === 'OWNER';

    if (!isOwner && u.role === 'STAFF' && deviceId) {
      if (!updatedDeviceIds.includes(deviceId)) {
        if (updatedDeviceIds.length < 2) {
          updatedDeviceIds.push(deviceId);
          await prisma.user.update({
            where: { id: u.id },
            data: { deviceIds: updatedDeviceIds }
          });
          await recordSystemLog({
            actorId: u.id, actorName: u.name || 'Unknown', actorRole: u.role || 'STAFF',
            actionType: 'DEVICE_REGISTER', details: `Mendaftarkan perangkat baru: ${deviceId}`,
            targetObj: 'User', tenantId: u.tenantId || 'sdm'
          });
        } else {
          return NextResponse.json({
            error: 'DEVICE_LOCKED_MISMATCH',
            message: 'Maksimal 2 perangkat terdaftar tercapai. Hubungi admin.'
          }, { status: 403 });
        }
      }
    }

    const tenantId = u.tenantId || 'sdm';
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { featuresJson: true }
    });
    const features = tenant?.featuresJson || '[]';

    const userPayload = {
      id: u.id,
      name: u.name,
      username: u.username,
      tenantId: tenantId,
      telegramId: (u.telegramId as string | null) || '',
      telegramUsername: (u.telegramUsername as string | null) || '',
      role: u.role,
      deviceId: deviceId,
      avatarUrl: (u.avatarUrl as string | null) || undefined,
      isFreelance: !!u.isFreelance,
      features: features
    };

    const token = jwt.sign(userPayload, JWT_SECRET, { expiresIn: '30d' });

    await recordSystemLog({
      actorId: u.id, actorName: u.name || 'Unknown', actorRole: u.role || 'STAFF',
      actionType: 'LOGIN', details: `Login berhasil${deviceId ? ` via perangkan ${deviceId}` : ''}`,
      targetObj: 'User', tenantId
    });

    return NextResponse.json({ user: userPayload, token });

  } catch (error: any) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
  }
}

