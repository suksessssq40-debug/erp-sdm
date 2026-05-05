require('dotenv').config();
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('@prisma/client');

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ 
    adapter,
    // log: ['query', 'error']
});

async function main() {
    console.log("=== DEEP ATTENDANCE ANALYSIS ===");

    const targetDates = [
        '2026-04-01', // April 1st (Wednesday)
        '2026-03-26', // March 26th
        '2026-02-26', 
        '2026-01-26',
        '2026-04-26'  // Future? typo?
    ];

    console.log(`Checking specifically for dates: ${targetDates.join(', ')}`);

    for (const dateStr of targetDates) {
        const records = await prisma.attendance.findMany({
            where: { date: dateStr },
            include: { user: { select: { name: true, username: true } } }
        });
        console.log(`\nRecords for DATE [${dateStr}]: ${records.length} found`);
        records.forEach(r => {
            console.log(` - User: ${r.user?.name || r.userId} | In: ${r.timeIn} | Out: ${r.timeOut} | CreatedAt: ${r.createdAt}`);
        });
    }

    console.log("\n--- Checking System Logs for ATTENDANCE_IN on those dates ---");
    for (const dateStr of targetDates) {
        const startOfDay = new Date(dateStr + "T00:00:00+07:00").getTime();
        const endOfDay = new Date(dateStr + "T23:59:59+07:00").getTime();

        const logs = await prisma.systemLog.findMany({
            where: {
                actionType: 'ATTENDANCE_IN',
                timestamp: {
                    gte: BigInt(startOfDay),
                    lte: BigInt(endOfDay)
                }
            }
        });
        console.log(`Logs for ${dateStr}: ${logs.length} occurrences`);
        logs.forEach(l => {
            console.log(` - Log: ${l.actorName} | ${l.details} | TS: ${l.timestamp}`);
        });
    }

    console.log("\n--- Searching for ANY Attendance record created in last 48 hours ---");
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

    const recentRecords = await prisma.attendance.findMany({
        where: {
            createdAt: { gte: twoDaysAgo }
        },
        include: { user: { select: { name: true } } },
        orderBy: { createdAt: 'desc' }
    });

    console.log(`Recent records (last 48h): ${recentRecords.length}`);
    recentRecords.forEach(r => {
      console.log(` - User: ${r.user?.name} | DB Date Field: ${r.date} | In: ${r.timeIn} | Created: ${r.createdAt}`);
    });

    console.log("\n--- Searching for Records with Date '-26' (any month) ---");
    const all26 = await prisma.attendance.findMany({
        where: {
            date: { contains: '-26' }
        },
        include: { user: { select: { name: true } } },
        orderBy: { date: 'desc' },
        take: 50
    });
    console.log(`Records with '-26' in date: ${all26.length}`);
    all26.forEach(r => {
        console.log(` - User: ${r.user?.name} | Date: ${r.date} | In: ${r.timeIn}`);
    });

}

main()
    .catch(console.error)
    .finally(async () => {
        await prisma.$disconnect();
        await pool.end();
    });
