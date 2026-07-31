-- ============================================================================
-- Research Copilot as its own dedicated tier / SKU (Phase 21, 2026-07-16).
--
-- Operator direction: the Research Copilot (IRL) is a SEPARATE unlock with a
-- unique SKU — purchased on its own, NOT bundled into the Sovereignty tier the
-- way aigentZ's `aigentzLiteAccess` is. It is priced at the same stage as
-- Sovereignty ($29/mo) but sold as its own tier.
--
-- This adds a dedicated `research_tier` column to persona_plans, coexisting
-- with `plan_tier` / `venture_tier` / `standing_tier` (the same additive,
-- multi-column model those already use). 'active' == the Research Copilot tier
-- is owned; 'none' == not owned. The `research_copilot` TIER_CONFIG entry
-- (services/billing/planCheckout.ts) writes 'active' here on purchase, and
-- getPersonaPlan derives `researchCopilotAccess` from it.
--
-- Idempotent: ADD COLUMN IF NOT EXISTS; drops/re-adds the CHECK by lookup.
-- Nullable with default 'none' — existing rows are unaffected (no backfill;
-- NULL/'none' both mean "not owned").
-- ============================================================================

ALTER TABLE public.persona_plans
  ADD COLUMN IF NOT EXISTS research_tier TEXT DEFAULT 'none';

DO $$
DECLARE
  c record;
BEGIN
  FOR c IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE nsp.nspname = 'public'
      AND rel.relname = 'persona_plans'
      AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) ILIKE '%research_tier%'
  LOOP
    EXECUTE format('ALTER TABLE public.persona_plans DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

ALTER TABLE public.persona_plans
  ADD CONSTRAINT persona_plans_research_tier_check
  CHECK (research_tier IS NULL OR research_tier IN ('none', 'active'));
