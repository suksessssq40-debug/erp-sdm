require('dotenv').config();
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('@prisma/client');

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
    console.log("=== CHECKING FOR UNKNOWN USERS IN ATTENDANCE (APRIL 1ST) ===");
    
    // Fetch all attendance for April 1
    const apr1 = await prisma.attendance.findMany({
        where: { date: '2026-04-01' }
    });

    const userIds = [...new Set(apr1.map(a => a.userId))];
    console.log(`Unique UserIDs on April 1st: ${userIds.length}`);

    for (const id of userIds) {
        const user = await prisma.user.findUnique({ where: { id } });
        if (!user) {
            console.log(`!! ALERT !! Attendance record found for NON-EXISTENT USER ID: ${id}`);
        } else {
            console.log(` - ${id}: ${user.username} (${user.name})`);
        }
    }

    console.log("\n=== CHECKING FOR UNKNOWN USERS IN ATTENDANCE (MARCH 26TH) ===");
    const mar26 = await prisma.attendance.findMany({
        where: { date: '2026-03-26' }
    });
    const userIds26 = [...new Set(mar26.map(a => a.userId))];
    for (const id of userIds26) {
        const user = await prisma.user.findUnique({ where: { id } });
        if (!user) {
            console.log(`!! ALERT !! Attendance record found for NON-EXISTENT USER ID: ${id}`);
        }
    }
}

main().catch(console.error).finally(async () => {
    await prisma.$disconnect();
    await pool.end();
});
