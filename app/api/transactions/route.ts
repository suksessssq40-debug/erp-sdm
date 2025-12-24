import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { authorize } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    await authorize(['OWNER', 'FINANCE', 'MANAGER', 'STAFF']); // Who can view? Owner/Finance mainly. Staff/Manager dependent on policy. Giving access to all for now as it was public in store.
    
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 1000;

    let query = `SELECT * FROM transactions`;
    const params: any[] = [];
    const conditions: string[] = [];

    if (startDate) {
      conditions.push(`date >= $${params.length + 1}`);
      params.push(startDate);
    }
    if (endDate) {
      conditions.push(`date <= $${params.length + 1}`);
      params.push(endDate);
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    query += ` ORDER BY date DESC, created_at DESC LIMIT $${params.length + 1}`;
    params.push(limit);

    const res = await pool.query(query, params);
    
    // Camelcase mapping
    const transactions = res.rows.map(t => ({
        id: t.id,
        date: t.date, // Note: pg 'date' might be returned as Date object or string. verify. Usually Date object in node-pg.
        amount: parseFloat(t.amount),
        type: t.type,
        category: t.category,
        description: t.description,
        account: t.account,
        imageUrl: t.image_url
    }));

    // Fix date format to string YYYY-MM-DD for frontend compatibility
    const safeTransactions = transactions.map(t => ({
        ...t,
        date: new Date(t.date).toISOString().split('T')[0]
    }));

    return NextResponse.json(safeTransactions);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await authorize(['OWNER', 'FINANCE']);
    const t = await request.json();
    await pool.query(
      `INSERT INTO transactions (id, date, amount, type, category, description, account, image_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [t.id, t.date, t.amount, t.type, t.category || null, t.description, t.account, t.imageUrl || null]
    );
    return NextResponse.json(t, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
