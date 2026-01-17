
import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { authorize } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const user = await authorize(['OWNER', 'FINANCE']);
    const { tenantId } = user;
    const { categories } = await request.json(); 

    if (!Array.isArray(categories)) {
        return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    // 1. Fetch current categories - FILTER BY TENANT
    const existingRes = await pool.query('SELECT id, name, type FROM transaction_categories WHERE tenant_id = $1', [tenantId]);
    
    // Map: "NAME|TYPE" -> ID
    const categoryMap = new Map<string, string>();
    existingRes.rows.forEach(row => {
        categoryMap.set(`${row.name.trim().toUpperCase()}|${row.type}`, row.id);
    });

    let newCount = 0;

    // 2. Pass 1: Process Roots (No Parent)
    const roots = categories.filter((c: any) => !c.parentName);
    
    for (const cat of roots) {
        if (!cat.name) continue;
        const normalizedName = cat.name.trim();
        const key = `${normalizedName.toUpperCase()}|${cat.type}`;

        if (!categoryMap.has(key)) {
            const id = Math.random().toString(36).substr(2, 9);
            await pool.query(
                `INSERT INTO transaction_categories (id, tenant_id, name, type, parent_id) VALUES ($1, $2, $3, $4, NULL)`,
                [id, tenantId, normalizedName, cat.type]
            );
            categoryMap.set(key, id);
            newCount++;
        }
    }

    // 3. Pass 2: Process Children (Has Parent)
    const children = categories.filter((c: any) => c.parentName);

    for (const cat of children) {
        if (!cat.name) continue;
        const normalizedName = cat.name.trim();
        const key = `${normalizedName.toUpperCase()}|${cat.type}`;

        if (categoryMap.has(key)) continue;

        // Resolve Parent
        const parentKey = `${cat.parentName.trim().toUpperCase()}|${cat.type}`;
        let parentId = categoryMap.get(parentKey);
        
        const id = Math.random().toString(36).substr(2, 9);
        await pool.query(
            `INSERT INTO transaction_categories (id, tenant_id, name, type, parent_id) VALUES ($1, $2, $3, $4, $5)`,
            [id, tenantId, normalizedName, cat.type, parentId || null]
        );
        categoryMap.set(key, id);
        newCount++;
    }

    return NextResponse.json({ 
        message: 'Import successfully processed', 
        importedCount: newCount 
    }, { status: 200 });

  } catch (error) {
    console.error("Import Categories Error:", error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
