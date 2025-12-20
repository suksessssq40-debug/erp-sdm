import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { authorize } from '@/lib/auth';

export async function PUT(request: Request, props: { params: Promise<{ userId: string }> }) {
  const params = await props.params;
  try {
    await authorize(['OWNER', 'FINANCE']);
    const userId = params.userId;
    const c = await request.json();
    
    await pool.query(
      `INSERT INTO salary_configs (user_id, basic_salary, allowance, meal_allowance, late_deduction)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id) DO UPDATE SET 
         basic_salary = EXCLUDED.basic_salary,
         allowance = EXCLUDED.allowance,
         meal_allowance = EXCLUDED.meal_allowance,
         late_deduction = EXCLUDED.late_deduction`,
      [userId, c.basicSalary, c.allowance, c.mealAllowance, c.lateDeduction]
    );
    return NextResponse.json(c);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
