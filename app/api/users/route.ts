import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { authorize } from '@/lib/auth';
import bcrypt from 'bcryptjs';

export async function POST(request: Request) {
  try {
    await authorize(['OWNER', 'MANAGER']);
    const { id, name, username, telegramId, telegramUsername, role, password } = await request.json();
    
    if (!id || !name || !username || !role) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    if (!password || password.length < 6) return NextResponse.json({ error: 'Weak password' }, { status: 400 });

    const hash = await bcrypt.hash(password, 10);
    
    try {
        await pool.query(
          'INSERT INTO users (id, name, username, telegram_id, telegram_username, role, password_hash) VALUES ($1, $2, $3, $4, $5, $6, $7)',
          [id, name, username, telegramId || '', telegramUsername || '', role, hash]
        );
        return NextResponse.json({ id, name, username, telegramId, telegramUsername, role }, { status: 201 });
    } catch (e: any) {
        if (e.code === '23505') { 
          return NextResponse.json({ error: 'Username already exists' }, { status: 409 });
        }
        throw e;
    }
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
  }
}
