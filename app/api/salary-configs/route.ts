import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authorize } from '@/lib/auth';

export async function GET(request: Request) {
    try {
        const user = await authorize(['OWNER', 'FINANCE', 'MANAGER']);
        const { tenantId } = user;
        
        // Filter by Tenant via User relationship
        const configs = await prisma.salaryConfig.findMany({
            where: {
                user: { tenantId }
            }
        });

        const formatted = configs.map(c => ({
          userId: c.userId,
          basicSalary: Number(c.basicSalary),
          allowance: Number(c.allowance),
          mealAllowance: Number(c.mealAllowance),
          lateDeduction: Number(c.lateDeduction)
        }));

        return NextResponse.json(formatted);
    } catch(e) {
        console.error(e);
        return NextResponse.json({ error: 'Failed' }, { status: 500 });
    }
}
