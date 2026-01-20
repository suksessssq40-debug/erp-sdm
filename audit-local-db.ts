
import 'dotenv/config'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'

const connectionString = process.env.DATABASE_URL
const pool = new Pool({ connectionString })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function audit() {
  const accountId = 'vq8bcdrkc';
  const acc = await prisma.financialAccount.findUnique({ where: { id: accountId } });
  console.log(`\nAccount: ${acc?.name} | DB Balance: ${acc?.balance}`);

  const txs = await prisma.transaction.findMany({ where: { accountId } });
  let calculated = 0;
  txs.forEach(t => {
      const amt = Number(t.amount);
      calculated += (t.type === 'IN' ? amt : -amt);
  });
  console.log(`Calculated sum of ALL transactions: ${calculated}`);
  
  const paidTxs = await prisma.transaction.findMany({ where: { accountId, status: 'PAID' } });
  let calculatedPaid = 0;
  paidTxs.forEach(t => {
      const amt = Number(t.amount);
      calculatedPaid += (t.type === 'IN' ? amt : -amt);
  });
  console.log(`Calculated sum of ONLY 'PAID' transactions: ${calculatedPaid}`);
  
  await prisma.$disconnect();
  await pool.end();
}

audit();
