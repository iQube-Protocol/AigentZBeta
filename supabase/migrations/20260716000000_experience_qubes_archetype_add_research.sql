-- ============================================================================
-- Add the 'research' operator archetype to experience_qubes.
--
-- The Polity Participation Model gains a fifth pathway — the Researcher — a
-- peer to the technical/developer pathway (Phase 20, 2026-07-16). The prior
-- CHECK constraint (20260625000001) enumerated only the original four
-- archetypes, so it would reject 'research' at write time; this migration
-- widens the allowed set to include it.
--
-- Idempotent: drops the prior named/anonymous CHECK on operator_archetype and
-- re-adds the widened one. Safe to re-run — existing NULL / four-value rows
-- continue to satisfy the new constraint. No backfill; NULL stays the valid
-- "not yet chosen" state.
-- ============================================================================

DO $$
DECLARE
  c record;
BEGIN
  -- Drop any existing CHECK constraint that references operator_archetype,
  -- regardless of its auto-generated name.
  FOR c IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE nsp.nspname = 'public'
      AND rel.relname = 'experience_qubes'
      AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) ILIKE '%operator_archetype%'
  LOOP
    EXECUTE format('ALTER TABLE public.experience_qubes DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

ALTER TABLE public.experience_qubes
  ADD CONSTRAINT experience_qubes_operator_archetype_check
  CHECK (operator_archetype IS NULL OR operator_archetype IN (
    'citizen',
    'entrepreneurial',
    'technical',
    'creative',
    'research'
  ));
