const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        console.log('Testing TenantAccess query...');
        const data = await prisma.tenantAccess.findMany({
            where: { tenantId: 'sdm', isActive: true },
            include: { user: true },
            take: 1
        });
        console.log('Query success:', JSON.stringify(data, null, 2));
    } catch (e) {
        console.error('Query failed with Prisma:');
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
