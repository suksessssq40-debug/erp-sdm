require('dotenv').config();
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('@prisma/client');

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
    console.log("=== LISTING ALL USERS ===");
    const users = await prisma.user.findMany();
    users.forEach(u => console.log(` - ${u.username} | Name: ${u.name} | ID: ${u.id} | Tenant: ${u.tenantId}`));

    console.log("\n=== CHECKING ATTENDANCE BY METADATA OR REASON ===");
    const suspects = await prisma.attendance.findMany({
        where: {
            OR: [
                { lateReason: { contains: 'daniel', mode: 'insensitive' } },
                { lateReason: { contains: 'niel', mode: 'insensitive' } }
            ]
        }
    });
    console.log(`Found ${suspects.length} records referencing Daniel/Niel in reasons.`);
    suspects.forEach(s => console.log(` - ID: ${s.id}, User: ${s.userId}, Reason: ${s.lateReason}`));
}

main().catch(console.error).finally(async () => {
    await prisma.$disconnect();
    await pool.end();
});
