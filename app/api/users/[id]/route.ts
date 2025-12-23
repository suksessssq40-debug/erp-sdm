import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { authorize } from '@/lib/auth';
import bcrypt from 'bcryptjs';

// DELETE: Hapus User (Updated with Cascade Deletes)
export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    await authorize(['OWNER', 'MANAGER', 'FINANCE']);
    const { id } = params;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Delete Foreign Key Dependencies
      await client.query('DELETE FROM salary_configs WHERE user_id = $1', [id]);
      await client.query('DELETE FROM attendance WHERE user_id = $1', [id]);
      await client.query('DELETE FROM leave_requests WHERE user_id = $1', [id]);
      await client.query('DELETE FROM payroll_records WHERE user_id = $1', [id]);
      await client.query('DELETE FROM daily_reports WHERE user_id = $1', [id]);
      
      // Note: Transactions, Projects usually linked via JSON arrays or many-to-many, 
      // check if tasks/comments need deletion. Assuming soft-links for now or handled by DB.
      
      // 2. Delete User
      const res = await client.query('DELETE FROM users WHERE id = $1 RETURNING id', [id]);
      
      if (res.rowCount === 0) {
        await client.query('ROLLBACK');
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }

      await client.query('COMMIT');
      return NextResponse.json({ success: true, id });

    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }

  } catch (error: any) {
    console.error('Delete User Error:', error);
    return NextResponse.json({ error: error.detail || 'Failed to delete user' }, { status: 500 });
  }
}

// PUT: Update User
export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    await authorize(['OWNER', 'MANAGER', 'FINANCE']);
    const { id } = params;
    const body = await request.json();
    const { name, username, telegramId, telegramUsername, role, password } = body;

    // Build update query dynamically
    let query = 'UPDATE users SET name = $1, username = $2, telegram_id = $3, telegram_username = $4, role = $5';
    let values = [name, username, telegramId, telegramUsername, role];
    let counter = 6;

    if (password && password.length >= 6) {
      const hash = await bcrypt.hash(password, 10);
      query += `, password_hash = $${counter}`;
      values.push(hash);
      counter++;
    }

    query += ` WHERE id = $${counter} RETURNING *`;
    values.push(id);

    const res = await pool.query(query, values);

    if (res.rowCount === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const u = res.rows[0];
    return NextResponse.json({
      id: u.id,
      name: u.name,
      username: u.username,
      telegramId: u.telegram_id,
      telegramUsername: u.telegram_username,
      role: u.role,
      deviceId: u.device_id
    });
  } catch (error: any) {
    console.error('Update User Error:', error);
    if (error.code === '23505') {
       return NextResponse.json({ error: 'Username already taken' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
  }
}
