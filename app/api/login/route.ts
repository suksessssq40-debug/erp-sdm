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
    // Device Lock Check (Only applies to STAFF to prevent attendance fraud)
    if (u.role === 'STAFF' && u.device_id && deviceId && u.device_id !== deviceId) {
       return NextResponse.json({ error: 'DEVICE_LOCKED_MISMATCH', message: 'Locked to another device.' }, { status: 403 });
    }
    if (!u.device_id && deviceId) {
      await pool.query('UPDATE users SET device_id = $1 WHERE id = $2', [deviceId, u.id]);
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
