
import 'dotenv/config'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'

const connectionString = process.env.DATABASE_URL || process.env.DIRECT_URL
const pool = new Pool({ connectionString })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
  const users = await prisma.user.findMany({ take: 5 });
  console.log('Sample Users with TenantId:');
  console.table(users.map(u => ({ id: u.id, username: u.username, tenantId: (u as any).tenantId })));
  
  const tenants = await (prisma as any).tenant.findMany();
  console.log('Available Tenants:');
  console.table(tenants);
}

main().finally(() => pool.end());
