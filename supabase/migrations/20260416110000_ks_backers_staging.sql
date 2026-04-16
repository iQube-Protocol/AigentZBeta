-- KS Backers Staging Table
--
-- Quarantined phase-1 staging dataset for 3,267 KS backers.
-- Schema is a superset of nakamoto_knyt_personas — starts sparse
-- (name + email only) and grows via enrichment toward canonical parity.
--
-- NEVER merge canonical_dataset=false records into nakamoto_knyt_personas
-- or crm_personas until the Phase 2 hygiene gate passes (doc 31).
--
-- Run AFTER 20260416100000_knyt_crm_dataqube_registration.sql

CREATE TABLE IF NOT EXISTS ks_backers_staging (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- ── Seed fields (populated on import) ────────────────────────────────────
  first_name            text,
  last_name             text,
  email                 text NOT NULL,
  normalized_email      text GENERATED ALWAYS AS (lower(trim(email))) STORED,

  -- ── Dataset identity ─────────────────────────────────────────────────────
  cohort_id             text NOT NULL DEFAULT 'ks_backers',
  campaign_id           text NOT NULL DEFAULT 'knyt_ks_campaign',
  seed_source           text NOT NULL DEFAULT 'ks_backers_seed_phase1',
  storage_tier          text NOT NULL DEFAULT 'staging',
  canonical_dataset     boolean NOT NULL DEFAULT false,

  -- ── Cross-reference (set by import script) ───────────────────────────────
  -- Populated when a canonical match is found by normalized_email.
  canonical_persona_id  uuid REFERENCES nakamoto_knyt_personas(id) ON DELETE SET NULL,
  crm_persona_id        uuid REFERENCES crm_personas(id) ON DELETE SET NULL,
  dedup_status          text NOT NULL DEFAULT 'not_checked',
  -- Values: not_checked | unique | duplicate_canonical | suppressed

  -- ── Hygiene fields (populated as emails send / bounce) ───────────────────
  deliverability_status text NOT NULL DEFAULT 'unknown',
  -- Values: unknown | deliverable | bounced_hard | bounced_soft | unsubscribed
  engagement_status     text NOT NULL DEFAULT 'not_contacted',
  -- Values: not_contacted | sent | opened | clicked | replied | converted | unresponsive
  suppression_status    text NOT NULL DEFAULT 'active',
  -- Values: active | suppressed
  bounce_count          int NOT NULL DEFAULT 0,
  unsubscribed_at       timestamptz,
  last_sent_at          timestamptz,
  last_opened_at        timestamptz,
  last_clicked_at       timestamptz,

  -- ── Enrichment fields (nullable — filled toward canonical parity) ─────────
  -- These mirror the key columns in nakamoto_knyt_personas / crm_personas.
  -- All NULL until enriched. Phase 2 gate: these are populated before merge.
  "Total-Invested"      numeric,
  "OM-Tier-Status"      text,
  campaign_cohort       text,
  investment_amount_band text,
  matrix_y_stage        text,
  ks_backer             boolean,
  campaign_state        text,
  offer_fit             text,
  display_name          text,
  fio_handle            text,
  order_tier            text,
  knyt_id               text,

  -- ── Canonization tracking ─────────────────────────────────────────────────
  enrichment_status     text NOT NULL DEFAULT 'seed_only',
  -- Values: seed_only | cross_referenced | enriched | canonical_ready
  canonized_at          timestamptz,
  canonized_by          text,

  -- ── Audit ─────────────────────────────────────────────────────────────────
  imported_at           timestamptz NOT NULL DEFAULT now(),
  imported_by           text NOT NULL DEFAULT 'import-script',
  updated_at            timestamptz NOT NULL DEFAULT now()
);

-- Unique constraint on normalized email within this staging table
CREATE UNIQUE INDEX IF NOT EXISTS ks_backers_staging_email_idx
  ON ks_backers_staging (normalized_email);

-- Index for canonical cross-reference lookups
CREATE INDEX IF NOT EXISTS ks_backers_staging_canonical_idx
  ON ks_backers_staging (canonical_persona_id)
  WHERE canonical_persona_id IS NOT NULL;

-- Index for hygiene pipeline queries
CREATE INDEX IF NOT EXISTS ks_backers_staging_status_idx
  ON ks_backers_staging (dedup_status, deliverability_status, engagement_status);

-- RLS: admin-only, never exposed to public
ALTER TABLE ks_backers_staging ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ks_backers_staging_admin_only"
  ON ks_backers_staging
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM personas p
      WHERE p.user_id = auth.uid()
        AND p.role IN ('admin', 'super_admin')
    )
  );

COMMENT ON TABLE ks_backers_staging IS
  'Phase-1 staging dataset for 3,267 KS backers. Non-canonical until Phase 2 '
  'hygiene gate (doc 31) passes. Schema is a superset of nakamoto_knyt_personas — '
  'enrichment fields populated progressively; merge to canonical on canonization.';
