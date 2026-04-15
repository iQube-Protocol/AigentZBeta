-- Migration: Add Y-axis engagement signal columns to nakamoto_knyt_personas
--
-- Rationale:
--   The KNYT experience matrix X-axis is derived from investment tier (OM-Tier-Status
--   or amount-derived). The Y-axis currently only distinguishes Collector (has investment)
--   vs Observer (no investment). To support the full Y-axis ladder:
--
--     Observer → Collector → Curator → Correspondent → Remixer → Creator → Steward → Franchisee
--
--   We need platform engagement signals that can be back-filled via CRM import,
--   platform event tracking, or operator audit. All columns default to NULL/FALSE/0
--   so existing rows are unaffected.
--
-- The crm-matrix-prep SkillQube reads these columns to compute matrix_y_stage.
-- The crm-data-cleanup SkillQube normalises tier values and deduplicates records.
--
-- Y-stage derivation (in priority order, highest wins):
--   is_franchisee  = TRUE                          → 'franchisee'
--   is_steward     = TRUE                          → 'steward'
--   is_content_creator OR content_contribution_count > 2 → 'creator'
--   is_remixer     OR remix_count > 0              → 'remixer'
--   content_contribution_count > 0                 → 'curator'
--   platform_engagement_score >= 50                → 'correspondent'
--   has_investment (tier resolved or invested >= 100) → 'collector'
--   else                                           → 'observer'

ALTER TABLE public."nakamoto_knyt_personas"
  -- Computed Y-axis stage — written by crm-matrix-prep, read by dashboard matrix view
  ADD COLUMN IF NOT EXISTS matrix_y_stage              TEXT        DEFAULT NULL,
  -- Content engagement counters (forum posts, published experiences, shared content)
  ADD COLUMN IF NOT EXISTS content_contribution_count  INTEGER     NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS remix_count                 INTEGER     NOT NULL DEFAULT 0,
  -- Platform interaction score (0–100 composite; incremented by platform events)
  ADD COLUMN IF NOT EXISTS platform_engagement_score   INTEGER     NOT NULL DEFAULT 0,
  -- Role flags — set by operator or computed by crm-matrix-prep
  ADD COLUMN IF NOT EXISTS is_content_creator          BOOLEAN     NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_remixer                  BOOLEAN     NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_steward                  BOOLEAN     NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_franchisee               BOOLEAN     NOT NULL DEFAULT FALSE,
  -- Freeform community role label for display (e.g. "KNYT Ambassador", "Chapter Lead")
  ADD COLUMN IF NOT EXISTS community_role              TEXT        DEFAULT NULL;

-- Index for matrix queries that filter by y-stage
CREATE INDEX IF NOT EXISTS idx_nakamoto_knyt_personas_matrix_y_stage
  ON public."nakamoto_knyt_personas" (matrix_y_stage)
  WHERE matrix_y_stage IS NOT NULL;

-- Index for engagement-score-based queries
CREATE INDEX IF NOT EXISTS idx_nakamoto_knyt_personas_engagement_score
  ON public."nakamoto_knyt_personas" (platform_engagement_score)
  WHERE platform_engagement_score > 0;

COMMENT ON COLUMN public."nakamoto_knyt_personas".matrix_y_stage
  IS 'Computed Y-axis position in the KNYT experience matrix. Values: observer | collector | curator | correspondent | remixer | creator | steward | franchisee. Written by /api/skills/crm/matrix-prep.';

COMMENT ON COLUMN public."nakamoto_knyt_personas".content_contribution_count
  IS 'Number of platform content contributions (forum posts, shared experiences, etc.). Used to derive creator/curator Y-stage.';

COMMENT ON COLUMN public."nakamoto_knyt_personas".remix_count
  IS 'Number of remixed or forked experience assets. Used to derive remixer Y-stage.';

COMMENT ON COLUMN public."nakamoto_knyt_personas".platform_engagement_score
  IS 'Composite 0–100 engagement score. Score >= 50 promotes to correspondent Y-stage.';

COMMENT ON COLUMN public."nakamoto_knyt_personas".is_content_creator
  IS 'TRUE if this investor has been confirmed as a content creator (operator-set or computed).';

COMMENT ON COLUMN public."nakamoto_knyt_personas".is_remixer
  IS 'TRUE if this investor has actively remixed platform experiences.';

COMMENT ON COLUMN public."nakamoto_knyt_personas".is_steward
  IS 'TRUE if this investor holds a community steward/ambassador role.';

COMMENT ON COLUMN public."nakamoto_knyt_personas".is_franchisee
  IS 'TRUE if this investor is a Nakamoto/metaMe franchise operator.';

COMMENT ON COLUMN public."nakamoto_knyt_personas".community_role
  IS 'Human-readable community role label for display. E.g. "KNYT Ambassador", "Chapter Lead".';
