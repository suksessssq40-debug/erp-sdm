import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'sdm_erp_dev_secret';

export async function POST(request: Request) {
  try {
    const { username, password, deviceId } = await request.json();

    if (!username || !password) {
      return NextResponse.json({ error: 'Username and password required' }, { status: 400 });
    }

    const { rows } = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    if (rows.length === 0) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const u = rows[0];

    // Password Check
    if (u.password_hash) {
      const ok = await bcrypt.compare(password, u.password_hash);
      if (!ok) return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    } else {
      // Lazy migration for plain text (if any - though we should avoid this in prod)
      const hash = await bcrypt.hash(password, 10);
      await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, u.id]);
    }

    // Device Lock Check
    // 3. Device Lock Check (Max 2 Devices for STAFF)
    if (u.role === 'STAFF') {
        // Auto-Migration: Ensure device_ids column exists
        try {
           await pool.query(`
             DO $$ 
             BEGIN 
               IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='device_ids') THEN
                 ALTER TABLE users ADD COLUMN device_ids JSONB DEFAULT '[]';
               END IF;
             END $$;
           `);
        } catch(e) {}

        const resIds = await pool.query('SELECT device_ids FROM users WHERE id = $1', [u.id]);
        let knownDevices: string[] = resIds.rows[0]?.device_ids || [];
        
        // Backward compatibility migration
        if (u.device_id && !knownDevices.includes(u.device_id)) {
           knownDevices.push(u.device_id);
        }

        if (deviceId) {
           // Allow if device is already known
           if (knownDevices.includes(deviceId)) {
              // Refresh single device_id to current for legacy UI
              if (u.device_id !== deviceId) {
                  await pool.query('UPDATE users SET device_id = $1 WHERE id = $2', [deviceId, u.id]);
              }
           } 
           // If slot available, register new device
           else if (knownDevices.length < 2) {
              knownDevices.push(deviceId);
              await pool.query('UPDATE users SET device_ids = $1, device_id = $2 WHERE id = $3', [JSON.stringify(knownDevices), deviceId, u.id]);
           } 
           // Too many devices
           else {
              return NextResponse.json({ error: 'DEVICE_LOCKED_MISMATCH', message: 'Maksimal 2 perangkat terdaftar tercapai. Hubungi admin untuk reset.' }, { status: 403 });
           }
        }
    } else {
        // For non-staff, just record it if provided to keep basic lock info or audit
        if (deviceId && u.device_id !== deviceId) {
            await pool.query('UPDATE users SET device_id = $1 WHERE id = $2', [deviceId, u.id]);
        }
    }

    const userPayload = {
      id: u.id,
      name: u.name,
      username: u.username,
      telegramId: u.telegram_id || '',
      telegramUsername: u.telegram_username || '',
      role: u.role,
      deviceId: u.device_id || deviceId
    };

    const token = jwt.sign({ id: u.id, role: u.role }, JWT_SECRET, { expiresIn: '7d' });

    return NextResponse.json({ user: userPayload, token });

  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
