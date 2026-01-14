
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
    log: ['query', 'info', 'warn', 'error']
});

async function main() {
    console.log("Starting DB check...");
    try {
        const tenants = await prisma.tenant.findMany({
            select: { id: true, name: true }
        });
        console.log("TENANTS:", JSON.stringify(tenants, null, 2));

        const owners = await prisma.user.findMany({
            where: { role: 'OWNER' },
            select: { id: true, username: true, tenantId: true }
        });
        console.log("OWNERS:", JSON.stringify(owners, null, 2));
    } catch (e) {
        console.error("Query failed:", e);
    }
}

main().finally(() => prisma.$disconnect());
