-- ============================================================================
-- content_qube_editions.released_at — soft-release flag.
--
-- Phase: ActivationTab refactor (Aigent Me Phase 4.b)
--
-- Today: releaseEdition() DELETEs the edition row on burn. That works for
-- one-shot grants but breaks for surfaces that auto-grant on first read —
-- the next read sees "no edition" and re-claims, undoing the user's
-- deactivation. We need to distinguish:
--
--   1. Persona never claimed → auto-grant if policy allows
--   2. Persona claimed and is holding → active
--   3. Persona claimed and released (deactivated) → DO NOT auto-grant again
--
-- Adding `released_at` keeps the edition row after release. persona_id
-- stays set (preserves the audit link and lets re-activation be a simple
-- UPDATE rather than a fresh INSERT). Active editions have
-- released_at IS NULL.
--
-- This is additive — existing canonical claim / common append paths
-- ignore the new column unless they explicitly read it.
-- ============================================================================

ALTER TABLE public.content_qube_editions
  ADD COLUMN IF NOT EXISTS released_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_cq_edition_released
  ON public.content_qube_editions (persona_id, released_at)
  WHERE released_at IS NOT NULL;

COMMENT ON COLUMN public.content_qube_editions.released_at IS
  'When the persona released this edition (e.g. deactivated an ActivationTab). Active editions have released_at IS NULL. persona_id remains set on released editions so re-activation is an idempotent UPDATE and the burn audit trail is preserved.';
