import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authorize } from '@/lib/auth';

export async function POST(request: Request) {
    try {
        const user = await authorize(['OWNER', 'FINANCE']);
        const { tenantId } = user;
        const { categories } = await request.json();

        if (!Array.isArray(categories)) {
            return NextResponse.json({ error: 'Invalid' }, { status: 400 });
        }

        const existing = await prisma.transactionCategory.findMany({
            where: { tenantId },
            select: { id: true, name: true, type: true }
        });

        const categoryMap = new Map<string, string>();
        existing.forEach(row => {
            categoryMap.set(`${row.name.trim().toUpperCase()}|${row.type}`, row.id);
        });

        let newCount = 0;

        // Pass 1: Roots
        const roots = categories.filter((c: any) => !c.parentName);
        for (const cat of roots) {
            if (!cat.name) continue;
            const normalizedName = cat.name.trim();
            const key = `${normalizedName.toUpperCase()}|${cat.type}`;

            if (!categoryMap.has(key)) {
                const id = Math.random().toString(36).substr(2, 9);
                await prisma.transactionCategory.create({
                    data: {
                        id,
                        tenantId,
                        name: normalizedName,
                        type: cat.type,
                        createdAt: BigInt(Date.now())
                    }
                });
                categoryMap.set(key, id);
                newCount++;
            }
        }

        // Pass 2: Children
        const children = categories.filter((c: any) => c.parentName);
        for (const cat of children) {
            if (!cat.name) continue;
            const normalizedName = cat.name.trim();
            const key = `${normalizedName.toUpperCase()}|${cat.type}`;

            if (categoryMap.has(key)) continue;

            const parentKey = `${cat.parentName.trim().toUpperCase()}|${cat.type}`;
            const parentId = categoryMap.get(parentKey);

            const id = Math.random().toString(36).substr(2, 9);
            await prisma.transactionCategory.create({
                data: {
                    id,
                    tenantId,
                    name: normalizedName,
                    type: cat.type,
                    parentId: parentId || null,
                    createdAt: BigInt(Date.now())
                }
            });
            categoryMap.set(key, id);
            newCount++;
        }

        return NextResponse.json({ importedCount: newCount });

    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Failed' }, { status: 500 });
    }
}

