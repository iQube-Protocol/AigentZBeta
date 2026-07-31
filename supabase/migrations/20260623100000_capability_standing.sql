-- 20260623100000 — Capability Standing (front-half agency signal)
--
-- Adds `standing_capability` to crm_persona_reputation. This column records
-- agency assembled *before* outcomes — identity depth, intent clarity, demand
-- evidence, capability confidence, opportunity signal. It is computed from
-- VentureQube signal evidence and passport depth; it never exceeds a ceiling
-- of 40 and is monotone (only ever increases, so noisy signal updates don't
-- punish citizens). Consequence Standing (personal + delegated + stewardship)
-- remains the dominant standing signal; capability contributes a 30% weight
-- additive that makes the front-half of the loop legible.
--
-- standing_overall is updated by the application layer (accrueCapabilityStanding
-- in standingAccrualService.ts) every time signal evidence changes, exactly as
-- the consequence lanes are updated on task completion.
--
-- Additive and idempotent. No existing data is rewritten. Rows without a
-- capability update default to 0, which is correct — Capability Standing only
-- accrues when the citizen engages the VentureQube / portfolio flows.

BEGIN;

ALTER TABLE public.crm_persona_reputation
  ADD COLUMN IF NOT EXISTS standing_capability NUMERIC(12,4) NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.crm_persona_reputation.standing_capability IS
  'Capability Standing — front-half agency signal accrued from identity depth, '
  'intent clarity, demand evidence, opportunity signal, and capability confidence. '
  'Ceiling: 40 points. Monotone: only increases. Contributes ~30% to standing_overall.';

CREATE INDEX IF NOT EXISTS idx_persona_reputation_standing_capability
  ON public.crm_persona_reputation (standing_capability DESC)
  WHERE standing_capability > 0;

COMMIT;
