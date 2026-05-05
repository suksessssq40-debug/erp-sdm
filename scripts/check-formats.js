require('dotenv').config();
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('@prisma/client');

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
    console.log("=== CHECKING ALL DATE FORMATS ===");
    const all = await prisma.attendance.findMany();
    const formats = {};
    all.forEach(a => {
        const fmt = String(a.date).replace(/\d/g, '0');
        formats[fmt] = (formats[fmt] || 0) + 1;
    });
    console.log("Date format distribution (0 = digit):");
    console.log(JSON.stringify(formats, null, 2));

    const badOnes = all.filter(a => !/^\d{4}-\d{2}-\d{2}$/.test(a.date));
    console.log(`\nFound ${badOnes.length} records with non-conforming date format.`);
    badOnes.slice(0, 10).forEach(a => {
        console.log(` - ID: ${a.id}, User: ${a.userId}, Date: "${a.date}"`);
    });

}

main().catch(console.error).finally(async () => {
    await prisma.$disconnect();
    await pool.end();
});
