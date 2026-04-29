-- ─────────────────────────────────────────────────────────────────────────────
-- Community Generated Content (KNYT activation campaign launch)
--
-- Stores user-generated articles + stories (with associated images) remixed
-- from runtime experience capsules. Integrates with the existing 21 Sats
-- reaction system (KnytReactionBar) for like / spark / vote, the qc_balances
-- ledger for Q¢ pricing, and the runtime takeover catalog for admin-promoted
-- content.
--
-- Key tables:
--   community_generated_content  — one row per generated piece
--   community_content_quotas     — per-persona daily quota tracking
--   community_content_settings   — admin-tunable Q¢ costs + caps (single row)
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. content table
CREATE TABLE IF NOT EXISTS community_generated_content (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_persona_id    UUID NOT NULL,
  source_experience_id  TEXT,
  parent_id             UUID REFERENCES community_generated_content(id) ON DELETE SET NULL,
  skill                 TEXT NOT NULL CHECK (skill IN ('article', 'story')),
  title                 TEXT NOT NULL,
  prompt                TEXT NOT NULL,
  article_body          TEXT,
  image_url             TEXT,
  status                TEXT NOT NULL DEFAULT 'draft'
                          CHECK (status IN ('draft', 'shared', 'pending_promotion', 'runtime_promoted', 'rejected')),
  qc_cost               INTEGER NOT NULL DEFAULT 0,
  generation_index      INTEGER NOT NULL DEFAULT 0,
  refunded_at           TIMESTAMPTZ,
  runtime_promoted_at   TIMESTAMPTZ,
  runtime_promoted_by   UUID,
  rejected_at           TIMESTAMPTZ,
  rejected_by           UUID,
  rejection_reason      TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cgc_creator_persona ON community_generated_content(creator_persona_id);
CREATE INDEX IF NOT EXISTS idx_cgc_status         ON community_generated_content(status);
CREATE INDEX IF NOT EXISTS idx_cgc_source_exp     ON community_generated_content(source_experience_id);
CREATE INDEX IF NOT EXISTS idx_cgc_parent         ON community_generated_content(parent_id);
CREATE INDEX IF NOT EXISTS idx_cgc_created_at     ON community_generated_content(created_at DESC);

-- 2. per-persona daily quota tracking
--   one row per persona; counters reset implicitly via day comparison
CREATE TABLE IF NOT EXISTS community_content_quotas (
  persona_id              UUID PRIMARY KEY,
  daily_free_used         INTEGER NOT NULL DEFAULT 0,
  daily_free_used_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  last_discard_refund_at  TIMESTAMPTZ,
  daily_refund_used_date  DATE,
  total_generations       INTEGER NOT NULL DEFAULT 0,
  total_qc_spent          INTEGER NOT NULL DEFAULT 0,
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. admin-tunable settings — single-row config
CREATE TABLE IF NOT EXISTS community_content_settings (
  id                       INTEGER PRIMARY KEY DEFAULT 1,
  cost_qc_article          INTEGER NOT NULL DEFAULT 10,
  cost_qc_story            INTEGER NOT NULL DEFAULT 6,
  surcharge_pct            INTEGER NOT NULL DEFAULT 50,
  daily_free_quota         INTEGER NOT NULL DEFAULT 3,
  daily_discard_refund     INTEGER NOT NULL DEFAULT 1,
  discard_window_seconds   INTEGER NOT NULL DEFAULT 30,
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT singleton CHECK (id = 1)
);

-- seed the single config row
INSERT INTO community_content_settings (id) VALUES (1)
  ON CONFLICT (id) DO NOTHING;
