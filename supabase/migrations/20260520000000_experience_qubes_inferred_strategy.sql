-- ============================================================================
-- experience_qubes — add inferred_strategy cache.
--
-- Phase: Aigent Me Phase 3.b — strategy inference layer.
--
-- Adds two columns:
--   - inferred_strategy jsonb : T1-safe shape (no T0 identifiers) holding the
--                               derived prose strategy + correlations + NBE hints.
--   - inferred_at timestamptz : when the inference was last computed. Used to
--                               decide whether to refresh (older than 24h, or
--                               updated_at > inferred_at → regenerate).
--
-- Privacy: inferred_strategy is derived FROM blak_qube but only stores
-- non-confidential synthesis — prose summaries, structured correlations,
-- keyword/cartridge hints. It is safe to surface on T1 routes.
-- ============================================================================

ALTER TABLE public.experience_qubes
  ADD COLUMN IF NOT EXISTS inferred_strategy jsonb,
  ADD COLUMN IF NOT EXISTS inferred_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_experience_qubes_inferred_at
  ON public.experience_qubes(inferred_at);

COMMENT ON COLUMN public.experience_qubes.inferred_strategy IS
  'T1-safe synthesized strategy (headline, postures, correlations, nbe_hints). Refreshed by services/strategy/strategyInference.ts.';
COMMENT ON COLUMN public.experience_qubes.inferred_at IS
  'When inferred_strategy was last computed. Stale after 24h or when meta/blak changes.';
