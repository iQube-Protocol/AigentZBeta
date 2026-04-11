-- ============================================================================
-- journey_states: add tenant_id column + unique constraint
--
-- The original migration omitted tenant_id, which caused the seed endpoint's
-- upsert (onConflict: 'persona_id,tenant_id') to fail silently, leaving only
-- the original 196 stale rows in place.
-- ============================================================================

-- 1. Add tenant_id column (safe to run multiple times)
ALTER TABLE public.journey_states
  ADD COLUMN IF NOT EXISTS tenant_id text NOT NULL DEFAULT 'nakamoto';

-- 2. Add unique constraint so Supabase upsert + DELETE/INSERT can work
--    Uses a DO block because PostgreSQL has no IF NOT EXISTS for ADD CONSTRAINT.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'journey_states_persona_tenant_key'
      AND conrelid = 'public.journey_states'::regclass
  ) THEN
    ALTER TABLE public.journey_states
      ADD CONSTRAINT journey_states_persona_tenant_key UNIQUE (persona_id, tenant_id);
  END IF;
END;
$$;

-- 3. Index for fast tenant-scoped queries
CREATE INDEX IF NOT EXISTS idx_journey_states_tenant
  ON public.journey_states(tenant_id);
