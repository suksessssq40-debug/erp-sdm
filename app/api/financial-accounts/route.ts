
import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { authorize } from '@/lib/auth';

export async function GET() {
  try {
    const user = await authorize(['OWNER', 'FINANCE', 'MANAGER']);
    const { tenantId } = user;

    const res = await pool.query('SELECT * FROM financial_accounts WHERE tenant_id = $1 AND is_active = true ORDER BY created_at ASC', [tenantId]);
    
    const accounts = res.rows.map(row => ({
      id: row.id,
      name: row.name,
      bankName: row.bank_name,
      accountNumber: row.account_number,
      description: row.description,
      isActive: row.is_active,
      balance: row.balance, // FIX: Sertakan saldo
      tenantId: row.tenant_id
    }));
    return NextResponse.json(accounts);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to fetch accounts' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await authorize(['OWNER', 'FINANCE']);
    const { tenantId } = user;
    const body = await request.json();
    
    if (!body.name || !body.bankName) {
      return NextResponse.json({ error: 'Name and Bank Name are required' }, { status: 400 });
    }

    const id = Math.random().toString(36).substr(2, 9);
    const now = Date.now();
    
    await pool.query(
      `INSERT INTO financial_accounts (id, tenant_id, name, bank_name, account_number, description, is_active, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [id, tenantId, body.name, body.bankName, body.accountNumber || '-', body.description || '', true, now]
    );

    const newAccount = {
      id,
      tenantId,
      name: body.name,
      bankName: body.bankName,
      accountNumber: body.accountNumber || '-',
      description: body.description || '',
      isActive: true
    };

    return NextResponse.json(newAccount, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
