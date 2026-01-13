import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authorize } from '@/lib/auth';

export async function GET(request: Request) {
    try {
        await authorize(['OWNER', 'FINANCE', 'MANAGER']);
        
        const configs = await prisma.salaryConfig.findMany();

        const formatted = configs.map(c => ({
          userId: c.userId,
          basicSalary: Number(c.basicSalary),
          allowance: Number(c.allowance),
          mealAllowance: Number(c.mealAllowance),
          lateDeduction: Number(c.lateDeduction)
        }));

        return NextResponse.json(formatted);
    } catch(e) {
        return NextResponse.json({ error: 'Failed' }, { status: 500 });
    }
}
