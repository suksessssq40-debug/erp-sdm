require('dotenv').config();
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('@prisma/client');

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
    console.log("=== FULL HISTORY FOR DANIEL (crgsmrdaq) ===");
    const history = await prisma.attendance.findMany({
        where: { userId: 'crgsmrdaq' },
        orderBy: { createdAt: 'desc' }
    });
    console.log(`Total records for Daniel: ${history.length}`);
    history.forEach(h => console.log(` - Date: ${h.date} | In: ${h.timeIn} | Out: ${h.timeOut} | CreatedAt: ${h.createdAt}`));
}

main().catch(console.error).finally(async () => {
    await prisma.$disconnect();
    await pool.end();
});
