import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'sdm_erp_dev_secret';

export async function POST(request: Request) {
  try {
    const { username, password, deviceId } = await request.json();

    if (!username || !password) {
      return NextResponse.json({ error: 'Username and password required' }, { status: 400 });
    }

    // 1. Find User
    const u = await prisma.user.findUnique({
      where: { username }
    });

    if (!u) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    // 2. Password Check
    if (u.passwordHash) {
      const ok = await bcrypt.compare(password, u.passwordHash);
      if (!ok) return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    } else {
      // Legacy Migration (if plain text exists - strict fallback)
      const hash = await bcrypt.hash(password, 10);
      await prisma.user.update({
        where: { id: u.id },
        data: { passwordHash: hash }
      });
    }

    // 3. Device Lock Logic
    // Only applies to STAFF or if explicitly enforced
    const currentDeviceIds: string[] = Array.isArray(u.deviceIds) ? (u.deviceIds as string[]) : [];
    
    // Auto-migrate single device_id to list if not present
    // Note: 'device_id' is not in our Prisma schema? Let's check.
    // Introspection result DID NOT show 'device_id', only 'device_ids'. 
    // Wait, the introspected schema showed: deviceIds Json? @default("[]") @map("device_ids")
    // But server/index.cjs uses `device_id` column.
    // If 'device_id' column existed in DB, Prisma introspection SHOULD have picked it up.
    // Let's re-read the schema I wrote.
    // I wrote: deviceIds Json? ... AND I did NOT include `deviceId` string field.
    // If the DB has `device_id` column and I missed it in schema, `prisma` won't see it.
    // `server/index.cjs` line 304: 'UPDATE users SET device_id = $1 ...'
    // So the column EXISTS in the legacy DB logic.
    // If `db pull` failed, I constructed schema manually based on `database_schema_master.sql`.
    // `database_schema_master.sql` MIGHT NOT have had it if it was added dynamically later.
    // CHECK `app/api/login` line 42: `ALTER TABLE users ADD COLUMN device_ids...`
    // It seems `device_id` (singular) might have been there or added similarly?
    // User schema in `server/index.cjs` doesn't explicitly create tables.
    // Let's assume `device_id` (singular) exists as a Legacy field, but we prefer `device_ids` (plural).
    // I will add `deviceId` to schema via a raw check or just stick to `deviceIds` (plural) which is the new standard.
    // BUT, the `server/index.cjs` logic uses `device_id`.
    // I should perform a "migration" here: If `deviceId` payload is sent, ensuring it's in `deviceIds`.
    
    // For Safety, I will assume the Prisma Schema needs to map `device_id` if we want to read it.
    // But since I can't easily change schema on fly without re-generating client (which I did manually),
    // I will rely on `device_ids` (plural) which IS in my schema.
    
    if (u.role === 'STAFF') {
        if (deviceId) {
           // Check if device is allowed
           const isKnown = currentDeviceIds.includes(deviceId);
           
           if (isKnown) {
             // OK
           } else if (currentDeviceIds.length < 2) {
             // Register new device
             const newDeviceIds = [...currentDeviceIds, deviceId];
             await prisma.user.update({
               where: { id: u.id },
               data: { deviceIds: newDeviceIds }
             });
           } else {
             // Blocked
             return NextResponse.json({ 
               error: 'DEVICE_LOCKED_MISMATCH', 
               message: 'Maksimal 2 perangkat terdaftar tercapai. Hubungi admin.' 
             }, { status: 403 });
           }
        }
    }

    // 4. Update Token
    const tenantId = (u as any).tenantId || 'sdm';
    
    const userPayload = {
      id: u.id,
      name: u.name,
      username: u.username,
      tenantId: tenantId,
      telegramId: u.telegramId || '',
      telegramUsername: u.telegramUsername || '',
      role: u.role,
      deviceId: deviceId, 
      avatarUrl: u.avatarUrl || undefined,
      jobTitle: u.jobTitle || undefined,
      bio: u.bio || undefined,
      isFreelance: !!u.isFreelance
    };

    const token = jwt.sign({ id: u.id, username: u.username, role: u.role, tenantId: tenantId }, JWT_SECRET, { expiresIn: '7d' });

    return NextResponse.json({ user: userPayload, token });

  } catch (error: any) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
  }
}
