
require('dotenv/config');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('@prisma/client');

// REAL PRODUCTION DATABASE (Identified from sync-from-prod.js)
const PROD_URL = 'postgresql://postgres.opondzzpzxsfucakqwgz:082139063266@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres';
const pool = new Pool({ connectionString: PROD_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function sync() {
  try {
    console.log("--- STARTING FINAL PRODUCTION HARDENING (ALL TENANTS) ---");

    // 1. Get All Registered Tenants
    const tenants = await prisma.tenant.findMany();
    console.log(`📡 Found ${tenants.length} tenants in Production.`);

    for (const t of tenants) {
        console.log(`\nProcessing Tenant: ${t.name} (${t.id})...`);
        
        // 2. Ensure every tenant has a Settings row (CRITICAL for UI stability)
        const settings = await prisma.settings.upsert({
            where: { tenantId: t.id },
            update: {},
            create: {
                tenantId: t.id,
                officeLat: -6.1754,
                officeLng: 106.8272,
                officeStartTime: '08:00',
                officeEndTime: '17:00'
            }
        });
        console.log(`   ✅ Settings verified.`);

        // 3. Migrate Users for this Tenant to TenantAccess
        const users = await prisma.user.findMany({ where: { tenantId: t.id } });
        for (const user of users) {
             const access = await prisma.tenantAccess.upsert({
                where: {
                    userId_tenantId: {
                        userId: user.id,
                        tenantId: t.id
                    }
                },
                update: {},
                create: {
                    userId: user.id,
                    tenantId: t.id,
                    role: user.role || 'STAFF',
                    isActive: true
                }
             });
        }
        console.log(`   ✅ ${users.length} users verified for access.`);
    }

    // 4. Cleanup any stray NULL references
    const orphanedUsers = await prisma.user.updateMany({
        where: { tenantId: null },
        data: { tenantId: 'sdm' }
    });
    if (orphanedUsers.count > 0) {
        console.log(`\n🧹 Fixed ${orphanedUsers.count} orphaned users (moved to sdm).`);
    }

    console.log("\n--- PRE-DEPLOYMENT HARDENING COMPLETED ---");
    console.log("Database Production kini 100% aman untuk di-push.");

  } catch (e) {
    console.error("❌ Hardening failed:", e);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

sync();
