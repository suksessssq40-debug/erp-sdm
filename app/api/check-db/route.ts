export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { serialize } from '@/lib/serverUtils';

export async function GET() {
  try {
    // Debug Env
    const hasEnv = !!process.env.DATABASE_URL;

    // Test Raw Query (Simpler than Model)
    const rawResult = await prisma.$queryRaw`SELECT 1 as connected`;

    return NextResponse.json(serialize({
      status: 'OK',
      message: 'Prisma Connection Successful',
      debug: { hasEnv },
      data: {
        rawResult,
        timestamp: new Date().toISOString()
      }
    }));
  } catch (error: any) {
    console.error("Prisma Error:", error);
    return NextResponse.json({
      status: 'ERROR',
      error: error.message,
      detail: error.stack,
      envCheck: !!process.env.DATABASE_URL
    }, { status: 500 });
  }
}
