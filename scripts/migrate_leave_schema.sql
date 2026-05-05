-- ============================================================
-- MIGRATION: Leave Schema v2 & system_logs Cleanup
-- Run this ONCE against Production before pushing the new code.
-- Safe to re-run (uses IF NOT EXISTS / DO $$ blocks).
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- STEP 1: Add new SOP policy columns to `tenants` (idempotent)
-- ────────────────────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='tenants' AND column_name='leave_weekly_limit'
  ) THEN
    ALTER TABLE tenants ADD COLUMN leave_weekly_limit   INTEGER NOT NULL DEFAULT 1;
    ALTER TABLE tenants ADD COLUMN leave_annual_quota   INTEGER NOT NULL DEFAULT 12;
    ALTER TABLE tenants ADD COLUMN leave_sudden_penalty INTEGER NOT NULL DEFAULT 2;
    ALTER TABLE tenants ADD COLUMN leave_notice_threshold  INTEGER NOT NULL DEFAULT 2;
    ALTER TABLE tenants ADD COLUMN leave_notice_required   INTEGER NOT NULL DEFAULT 7;
    ALTER TABLE tenants ADD COLUMN leave_sudden_hour_cutoff INTEGER NOT NULL DEFAULT 16;
    RAISE NOTICE 'Tenant SOP columns added.';
  ELSE
    RAISE NOTICE 'Tenant SOP columns already exist — skipped.';
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────
-- STEP 2: Add new enforcement columns to `leave_requests` (idempotent)
-- ────────────────────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='leave_requests' AND column_name='is_sudden'
  ) THEN
    ALTER TABLE leave_requests ADD COLUMN is_sudden      BOOLEAN DEFAULT FALSE;
    ALTER TABLE leave_requests ADD COLUMN has_doctor_note BOOLEAN DEFAULT FALSE;
    ALTER TABLE leave_requests ADD COLUMN penalty_weight  INTEGER DEFAULT 1;
    RAISE NOTICE 'leave_requests enforcement columns added.';
  ELSE
    RAISE NOTICE 'leave_requests enforcement columns already exist — skipped.';
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────
-- STEP 3: SAFE BigInt → Timestamptz migration for created_at
--         Convert milliseconds-since-epoch into actual timestamps.
-- ────────────────────────────────────────────────────────────

-- 3a. Add a temporary staging column
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='leave_requests' AND column_name='created_at_new'
  ) THEN
    ALTER TABLE leave_requests ADD COLUMN created_at_new TIMESTAMPTZ;
    -- Backfill: cast BigInt (ms epoch) → timestamptz
    -- Guard: if value is already small enough to be seconds (pre-2001 epoch in ms would be < 1e12),
    -- treat as ms. Otherwise fall back to NOW().
    UPDATE leave_requests
    SET created_at_new = CASE
        WHEN created_at IS NOT NULL AND created_at > 0 AND created_at < 9999999999999
          THEN to_timestamp(created_at::BIGINT / 1000.0) AT TIME ZONE 'UTC'
        ELSE NOW()
    END;
    RAISE NOTICE 'created_at_new populated from BigInt.';
  ELSE
    RAISE NOTICE 'created_at_new already exists — skipped re-population.';
  END IF;
END $$;

-- 3b. Drop old BigInt column, rename new one
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='leave_requests' AND column_name='created_at_new'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='leave_requests' AND column_name='created_at'
    AND data_type IN ('bigint','int8')
  ) THEN
    ALTER TABLE leave_requests DROP COLUMN created_at;
    ALTER TABLE leave_requests RENAME COLUMN created_at_new TO created_at;
    ALTER TABLE leave_requests ALTER COLUMN created_at SET DEFAULT NOW();
    RAISE NOTICE 'created_at migrated BigInt → TIMESTAMPTZ.';
  ELSE
    RAISE NOTICE 'created_at already migrated or column not found — skipped.';
  END IF;
END $$;

-- 3c. Same for action_at
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='leave_requests' AND column_name='action_at_new'
  ) THEN
    ALTER TABLE leave_requests ADD COLUMN action_at_new TIMESTAMPTZ;
    UPDATE leave_requests
    SET action_at_new = CASE
        WHEN action_at IS NOT NULL AND action_at > 0 AND action_at < 9999999999999
          THEN to_timestamp(action_at::BIGINT / 1000.0) AT TIME ZONE 'UTC'
        ELSE NULL
    END;
    RAISE NOTICE 'action_at_new populated.';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='leave_requests' AND column_name='action_at_new'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='leave_requests' AND column_name='action_at'
    AND data_type IN ('bigint','int8')
  ) THEN
    ALTER TABLE leave_requests DROP COLUMN action_at;
    ALTER TABLE leave_requests RENAME COLUMN action_at_new TO action_at;
    RAISE NOTICE 'action_at migrated BigInt → TIMESTAMPTZ.';
  ELSE
    RAISE NOTICE 'action_at already migrated — skipped.';
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────
-- STEP 4: Create leave_quotas table (idempotent)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS leave_quotas (
  id              TEXT        PRIMARY KEY,
  user_id         TEXT        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  year            INTEGER     NOT NULL,
  total_quota     INTEGER     NOT NULL DEFAULT 12,
  used_quota      INTEGER     NOT NULL DEFAULT 0,
  remaining_quota INTEGER     NOT NULL DEFAULT 12,
  tenant_id       TEXT        DEFAULT 'sdm' REFERENCES tenants(id) ON DELETE CASCADE,
  CONSTRAINT leave_quotas_user_year_unique UNIQUE (user_id, year)
);

-- ────────────────────────────────────────────────────────────
-- STEP 5: Prune system_logs — delete entries older than 30 days.
--         Keeps recent audit trail while controlling DB bloat.
-- ────────────────────────────────────────────────────────────
DELETE FROM system_logs
WHERE to_timestamp(timestamp / 1000.0) AT TIME ZONE 'UTC'
      < NOW() - INTERVAL '30 days';

DO $$
DECLARE
  deleted_count BIGINT;
BEGIN
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE 'system_logs pruned: % rows deleted (older than 30 days).', deleted_count;
END $$;

-- ────────────────────────────────────────────────────────────
-- DONE
-- ────────────────────────────────────────────────────────────
-- After running this script successfully, push your code and run:
--   npx prisma generate
--   npx prisma db push --accept-data-loss   (only if needed for minor schema drift)
