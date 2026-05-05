require('dotenv').config();
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('@prisma/client');

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
    console.log("=== DB COUNTS ===");
    const totalAttendance = await prisma.attendance.count();
    console.log(`Total Attendance Records: ${totalAttendance}`);

    const tenants = await prisma.tenant.findMany();
    for (const tenant of tenants) {
        const count = await prisma.attendance.count({ where: { tenantId: tenant.id } });
        console.log(`Tenant ${tenant.id} (${tenant.name}): ${count} attendance records`);
    }

    console.log("\n--- Checking for Malformed Dates ---");
    const malformed = await prisma.attendance.findMany({
        where: {
            NOT: {
                date: { matches: '^\\d{4}-\\d{2}-\\d{2}$', mode: 'insensitive' }
            }
        },
        take: 10
    });
    // Wait, Prisma matches doesn't work like that for strings in all adapters. 
    // Let's just fetch some and check.
    const sample = await prisma.attendance.findMany({ take: 50, orderBy: { createdAt: 'desc' } });
    sample.forEach(s => {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(s.date)) {
            console.log(`Malformed Date found: ID ${s.id}, User ${s.userId}, Date "${s.date}"`);
        }
    });

}

main().catch(console.error).finally(async () => {
    await prisma.$disconnect();
    await pool.end();
});
