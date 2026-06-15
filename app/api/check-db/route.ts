import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    // Debug Env
    const hasEnv = !!process.env.DATABASE_URL;
    
    // Test Raw Query (Simpler than Model)
    const rawResult = await prisma.$queryRaw`SELECT 1 as connected`;

    return NextResponse.json({ 
      status: 'OK', 
      message: 'Prisma Connection Successful', 
      debug: { hasEnv },
      data: {
        rawResult,
        timestamp: new Date().toISOString()
      }
    });
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
