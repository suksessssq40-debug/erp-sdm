-- MIGRATION SCRIPT FOR PRODUCTION (FINANCE MODULE UPGRADE)
-- Run this in Supabase SQL Editor

BEGIN;

-- 1. Create ChartOfAccount Table if not exists
CREATE TABLE IF NOT EXISTS "public"."chart_of_accounts" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "normal_pos" TEXT NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN DEFAULT true,
    "created_at" BIGINT,
    CONSTRAINT "chart_of_accounts_pkey" PRIMARY KEY ("id")
);

-- Create Unique Index on Code
CREATE UNIQUE INDEX IF NOT EXISTS "chart_of_accounts_code_key" ON "public"."chart_of_accounts"("code");

-- 2. Populate ChartOfAccount from TransactionCategory (Legacy)
-- This splits "123-Name" into Code and Name, and maps Type/POS based on Code prefix
INSERT INTO "public"."chart_of_accounts" ("id", "code", "name", "type", "normal_pos", "created_at")
SELECT 
  CONCAT('coa_', SPLIT_PART("name", '-', 1)) as "id", -- NEW: Clean ID Format (e.g. coa_11100)
  SPLIT_PART("name", '-', 1) as "code",
  SUBSTRING("name" FROM POSITION('-' IN "name") + 1) as "name",
  CASE 
    WHEN LEFT("name", 1) = '1' THEN 'ASSET'
    WHEN LEFT("name", 1) = '2' THEN 'LIABILITY'
    WHEN LEFT("name", 1) = '3' THEN 'EQUITY'
    WHEN LEFT("name", 1) = '4' THEN 'REVENUE'
    WHEN LEFT("name", 1) = '5' THEN 'EXPENSE' -- HPP
    WHEN LEFT("name", 1) = '6' THEN 'EXPENSE' -- Operasional
    WHEN LEFT("name", 1) = '7' THEN 'REVENUE' -- Other Income
    WHEN LEFT("name", 1) = '8' THEN 'EXPENSE' -- Other Expense
    WHEN LEFT("name", 1) = '9' THEN 'EXPENSE' -- Tax
    ELSE 'EXPENSE'
  END as "type",
  CASE 
    WHEN LEFT("name", 1) = '1' THEN 'DEBIT'
    WHEN LEFT("name", 1) = '2' THEN 'CREDIT'
    WHEN LEFT("name", 1) = '3' THEN 'CREDIT'
    WHEN LEFT("name", 1) = '4' THEN 'CREDIT'
    WHEN LEFT("name", 1) = '5' THEN 'DEBIT'
    WHEN LEFT("name", 1) = '6' THEN 'DEBIT'
    WHEN LEFT("name", 1) = '7' THEN 'CREDIT'
    WHEN LEFT("name", 1) = '8' THEN 'DEBIT'
    WHEN LEFT("name", 1) = '9' THEN 'DEBIT'
    ELSE 'DEBIT'
  END as "normal_pos",
  "created_at"
FROM "public"."transaction_categories"
ON CONFLICT ("id") DO NOTHING; -- Avoid duplicates if run twice

-- 3. Add New Columns to Transactions
ALTER TABLE "public"."transactions" 
ADD COLUMN IF NOT EXISTS "coa_id" TEXT,
ADD COLUMN IF NOT EXISTS "contact_name" TEXT,
ADD COLUMN IF NOT EXISTS "status" TEXT DEFAULT 'PAID',
ADD COLUMN IF NOT EXISTS "due_date" DATE;

-- 4. Migrate Data: Link Transactions to COA
-- Logic: Extract Code from "category" (e.g. "411-Jual"), find COA with that Code, set coa_id.
UPDATE "public"."transactions" t
SET "coa_id" = c.id
FROM "public"."chart_of_accounts" c
WHERE SPLIT_PART(t.category, '-', 1) = c.code
AND t.coa_id IS NULL; -- Only update NULLs

-- 5. Add Foreign Key Constraint (Safety)
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'transactions_coa_id_fkey') THEN
        ALTER TABLE "public"."transactions"
        ADD CONSTRAINT "transactions_coa_id_fkey" FOREIGN KEY ("coa_id") REFERENCES "public"."chart_of_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

COMMIT;
