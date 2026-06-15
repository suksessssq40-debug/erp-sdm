
import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { authorize } from '@/lib/auth';

export async function GET() {
  try {
    const user = await authorize(['OWNER', 'FINANCE', 'MANAGER']);
    const { tenantId } = user;

    const res = await pool.query('SELECT * FROM business_units WHERE tenant_id = $1 AND is_active = true ORDER BY name ASC', [tenantId]);
    
    // Map snake_case to camelCase
    const units = res.rows.map(row => ({
      id: row.id,
      name: row.name,
      description: row.description,
      isActive: row.is_active,
      tenantId: row.tenant_id
    }));
    
    return NextResponse.json(units);
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
    
    if (!body.name) {
        return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const id = Math.random().toString(36).substr(2, 9);
    
    await pool.query(
      `INSERT INTO business_units (id, tenant_id, name, description, is_active)
       VALUES ($1, $2, $3, $4, $5)`,
      [id, tenantId, body.name, body.description || '', true]
    );

    return NextResponse.json({
        id,
        tenantId,
        name: body.name,
        description: body.description || '',
        isActive: true
    }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
