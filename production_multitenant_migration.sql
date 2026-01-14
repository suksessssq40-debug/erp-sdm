
-- MULTI-TENANT MIGRATION FOR PRODUCTION
-- PROJECT: opondzzpzxsfucakqwgz
-- GOAL: Implement Tenant structure without data loss.

BEGIN;

-- 1. Create Tenants table
CREATE TABLE IF NOT EXISTS "public"."tenants" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN DEFAULT true,
    "created_at" TIMESTAMPTZ(6) DEFAULT now(),
    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- 2. Insert default SDM tenant
INSERT INTO "public"."tenants" ("id", "name", "description") 
VALUES ('sdm', 'Sukses Digital Media', 'Main Office')
ON CONFLICT (id) DO NOTHING;

-- 3. Add tenant_id to all core tables
-- We use DEFAULT 'sdm' to ensure all existing data is correctly assigned to the main office.

-- Users
ALTER TABLE "public"."users" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT DEFAULT 'sdm';
UPDATE "public"."users" SET "tenant_id" = 'sdm' WHERE "tenant_id" IS NULL;

-- Settings
ALTER TABLE "public"."settings" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT DEFAULT 'sdm';
UPDATE "public"."settings" SET "tenant_id" = 'sdm' WHERE "tenant_id" IS NULL;
-- Ensure uniqueness for settings per tenant
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'settings_tenant_id_key') THEN
        ALTER TABLE "public"."settings" ADD CONSTRAINT "settings_tenant_id_key" UNIQUE ("tenant_id");
    END IF;
END $$;

-- Dashboard/Operational Tables
ALTER TABLE "public"."projects" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT DEFAULT 'sdm';
ALTER TABLE "public"."attendance" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT DEFAULT 'sdm';
ALTER TABLE "public"."leave_requests" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT DEFAULT 'sdm';
ALTER TABLE "public"."daily_reports" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT DEFAULT 'sdm';
ALTER TABLE "public"."chat_rooms" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT DEFAULT 'sdm';

-- Finance Tables
ALTER TABLE "public"."business_units" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT DEFAULT 'sdm';
ALTER TABLE "public"."transaction_categories" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT DEFAULT 'sdm';
ALTER TABLE "public"."chart_of_accounts" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT DEFAULT 'sdm';
ALTER TABLE "public"."financial_accounts" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT DEFAULT 'sdm';
ALTER TABLE "public"."transactions" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT DEFAULT 'sdm';

-- 4. Add Foreign Key Constraints (Safe mode)
DO $$ 
DECLARE
    t_name TEXT;
BEGIN
    FOR t_name IN SELECT UNNEST(ARRAY['users', 'settings', 'projects', 'attendance', 'leave_requests', 'daily_reports', 'chat_rooms', 'business_units', 'transaction_categories', 'chart_of_accounts', 'financial_accounts', 'transactions'])
    LOOP
        EXECUTE format('ALTER TABLE "public".%I DROP CONSTRAINT IF EXISTS %I', t_name, t_name || '_tenant_id_fkey');
        EXECUTE format('ALTER TABLE "public".%I ADD CONSTRAINT %I FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE', t_name, t_name || '_tenant_id_fkey');
    END LOOP;
END $$;

COMMIT;
