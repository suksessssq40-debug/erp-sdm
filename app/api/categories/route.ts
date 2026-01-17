
import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { authorize } from '@/lib/auth';

export async function GET() {
  try {
    const user = await authorize(['OWNER', 'FINANCE', 'MANAGER']);
    const { tenantId } = user;

    const res = await pool.query('SELECT * FROM transaction_categories WHERE tenant_id = $1 ORDER BY type, name ASC', [tenantId]);
    
    // Map snake_case to camelCase
    const categories = res.rows.map(row => ({
      id: row.id,
      name: row.name,
      type: row.type,
      parentId: row.parent_id,
      tenantId: row.tenant_id
    }));
    
    return NextResponse.json(categories);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await authorize(['OWNER', 'FINANCE']);
    const { tenantId } = user;
    const body = await request.json();
    
    if (!body.name || !body.type) {
        return NextResponse.json({ error: 'Name and Type are required' }, { status: 400 });
    }

    const id = Math.random().toString(36).substr(2, 9);
    
    await pool.query(
      `INSERT INTO transaction_categories (id, tenant_id, name, type, parent_id)
       VALUES ($1, $2, $3, $4, $5)`,
      [id, tenantId, body.name, body.type, body.parentId || null]
    );

    return NextResponse.json({
        id,
        tenantId,
        name: body.name,
        type: body.type,
        parentId: body.parentId || null
    }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
