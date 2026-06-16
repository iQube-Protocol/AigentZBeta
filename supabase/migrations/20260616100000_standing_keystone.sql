-- 20260616100000 — Standing keystone (Phase 2)
--
-- Extends the existing KNYT reputation engine with the three Standing
-- categories: Personal (own contributions), Delegated (sponsored
-- participants' contributions), and Stewardship (cultivation effectiveness).
-- Standing is a *layer on top of* reputation, not a replacement — reputation
-- vectors (rep_technical/creative/etc.) continue to accrue from completeTask
-- exactly as today; the accrual service additively writes a Standing delta
-- on the same event.
--
-- Additive and idempotent. No data is rewritten; everything defaults to 0 and
-- begins accruing on the next task completion / reward event.
--
-- Per Extend-Don't-Duplicate: no parallel tables, no parallel events. The
-- delta lives alongside the existing reputation delta on crm_reputation_events;
-- the rollup lives alongside the existing rep_* vector on
-- crm_persona_reputation; the routing tag lives on crm_task_templates.

BEGIN;

-- ─── crm_persona_reputation: the Standing vector ────────────────────────────

ALTER TABLE public.crm_persona_reputation
  ADD COLUMN IF NOT EXISTS standing_personal     NUMERIC(12,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS standing_delegated    NUMERIC(12,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS standing_stewardship  NUMERIC(12,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS standing_overall      NUMERIC(12,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS standing_bucket       INTEGER NOT NULL DEFAULT 0
    CHECK (standing_bucket BETWEEN 0 AND 4);

COMMENT ON COLUMN public.crm_persona_reputation.standing_personal IS
  'Personal Standing — accrues from this persona''s own task completions and rewards (event-driven).';
COMMENT ON COLUMN public.crm_persona_reputation.standing_delegated IS
  'Delegated Standing — accrues when this persona''s sponsored participants earn Personal Standing.';
COMMENT ON COLUMN public.crm_persona_reputation.standing_stewardship IS
  'Stewardship Standing — effectiveness of cultivation, granted when sponsored participants cross the Standing threshold.';
COMMENT ON COLUMN public.crm_persona_reputation.standing_overall IS
  'Composite Standing score (weighted sum); drives the Provisional -> Standing transition and Sponsorship Capacity in Phase 3.';
COMMENT ON COLUMN public.crm_persona_reputation.standing_bucket IS
  '0-4 bucket derived from standing_overall for the wallet dot strip (reuses the existing reputation bucket primitive).';

CREATE INDEX IF NOT EXISTS idx_persona_reputation_standing_overall
  ON public.crm_persona_reputation (standing_overall DESC);

-- ─── crm_task_templates: standing_type routing tag ──────────────────────────
-- Determines which Standing category a task contributes to when completed.
-- Default 'personal' so existing task templates continue to behave as before.

ALTER TABLE public.crm_task_templates
  ADD COLUMN IF NOT EXISTS standing_type TEXT NOT NULL DEFAULT 'personal';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'crm_task_templates_standing_type_check'
  ) THEN
    ALTER TABLE public.crm_task_templates
      ADD CONSTRAINT crm_task_templates_standing_type_check
      CHECK (standing_type IN ('personal', 'delegated', 'stewardship'));
  END IF;
END $$;

COMMENT ON COLUMN public.crm_task_templates.standing_type IS
  'Routes Standing accrual on task completion. personal = caller; delegated = caller and sponsor; stewardship = sponsor only.';

-- ─── crm_reputation_events: per-event Standing delta ────────────────────────

ALTER TABLE public.crm_reputation_events
  ADD COLUMN IF NOT EXISTS standing_category       TEXT,
  ADD COLUMN IF NOT EXISTS standing_accrual_delta  NUMERIC(12,4) DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'crm_reputation_events_standing_category_check'
  ) THEN
    ALTER TABLE public.crm_reputation_events
      ADD CONSTRAINT crm_reputation_events_standing_category_check
      CHECK (standing_category IS NULL OR standing_category IN ('personal', 'delegated', 'stewardship'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_reputation_events_standing
  ON public.crm_reputation_events (standing_category)
  WHERE standing_category IS NOT NULL;

COMMIT;
