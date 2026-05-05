require('dotenv').config();
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('@prisma/client');

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
    console.log("=== TARGET SEARCH: DANIEL / NIEL ===");
    
    // 1. Find User
    const users = await prisma.user.findMany({
        where: {
            OR: [
                { username: { contains: 'daniel', mode: 'insensitive' } },
                { name: { contains: 'daniel', mode: 'insensitive' } },
                { name: { contains: 'niel', mode: 'insensitive' } }
            ]
        }
    });

    if (users.length === 0) {
        console.log("No user found with name/username like Daniel or Niel.");
        return;
    }

    for (const user of users) {
        console.log(`Found User: ID ${user.id}, Username: ${user.username}, Name: ${user.name}, Role: ${user.role}, Tenant: ${user.tenantId}`);
        
        // 2. Search Attendance for April 1st (2026-04-01)
        const apr1 = await prisma.attendance.findMany({
            where: {
                userId: user.id,
                date: '2026-04-01'
            }
        });
        console.log(` - April 1st Records: ${apr1.length}`);
        apr1.forEach(a => console.log(`   - ID: ${a.id}, TimeIn: ${a.timeIn}, TimeOut: ${a.timeOut}`));

        // 3. Search Attendance for March 26th (2026-03-26)
        const mar26 = await prisma.attendance.findMany({
            where: {
                userId: user.id,
                date: '2026-03-26'
            }
        });
        console.log(` - March 26th Records: ${mar26.length}`);
        mar26.forEach(a => console.log(`   - ID: ${a.id}, TimeIn: ${a.timeIn}, TimeOut: ${a.timeOut}`));

        // 4. Search System Logs for any attendance activity
        const logs = await prisma.systemLog.findMany({
            where: {
                actorId: user.id,
                actionType: { contains: 'ATTENDANCE' },
                timestamp: {
                    // Filter for the specific days (in MS)
                    // April 1st: 1774976400000 (approx)
                    // March 26th: 1774458000000 (approx)
                    gte: BigInt(new Date('2026-03-20').getTime())
                }
            },
            orderBy: { timestamp: 'desc' }
        });
        console.log(` - System Logs (since March 20): ${logs.length}`);
        logs.forEach(l => {
            const d = new Date(Number(l.timestamp));
            console.log(`   - ${d.toISOString()} | Action: ${l.actionType} | Info: ${l.details}`);
        });
    }
}

main().catch(console.error).finally(async () => {
    await prisma.$disconnect();
    await pool.end();
});
