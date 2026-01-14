
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const settings = await prisma.settings.findMany();
  console.log('--- SETTINGS DATA ---');
  settings.forEach(s => {
    console.log(`Tenant: ${s.tenantId}`);
    try {
      const profile = s.companyProfileJson ? JSON.parse(s.companyProfileJson) : {};
      console.log(`Company Name: ${profile.name}`);
    } catch (e) {
      console.log(`Company Name: (parse error)`);
    }
    console.log('--------------------');
  });
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
