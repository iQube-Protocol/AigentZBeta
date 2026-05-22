-- ============================================================================
-- ActivationTab toggle — one row per (persona, qube) via partial unique index.
--
-- The activation flow had been re-using the comic-edition primitives
-- (`claimEditionForPurchase` / `releaseEdition` on `content_qube_editions`
-- with rarity='common'). That model assumes APPEND-ONLY common editions —
-- one persona may legitimately hold multiple commons on the same KNYT qube
-- across purchases. For activation toggles we need the opposite: EXACTLY
-- ONE row per (persona, qube), atomically UPSERTed when activate, UPDATEd
-- on revoke. Mixing the two semantics on a single column kept producing
-- duplicate rows and toggle bouncing.
--
-- Fix: introduce a new rarity sentinel 'activation' that's reserved for
-- activation_tab qubes only. A partial unique index on
-- (persona_id, content_qube_id) WHERE rarity='activation' guarantees the
-- one-row invariant without touching KNYT purchase semantics on
-- rarity='common'.
--
-- This migration:
--   1. Extends the rarity CHECK to include 'activation'.
--   2. Collapses any existing activation rows down to one per (persona,
--      qube): keeps the active row if one exists, otherwise the newest.
--   3. Re-rarities the surviving rows from 'common' to 'activation'.
--   4. Creates the partial unique index used by the new UPSERT path.
--   5. NOTIFY pgrst so PostgREST picks up the schema change immediately.
-- ============================================================================

-- 1. Extend the rarity CHECK.
ALTER TABLE public.content_qube_editions
  DROP CONSTRAINT IF EXISTS content_qube_editions_rarity_check;
ALTER TABLE public.content_qube_editions
  ADD CONSTRAINT content_qube_editions_rarity_check
  CHECK (rarity IN ('common', 'rare', 'epic', 'legendary', 'secret_black_rare', 'activation'));

-- 2. Collapse duplicate activation rows down to one per (persona, qube).
--    Prefer the row that's still active (released_at IS NULL); break ties
--    on issued_at DESC so the most recent claim wins.
WITH ranked AS (
  SELECT
    e.id,
    e.persona_id,
    e.content_qube_id,
    row_number() OVER (
      PARTITION BY e.persona_id, e.content_qube_id
      ORDER BY
        CASE WHEN e.released_at IS NULL THEN 0 ELSE 1 END,
        e.issued_at DESC NULLS LAST
    ) AS rn
  FROM public.content_qube_editions e
  JOIN public.content_qubes cq ON cq.id = e.content_qube_id
  WHERE cq.content_kind = 'activation_tab'
    AND e.rarity = 'common'
    AND e.persona_id IS NOT NULL
)
DELETE FROM public.content_qube_editions
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- 3. Re-rarity the surviving rows from 'common' to 'activation'.
UPDATE public.content_qube_editions e
SET rarity = 'activation'
FROM public.content_qubes cq
WHERE e.content_qube_id = cq.id
  AND cq.content_kind = 'activation_tab'
  AND e.rarity = 'common'
  AND e.persona_id IS NOT NULL;

-- 4. Partial unique index — guarantees one activation row per (persona, qube).
--    This is what makes `.upsert(..., { onConflict: 'persona_id,content_qube_id' })`
--    deterministic in the service layer.
CREATE UNIQUE INDEX IF NOT EXISTS idx_cq_edition_activation_unique
  ON public.content_qube_editions (persona_id, content_qube_id)
  WHERE rarity = 'activation';

-- 5. Reload PostgREST schema cache so the new rarity value + index are visible.
NOTIFY pgrst, 'reload schema';

COMMENT ON INDEX public.idx_cq_edition_activation_unique IS
  'Enforces one-row-per-(persona, qube) for ActivationTab toggles. Activation editions use rarity=''activation'' so this never conflicts with KNYT purchase commons that are legitimately multi-row per persona.';
