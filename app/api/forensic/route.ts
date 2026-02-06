
import { NextResponse } from 'next/server';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

export const dynamic = 'force-dynamic';

export async function GET() {
    const PROD_URL = "postgresql://postgres.jhqlrmlqvdatufbuhtsp:082139063266@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres";

    console.log("FORENSICS: Connecting to PROD...");
    const pool = new Pool({ connectionString: PROD_URL });
    const adapter = new PrismaPg(pool);
    const prisma = new PrismaClient({ adapter });

    try {
        // 1. RAW SQL COUNT
        const countRes: any = await prisma.$queryRaw`SELECT count(*)::int as c FROM daily_reports`;
        const count = Number(countRes[0].c);

        // 2. RAW SQL COLUMNS
        const cols: any = await prisma.$queryRaw`
        SELECT column_name::text 
        FROM information_schema.columns 
        WHERE table_name = 'daily_reports'
    `;
        const colNames = cols.map((x: any) => x.column_name);

        // 3. LATEST DATA (Safe Columns)
        const latest: any = await prisma.$queryRaw`
        SELECT id::text, date::text, "user_id"::text
        FROM daily_reports 
        ORDER BY date DESC 
        LIMIT 5
    `;

        // 4. ATTENDANCE SNAPSHOT
        const attCount: any = await prisma.$queryRaw`SELECT count(*)::int as c FROM attendance`;
        const attLatest: any = await prisma.$queryRaw`SELECT date::text, "user_id"::text, "time_in"::text FROM attendance ORDER BY date DESC LIMIT 3`;

        return NextResponse.json({
            daily_reports: {
                total: count,
                columns_found: colNames,
                missing_created_at: !colNames.includes('created_at'),
                sample_data: latest
            },
            attendance: {
                total: Number(attCount[0].c),
                sample: attLatest
            },
            status: "SUCCESS"
        });

    } catch (error: any) {
        return NextResponse.json({ error: error.message, stack: error.stack }, { status: 500 });
    } finally {
        await prisma.$disconnect();
        await pool.end();
    }
}
