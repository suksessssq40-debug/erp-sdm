
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log("--- TENANTS ---");
  const tenants = await prisma.tenant.findMany();
  console.table(tenants.map(t => ({ id: t.id, name: t.name })));

  console.log("\n--- USERS (Sample) ---");
  const users = await prisma.user.findMany({
    select: { id: true, username: true, role: true, tenantId: true }
  });
  console.table(users);
}

main().finally(() => prisma.$disconnect());
