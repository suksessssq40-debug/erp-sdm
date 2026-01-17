
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log("Checking Users in Database...");
  const count = await prisma.user.count();
  console.log("Total Users:", count);
  
  const users = await prisma.user.findMany({
    take: 10,
    select: {
      username: true,
      role: true,
      tenantId: true
    }
  });
  console.log("User Samples:", users);
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
