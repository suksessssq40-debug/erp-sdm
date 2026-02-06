import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authorize } from '@/lib/auth';
import { UserRole } from '@/types';

export async function GET() {
  try {
    // Security: Only Owner/Superadmin can trigger system config
    await authorize([UserRole.OWNER, UserRole.SUPERADMIN]);

    // 1. Enable REPLICA IDENTITY FULL
    await prisma.$executeRawUnsafe(`ALTER TABLE projects REPLICA IDENTITY FULL;`);

    // 2. Add table to supabase_realtime publication
    try {
      await prisma.$executeRawUnsafe(`ALTER PUBLICATION supabase_realtime ADD TABLE projects;`);
    } catch (e: any) {
      if (!e.message.includes('already is in publication')) {
        console.warn("Publication add warning:", e.message);
      }
    }

    return NextResponse.json({ success: true, message: "Realtime enabled for projects" });
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

