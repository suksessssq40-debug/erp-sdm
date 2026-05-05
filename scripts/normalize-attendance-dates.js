require('dotenv').config();
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('@prisma/client');

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
    console.log("=== ATTENDANCE DATE NORMALIZATION ===");
    const all = await prisma.attendance.findMany();
    console.log(`Analyzing ${all.length} records...`);

    let updatedCount = 0;
    for (const record of all) {
        let originalDate = String(record.date);
        let normalizedDate = originalDate;

        // Pattern 1: YYYY-MM-DD
        if (/^\d{4}-\d{2}-\d{2}$/.test(originalDate)) {
            continue; // Already correct
        }

        // Pattern 2: "Tue Dec 23 2025" or similar
        // JS Date can parse this!
        const parsed = new Date(originalDate);
        if (!isNaN(parsed.getTime())) {
            // Check if it's a valid date
            // Note: toISOString() might shift by timezone, let's just get the parts
            const y = parsed.getFullYear();
            const m = String(parsed.getMonth() + 1).padStart(2, '0');
            const d = String(parsed.getDate()).padStart(2, '0');
            normalizedDate = `${y}-${m}-${d}`;
            
            // Special case for Indonesia format "Sabtu, 10 Januari 2026"
            // JS Date might fail on "Januari", let's handle manually if needed
        } else if (originalDate.includes('Januari') || originalDate.includes('Februari') || originalDate.includes('Maret') || 
                   originalDate.includes('April') || originalDate.includes('Mei') || originalDate.includes('Juni') ||
                   originalDate.includes('Juli') || originalDate.includes('Agustus') || originalDate.includes('September') ||
                   originalDate.includes('Oktober') || originalDate.includes('November') || originalDate.includes('Desember')) {
            
            const monthMap = {
                'Januari': '01', 'Februari': '02', 'Maret': '03', 'April': '04', 'Mei': '05', 'Juni': '06',
                'Juli': '07', 'Agustus': '08', 'September': '09', 'Oktober': '10', 'November': '11', 'Desember': '12'
            };
            
            const parts = originalDate.split(' '); // Expected: "Sabtu,", "10", "Januari", "2026"
            const day = parts[1]?.padStart(2, '0');
            const monthName = parts[2];
            const year = parts[3];
            
            if (day && monthName && year && monthMap[monthName]) {
                normalizedDate = `${year}-${monthMap[monthName]}-${day}`;
            }
        }

        if (normalizedDate !== originalDate) {
            console.log(`Updating ${record.id}: "${originalDate}" -> "${normalizedDate}"`);
            await prisma.attendance.update({
                where: { id: record.id },
                data: { date: normalizedDate }
            });
            updatedCount++;
        }
    }

    console.log(`\nDONE. Total records normalized: ${updatedCount}`);

}

main().catch(console.error).finally(async () => {
    await prisma.$disconnect();
    await pool.end();
});
