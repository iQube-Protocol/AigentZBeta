-- Standing tier — Tier 3 "Professional Standing" subscription on the plan.
--
-- Standing ladder (per Standing PRD v1):
--   Tier 1 Standing      = free (the open Standing cartridge) — no column needed.
--   Tier 2 Verified      = pay-per-asset (a discrete purchase that mints one
--                          sovereign Standing-asset iQube) — NOT a plan tier;
--                          gated per verification action.
--   Tier 3 Professional  = subscription (this column) OR bundled with Founder
--                          Office Pro (venture_tier pro/elite). Resolver ORs both.
--
-- Additive ALTER on persona_plans (created in 20260621100000). Apply that
-- migration first.

BEGIN;

ALTER TABLE public.persona_plans
  ADD COLUMN IF NOT EXISTS standing_tier text NOT NULL DEFAULT 'standing';

-- Drop + recreate the CHECK so re-runs are idempotent.
ALTER TABLE public.persona_plans DROP CONSTRAINT IF EXISTS persona_plans_standing_tier_check;
ALTER TABLE public.persona_plans
  ADD CONSTRAINT persona_plans_standing_tier_check
  CHECK (standing_tier IN ('standing','professional'));

COMMENT ON COLUMN public.persona_plans.standing_tier IS
  'Standing ladder: standing (free, default) | professional (Tier 3 subscription). Professional also granted by venture_tier pro/elite (bundled with Founder Office Pro).';

COMMIT;
