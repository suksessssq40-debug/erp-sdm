require('dotenv').config();
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('@prisma/client');

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
    console.log("=== ORPHANED ATTENDANCE CHECK ===");
    
    // Check for records on April 1st
    const targetDate = '2026-04-01';
    const records = await prisma.attendance.findMany({
        where: { date: targetDate },
        include: { user: true }
    });

    console.log(`Found ${records.length} records for ${targetDate}`);
    const orphaned = records.filter(r => !r.user);
    if (orphaned.length > 0) {
        console.log(`WARNING: ${orphaned.length} records have no linked user!`);
        orphaned.forEach(r => console.log(` - Record ID: ${r.id}, UserId: ${r.userId}, TenantId: ${r.tenantId}`));
    } else {
        console.log("All records for April 1st are linked to users.");
    }

    // Check for "Tanggal 26" again, let's look at March 26
    const march26 = '2026-03-26';
    const records26 = await prisma.attendance.findMany({
        where: { date: march26 },
        include: { user: true }
    });
    console.log(`Found ${records26.length} records for ${march26}`);
    const orphaned26 = records26.filter(r => !r.user);
    if (orphaned26.length > 0) {
        console.log(`WARNING: ${orphaned26.length} records for March 26 have no linked user!`);
    }

    // Check System Logs vs Attendance
    const logs = await prisma.systemLog.findMany({
        where: {
            actionType: 'ATTENDANCE_IN',
            timestamp: {
                gte: BigInt(new Date('2026-03-20').getTime()),
            }
        },
        orderBy: { timestamp: 'desc' }
    });

    console.log(`\nChecking consistency for ${logs.length} attendance logs...`);
    let missingInAttendance = 0;
    for (const log of logs) {
        // Find attendance record by userId and timeIn (approx)
        // or by exploring metadata if it exists
        // Actually, let's just use the timestamp and actorId
        // Attendance records usually have a 'createdAt' that matches the log timestamp (or close)
        const logDate = new Date(Number(log.timestamp));
        const oneMinuteAgo = new Date(logDate.getTime() - 60000);
        const oneMinuteAfter = new Date(logDate.getTime() + 60000);

        const match = await prisma.attendance.findFirst({
            where: {
                userId: log.actorId,
                createdAt: {
                    gte: oneMinuteAgo,
                    lte: oneMinuteAfter
                }
            }
        });

        if (!match) {
            console.log(`MISSING RECORD: Log says ${log.actorName} checked in at ${logDate.toISOString()} but no Attendance record found.`);
            missingInAttendance++;
        }
    }
    console.log(`Total Logged but Missing in Attendance Table: ${missingInAttendance}`);

}

main().catch(console.error).finally(async () => {
    await prisma.$disconnect();
    await pool.end();
});
