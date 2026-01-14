
import 'dotenv/config'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'

const connectionString = process.env.DATABASE_URL || process.env.DIRECT_URL
const pool = new Pool({ connectionString })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log('🌱 Seeding Tenants...');

  // Create Tenants
  const sdm = await (prisma as any).tenant.upsert({
    where: { id: 'sdm' },
    update: {},
    create: {
      id: 'sdm',
      name: 'Sukses Digital Media',
      description: 'Kantor Utama / Unit Bisnis SDM',
      isActive: true,
    },
  });
  console.log('✅ Tenant SDM ensured');

  const manjada = await (prisma as any).tenant.upsert({
    where: { id: 'manjada' },
    update: {},
    create: {
      id: 'manjada',
      name: 'Manjada',
      description: 'Unit Bisnis Manjada',
      isActive: true,
    },
  });
  console.log('✅ Tenant Manjada ensured');

  // Assign existing Users to SDM
  const userUpdate = await (prisma as any).user.updateMany({
    where: { tenantId: null },
    data: { tenantId: 'sdm' }
  });
  console.log(`✅ Updated ${userUpdate.count} users to Tenant SDM`);

  // Assign existing data to SDM
  const tables = [
    'project', 'attendance', 'leaveRequest', 'businessUnit', 
    'transactionCategory', 'chartOfAccount', 'financialAccount', 
    'transaction', 'dailyReport', 'chatRoom'
  ];

  for (const table of tables) {
    try {
        const update = await (prisma as any)[table].updateMany({
          where: { tenantId: null },
          data: { tenantId: 'sdm' }
        });
        console.log(`✅ Updated ${update.count} records in ${table} to Tenant SDM`);
    } catch (err: any) {
        console.warn(`⚠️ Table ${table} skip:`, err.message);
    }
  }

  // Handle Settings SDM
  const existingSettingsSDM = await (prisma as any).settings.findFirst({
    where: { tenantId: 'sdm' }
  });
  if (!existingSettingsSDM) {
    const existingSettings = await (prisma as any).settings.findUnique({ where: { id: 1 } });
    if (existingSettings) {
        await (prisma as any).settings.update({
            where: { id: 1 },
            data: { tenantId: 'sdm' }
        });
        console.log('✅ Linked existing Settings (ID 1) to Tenant SDM');
    } else {
        await (prisma as any).settings.create({
            data: { id: 1, tenantId: 'sdm', officeStartTime: '08:00', officeEndTime: '17:00' }
        });
        console.log('✅ Created default Settings for Tenant SDM');
    }
  }

  // Handle Settings Manjada
  const existingSettingsManjada = await (prisma as any).settings.findFirst({
    where: { tenantId: 'manjada' }
  });
  if (!existingSettingsManjada) {
      await (prisma as any).settings.create({
          data: { id: 2, tenantId: 'manjada', officeStartTime: '08:00', officeEndTime: '17:00' }
      });
      console.log('✅ Created default Settings for Tenant Manjada');
  }

  console.log('🎉 Tenants Initialization Finished!');
}

main()
  .catch((e) => {
    console.error('❌ SEED ERROR:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
