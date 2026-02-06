
// import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { prisma } from '../src/lib/prisma';

dotenv.config();

// const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Starting Data Migration...');

  // 1. MIGRATE FINANCIAL ACCOUNTS
  console.log('Migrating Financial Accounts...');
  const finAccPath = path.join(process.cwd(), 'financial_accounts_rows.sql');
  if (fs.existsSync(finAccPath)) {
    const content = fs.readFileSync(finAccPath, 'utf-8');
    // Regex to capture VALUES
    const regex = /\('([^']*)', '([^']*)', '([^']*)', '([^']*)', '([^']*)', '([^']*)', '([^']*)'\)/g;
    let match;
    let count = 0;

    while ((match = regex.exec(content)) !== null) {
      const [_, id, name, bankName, accountNumber, description, isActiveStr, createdAtStr] = match;

      // Clean up inputs
      const cleanName = name.trim();

      // Check if exists
      const exists = await prisma.financialAccount.findUnique({ where: { id } });
      if (!exists) {
        await prisma.financialAccount.create({
          data: {
            id,
            name: cleanName,
            bankName: bankName.trim(),
            accountNumber: accountNumber.trim(),
            description: description.trim(),
            isActive: isActiveStr === 'true',
            createdAt: BigInt(createdAtStr)
          }
        });
        count++;
      }
    }
    console.log(`✅ Migrated ${count} Financial Accounts.`);
  } else {
    console.log('⚠️ financial_accounts_rows.sql not found.');
  }

  // 2. MIGRATE CATEGORIES TO COA
  console.log('Migrating Categories to COA...');
  const catPath = path.join(process.cwd(), 'transaction_categories_rows.sql');
  if (fs.existsSync(catPath)) {
    const content = fs.readFileSync(catPath, 'utf-8');
    // Regex for Categories: id, name, type, parent_id, created_at
    // VALUES ('id', 'name', 'TYPE', null, 'timestamp'), ...
    const regex = /\('([^']*)', '([^']*)', '([^']*)', (null|'[^']*'), '([^']*)'\)/g;
    let match;
    let count = 0;
    const processedCodes = new Set();

    while ((match = regex.exec(content)) !== null) {
      const [_, id, rawName, legacyType, parentId, createdAtStr] = match;

      // Parse Code and Name
      // Format: "CODE-Name"
      const parts = rawName.split('-');
      let code = '';
      let name = rawName;

      if (parts.length > 1 && /^\d+$/.test(parts[0])) {
        code = parts[0];
        name = parts.slice(1).join('-').trim();
      } else {
        // No code found, generate dummy code or skip?
        // Let's generate a slug code
        code = rawName.replace(/[^a-zA-Z0-9]/g, '').substr(0, 6).toUpperCase();
      }

      if (processedCodes.has(code)) continue; // Avoid duplicates based on code

      // Determine Type & NormalPos
      let type = 'EXPENSE';
      let normalPos = 'DEBIT';
      const prefix = code.charAt(0);

      switch (prefix) {
        case '1': type = 'ASSET'; normalPos = 'DEBIT'; break;
        case '2': type = 'LIABILITY'; normalPos = 'CREDIT'; break;
        case '3': type = 'EQUITY'; normalPos = 'CREDIT'; break;
        case '4': type = 'REVENUE'; normalPos = 'CREDIT'; break; // Sales
        case '5': type = 'EXPENSE'; normalPos = 'DEBIT'; break; // COGS
        case '6': type = 'EXPENSE'; normalPos = 'DEBIT'; break; // OPEX
        case '7': type = 'REVENUE'; normalPos = 'CREDIT'; break; // Other Income
        case '8': type = 'EXPENSE'; normalPos = 'DEBIT'; break; // Other Expense
        default: type = legacyType === 'IN' ? 'REVENUE' : 'EXPENSE'; normalPos = legacyType === 'IN' ? 'CREDIT' : 'DEBIT'; break;
      }

      // Insert COA
      const exists = await prisma.chartOfAccount.findUnique({ where: { id } });
      // Also check if code exists to avoid unique constraint error
      const codeExists = await prisma.chartOfAccount.findFirst({ where: { code, tenantId: 'sdm' } });

      if (!exists && !codeExists) {
        await prisma.chartOfAccount.create({
          data: {
            id,
            code,
            name,
            type,
            normalPos,
            description: `Migrated from Category: ${rawName}`,
            isActive: true,
            createdAt: BigInt(createdAtStr)
          }
        });
        count++;
        processedCodes.add(code);
      }
    }
    console.log(`✅ Migrated ${count} Chart of Accounts.`);
  } else {
    console.log('⚠️ transaction_categories_rows.sql not found.');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
