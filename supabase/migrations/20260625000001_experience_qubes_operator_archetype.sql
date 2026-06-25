-- ============================================================================
-- Add operator_archetype to experience_qubes.
--
-- Stores the operator's primary participation archetype from the Polity
-- Participation Model (citizen | entrepreneurial | technical | creative).
-- T1 (public-safe) — part of the meta slice, never the BlakQube payload.
-- Feeds NBE reranking so aigentMe biases toward archetype-appropriate moves.
--
-- Nullable: existing rows keep NULL until the operator completes setup again.
-- No backfill — NULL is the valid "not yet chosen" state.
-- Idempotent via ADD COLUMN IF NOT EXISTS.
-- ============================================================================

ALTER TABLE public.experience_qubes
  ADD COLUMN IF NOT EXISTS operator_archetype TEXT
  CHECK (operator_archetype IS NULL OR operator_archetype IN (
    'citizen',
    'entrepreneurial',
    'technical',
    'creative'
  ));
