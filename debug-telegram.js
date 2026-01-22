const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkSettings() {
  console.log("--- CHECKING SETTINGS ---");
  const settings = await prisma.settings.findMany();
  console.log("Total Settings Row:", settings.length);
  settings.forEach(s => {
      console.log(`Tenant: ${s.tenantId}`);
      console.log(`Bot Token: ${s.telegramBotToken ? "EXIST (Hidden)" : "MISSING/NULL"}`);
      console.log(`Group ID: ${s.telegramGroupId ? s.telegramGroupId : "MISSING/NULL"}`);
  });
  console.log("-------------------------");
}

checkSettings()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
