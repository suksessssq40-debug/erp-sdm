const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const tenantId = 'sdm';
    console.log('Resetting transactions for tenant:', tenantId);
    const result = await prisma.transaction.deleteMany({
        where: { tenantId }
    });
    console.log(`Successfully deleted ${result.count} transactions.`);
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
