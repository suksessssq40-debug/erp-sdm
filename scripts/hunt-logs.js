require('dotenv').config();
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('@prisma/client');

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
    console.log("=== HUNTING FOR DANIEL'S ACTIONS (APRIL 1ST) ===");
    
    const apr1Start = BigInt(new Date('2026-04-01T00:00:00+07:00').getTime());
    const apr1End = BigInt(new Date('2026-04-01T23:59:59+07:00').getTime());

    const logs = await prisma.systemLog.findMany({
        where: {
            actionType: { contains: 'ATTENDANCE' },
            timestamp: {
                gte: apr1Start,
                lte: apr1End
            }
        },
        orderBy: { timestamp: 'asc' }
    });

    console.log(`Found ${logs.length} attendance logs on April 1st:`);
    logs.forEach(l => {
        const d = new Date(Number(l.timestamp));
        console.log(` - [${d.toLocaleTimeString('id-ID')}] User: ${l.actorName} (${l.actorId}) | ${l.actionType}: ${l.details}`);
    });

    console.log("\n=== HUNTING FOR DANIEL'S ACTIONS (MARCH 26TH) ===");
    const mar26Start = BigInt(new Date('2026-03-26T00:00:00+07:00').getTime());
    const mar26End = BigInt(new Date('2026-03-26T23:59:59+07:00').getTime());

    const logs26 = await prisma.systemLog.findMany({
        where: {
            actionType: { contains: 'ATTENDANCE' },
            timestamp: {
                gte: mar26Start,
                lte: mar26End
            }
        },
        orderBy: { timestamp: 'asc' }
    });

    console.log(`Found ${logs26.length} attendance logs on March 26th:`);
    logs26.forEach(l => {
        const d = new Date(Number(l.timestamp));
        console.log(` - [${d.toLocaleTimeString('id-ID')}] User: ${l.actorName} (${l.actorId}) | ${l.actionType}: ${l.details}`);
    });
}

main().catch(console.error).finally(async () => {
    await prisma.$disconnect();
    await pool.end();
});
