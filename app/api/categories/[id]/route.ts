
import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { authorize } from '@/lib/auth';

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
    try {
        const user = await authorize(['OWNER', 'FINANCE']);
        const { tenantId } = user;
        const id = params.id;
        
        // Check if category belongs to tenant
        const check = await pool.query('SELECT 1 FROM transaction_categories WHERE id = $1 AND tenant_id = $2', [id, tenantId]);
        if (check.rowCount === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });

        await pool.query('DELETE FROM transaction_categories WHERE parent_id = $1 AND tenant_id = $2', [id, tenantId]);
        await pool.query('DELETE FROM transaction_categories WHERE id = $1 AND tenant_id = $2', [id, tenantId]);
        
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Failed' }, { status: 500 });
    }
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
    try {
        const user = await authorize(['OWNER', 'FINANCE']);
        const { tenantId } = user;
        const id = params.id;
        const body = await request.json();
        
        const res = await pool.query(
          `UPDATE transaction_categories SET name = $1, type = $2 WHERE id = $3 AND tenant_id = $4`,
          [body.name, body.type, id, tenantId]
        );
        
        if (res.rowCount === 0) return NextResponse.json({ error: 'Category not found or unauthorized' }, { status: 404 });
        
        return NextResponse.json({ success: true });
    } catch (error) {
         console.error(error);
         return NextResponse.json({ error: 'Failed' }, { status: 500 });
    }
}
