
import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { authorize } from '@/lib/auth';

export async function PUT(request: Request, { params }: { params: { id: string } }) {
    try {
        const user = await authorize(['OWNER', 'FINANCE']);
        const { tenantId } = user;
        const id = params.id;
        const body = await request.json();
        
        const res = await pool.query(
          `UPDATE business_units SET name = $1, description = $2, is_active = $3 WHERE id = $4 AND tenant_id = $5`,
          [body.name, body.description, body.isActive ?? true, id, tenantId]
        );
        
        if (res.rowCount === 0) return NextResponse.json({ error: 'Business unit not found or unauthorized' }, { status: 404 });
        
        return NextResponse.json({ success: true });
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
        const res = await pool.query('UPDATE business_units SET is_active = false WHERE id = $1 AND tenant_id = $2', [id, tenantId]);
        if (res.rowCount === 0) return NextResponse.json({ error: 'Business unit not found' }, { status: 404 });
        
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Failed' }, { status: 500 });
    }
}
