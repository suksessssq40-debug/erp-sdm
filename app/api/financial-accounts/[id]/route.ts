
import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { authorize } from '@/lib/auth';

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await authorize(['OWNER', 'FINANCE']); 
    const { tenantId } = user;
    const id = params.id;
    const body = await request.json();

    if (!body.name || !body.bankName) {
      return NextResponse.json({ error: 'Name and Bank Name are required' }, { status: 400 });
    }

    // 1. Get existing account within tenant
    const existingRes = await pool.query('SELECT name FROM financial_accounts WHERE id = $1 AND tenant_id = $2', [id, tenantId]);
    if (existingRes.rowCount === 0) {
        return NextResponse.json({ error: 'Account not found or unauthorized' }, { status: 404 });
    }
    const oldName = existingRes.rows[0].name;

    // 2. Update Account
    await pool.query(
      `UPDATE financial_accounts 
       SET name = $1, bank_name = $2, account_number = $3, description = $4, is_active = $5
       WHERE id = $6 AND tenant_id = $7`,
      [body.name, body.bankName, body.accountNumber || '-', body.description || '', body.isActive ?? true, id, tenantId]
    );

    // 3. Cascade Update Transactions if name changed
    if (oldName !== body.name) {
        await pool.query('UPDATE transactions SET account = $1 WHERE account = $2 AND tenant_id = $3', [body.name, oldName, tenantId]);
    }

    const updated = {
      id,
      name: body.name,
      bankName: body.bankName,
      accountNumber: body.accountNumber || '-',
      description: body.description || '',
      isActive: body.isActive ?? true
    };

    return NextResponse.json(updated);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
    try {
        const user = await authorize(['OWNER', 'FINANCE']);
        const { tenantId } = user;
        const id = params.id;
        
        // Soft delete within tenant
        const res = await pool.query('UPDATE financial_accounts SET is_active = false WHERE id = $1 AND tenant_id = $2', [id, tenantId]);
        if (res.rowCount === 0) return NextResponse.json({ error: 'Account not found' }, { status: 404 });
        
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Failed' }, { status: 500 });
    }
}
