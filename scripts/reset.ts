import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const tenantId = 'sdm';
    console.log('Resetting transactions for tenant:', tenantId);
    try {
        const result = await prisma.transaction.deleteMany({
            where: { tenantId: 'sdm' }
        });
        console.log(`Successfully deleted ${result.count} transactions.`);
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
