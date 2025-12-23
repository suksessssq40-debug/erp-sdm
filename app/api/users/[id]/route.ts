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

// PUT: Update User (Modified to allow Self-Update & Profile Fields)
export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    // 1. Get authenticated user
    const currentUser = await authorize(); 
    const { id } = params;

    // 2. Check Permissions:
    // Allowed if: Role is Management OR It is their own profile (Self-Update)
    const isManagement = ['OWNER', 'MANAGER', 'FINANCE', 'SUPERADMIN'].includes(currentUser.role);
    const isSelf = currentUser.id === id;

    if (!isManagement && !isSelf) {
       return NextResponse.json({ error: 'Forbidden: You can only edit your own profile.' }, { status: 403 });
    }

    const body = await request.json();
    const { name, username, telegramId, telegramUsername, role, password, avatarUrl, jobTitle, bio } = body;

    // 3. Prevent Staff from changing their own Role or Telegram ID (Security)
    // Only Management can change sensitive fields (Role, TelegramID)
    // If Self-Update (Staff), force keep existing role/telegram? 
    // For simplicity: We trust the body BUT if user is NOT management, ignore Role changes to be safe.
    
    // Construct Query
    // Construct Query Dynamically to support Partial Updates
    const updateFields: string[] = [];
    const values: any[] = [];
    let counter = 1;

    if (name !== undefined) {
      updateFields.push(`name = $${counter++}`);
      values.push(name);
    }
    if (username !== undefined) {
      updateFields.push(`username = $${counter++}`);
      values.push(username);
    }
    if (telegramUsername !== undefined) {
      updateFields.push(`telegram_username = $${counter++}`);
      values.push(telegramUsername);
    }

    if (role && isManagement) { // Only Management can change role
        updateFields.push(`role = $${counter++}`);
        values.push(role);
    }
    
    if (telegramId && isManagement) { // Only Management can change system IDs
        updateFields.push(`telegram_id = $${counter++}`);
        values.push(telegramId);
    }

    if (avatarUrl !== undefined) {
        updateFields.push(`avatar_url = $${counter++}`);
        values.push(avatarUrl);
    }

    if (jobTitle !== undefined) {
        updateFields.push(`job_title = $${counter++}`);
        values.push(jobTitle);
    }

    if (bio !== undefined) {
        updateFields.push(`bio = $${counter++}`);
        values.push(bio);
    }

    if (password && password.length >= 6) {
      const hash = await bcrypt.hash(password, 10);
      updateFields.push(`password_hash = $${counter++}`);
      values.push(hash);
    }

    if (updateFields.length === 0) {
       return NextResponse.json({ message: 'No changes detected' });
    }

    const query = `UPDATE users SET ${updateFields.join(', ')} WHERE id = $${counter} RETURNING *`;
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
      deviceId: u.device_id,
      avatarUrl: u.avatar_url,
      jobTitle: u.job_title,
      bio: u.bio
    });
  } catch (error: any) {
    console.error('Update User Error:', error);
    if (error.code === '23505') {
       return NextResponse.json({ error: 'Username already taken' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
  }
}
