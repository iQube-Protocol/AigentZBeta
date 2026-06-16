-- 20260616000000 — Identity hardening event (Phase 1 / G3)
--
-- On successful World ID verification, the verified Citizen Passport becomes
-- the canonical one for that human, and any *linkable* legacy active sibling
-- Citizen Passports (same persona, same root, or same Kybe) are demoted to
-- 'superseded_non_canonical' — citizenhood is unique. Their Kybe DIDs become
-- candidates for conversion to Agent Root DIDs (the conversion endpoint itself
-- is Phase 4 admin governance).
--
-- This migration is additive and idempotent:
--   - polity_passport_records gets `canonical_citizen` (default false; flips
--     true on the verified row at hardening time).
--   - polity_passport_records.citizen_status CHECK is extended with the new
--     value 'superseded_non_canonical' (preserves all existing values, mirrors
--     the existing 'superseded_by_reissue' naming convention).
--   - kybe_identity gets `agent_conversion_candidate` + `_at` flags Phase 4
--     reads to expose conversion candidates to admin governance.
--
-- Citizen irrevocability is preserved: demotion is a citizen_status change,
-- not a revoke (the `citizen_irrevocable` CHECK constraint stays intact).

BEGIN;

-- ─── polity_passport_records: canonical marker + demotion status ────────────

ALTER TABLE public.polity_passport_records
  ADD COLUMN IF NOT EXISTS canonical_citizen boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.polity_passport_records.canonical_citizen IS
  'True for the elected canonical Citizen Passport after World ID hardening. KPI counter source.';

-- Partial index for fast KPI count of canonical Citizen Passports.
CREATE INDEX IF NOT EXISTS idx_pp_records_canonical_citizen
  ON public.polity_passport_records (canonical_citizen)
  WHERE canonical_citizen = true;

-- Extend citizen_status CHECK to allow 'superseded_non_canonical'. We drop and
-- recreate the constraint (Postgres has no in-place ALTER CHECK). The new value
-- is appended; all prior values remain valid.
DO $$
DECLARE
  constraint_name text;
BEGIN
  SELECT conname INTO constraint_name
    FROM pg_constraint
    WHERE conrelid = 'public.polity_passport_records'::regclass
      AND pg_get_constraintdef(oid) ILIKE '%citizen_status%'
      AND contype = 'c'
    LIMIT 1;
  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.polity_passport_records DROP CONSTRAINT %I', constraint_name);
  END IF;
END
$$;

ALTER TABLE public.polity_passport_records
  ADD CONSTRAINT polity_passport_records_citizen_status_check CHECK (
    citizen_status IS NULL OR citizen_status IN (
      'draft',
      'submitted',
      'pending_approval',
      'active',
      'renewal_due',
      'expired_non_renewal',
      'dormant',
      'inactive_presumed',
      'ceased_death_confirmed',
      'superseded_by_reissue',
      'superseded_non_canonical'
    )
  );

-- ─── kybe_identity: agent-conversion candidacy flags ────────────────────────

ALTER TABLE public.kybe_identity
  ADD COLUMN IF NOT EXISTS agent_conversion_candidate boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS agent_conversion_candidate_at timestamptz;

COMMENT ON COLUMN public.kybe_identity.agent_conversion_candidate IS
  'Set true when this Kybe DID belongs to a Citizen Passport demoted by the hardening event; Phase 4 admin governance reads this to surface conversion candidates.';

CREATE INDEX IF NOT EXISTS idx_kybe_identity_conversion_candidate
  ON public.kybe_identity (agent_conversion_candidate)
  WHERE agent_conversion_candidate = true;

COMMIT;
