-- Registry Ingestion Factory v1
-- Governed capability-ingestion pipeline for AgentiQ
-- All external tools, skills, MCP servers, and workflows are packaged into
-- composable iQubes before being listed, composed, or invoked.

-- ─────────────────────────────────────────────────────────────────────────────
-- registry_intakes
-- One row per inbound submission. Tracks the raw source before any processing.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS registry_intakes (
  intake_id       TEXT        PRIMARY KEY,
  tenant_id       TEXT        NOT NULL,
  submitted_by    TEXT        NOT NULL,  -- personaId
  source_type     TEXT        NOT NULL,  -- github_repo | package_ref | mcp_endpoint | archive | manual_bundle | workflow_def
  source_uri      TEXT,                  -- URL, npm ref, MCP URL, etc.
  source_payload  JSONB       NOT NULL DEFAULT '{}',  -- raw submitted data
  status          TEXT        NOT NULL DEFAULT 'received',
  -- received | fetching | classifying | packaging | validating | scored | review_pending | published | rejected | failed
  current_stage   TEXT        NOT NULL DEFAULT 'intake.created',
  stage_history   JSONB       NOT NULL DEFAULT '[]',
  asset_id        TEXT,                  -- set after packaging completes
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  failure_reason  TEXT
);

CREATE INDEX IF NOT EXISTS idx_registry_intakes_tenant  ON registry_intakes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_registry_intakes_status  ON registry_intakes(status);
CREATE INDEX IF NOT EXISTS idx_registry_intakes_asset   ON registry_intakes(asset_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- registry_sources
-- Fetched + fingerprinted source artifacts. Immutable once written.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS registry_sources (
  source_id       TEXT        PRIMARY KEY,
  intake_id       TEXT        NOT NULL REFERENCES registry_intakes(intake_id) ON DELETE CASCADE,
  source_type     TEXT        NOT NULL,
  uri             TEXT,
  content_hash    TEXT,        -- SHA-256 of fetched content
  content_size    BIGINT,
  manifest        JSONB       NOT NULL DEFAULT '{}',  -- detected metadata (name, version, license, etc.)
  raw_refs        JSONB       NOT NULL DEFAULT '[]',  -- list of file/endpoint refs captured
  fetch_status    TEXT        NOT NULL DEFAULT 'pending',  -- pending | completed | failed
  fetched_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_registry_sources_intake ON registry_sources(intake_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- registry_assets
-- Canonical packaged asset. One asset can have many versions.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS registry_assets (
  asset_id        TEXT        PRIMARY KEY,
  tenant_id       TEXT        NOT NULL,
  asset_class     TEXT        NOT NULL,  -- ToolQube | SkillQube | WorkflowQube | ConnectorQube
  name            TEXT        NOT NULL,
  slug            TEXT        NOT NULL,
  description     TEXT,
  icon_url        TEXT,
  source_id       TEXT        REFERENCES registry_sources(source_id),
  intake_id       TEXT        REFERENCES registry_intakes(intake_id),
  current_version TEXT        NOT NULL DEFAULT '0.1.0',
  trust_band      TEXT        NOT NULL DEFAULT 'L1_EXPERIMENTAL',
  -- L1_EXPERIMENTAL | L2_VERIFIED_COMMUNITY | L3_PRODUCTION_CANDIDATE | L4_PRODUCTION_APPROVED | L5_CORE_SOVEREIGN
  publication_status TEXT     NOT NULL DEFAULT 'draft',
  -- draft | validating | review_pending | published | deprecated | rejected
  policy_class    TEXT        NOT NULL DEFAULT 'read_only',
  -- read_only | network_limited | sandbox_exec | browser_operator | secret_bound | human_approval_required
  wrapper_strategy TEXT       NOT NULL DEFAULT 'http',
  -- http | cli_container | mcp | browser | skill | workflow
  interface_schema JSONB      NOT NULL DEFAULT '{}',  -- input/output manifest
  capabilities    JSONB       NOT NULL DEFAULT '[]',   -- list of capability descriptors
  tags            JSONB       NOT NULL DEFAULT '[]',
  metadata        JSONB       NOT NULL DEFAULT '{}',
  created_by      TEXT        NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_registry_assets_tenant      ON registry_assets(tenant_id);
CREATE INDEX IF NOT EXISTS idx_registry_assets_class       ON registry_assets(asset_class);
CREATE INDEX IF NOT EXISTS idx_registry_assets_trust_band  ON registry_assets(trust_band);
CREATE INDEX IF NOT EXISTS idx_registry_assets_pub_status  ON registry_assets(publication_status);
CREATE INDEX IF NOT EXISTS idx_registry_assets_slug        ON registry_assets(slug);

-- ─────────────────────────────────────────────────────────────────────────────
-- registry_asset_versions
-- Immutable version snapshots. Current version is denormalised on asset row.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS registry_asset_versions (
  version_id      TEXT        PRIMARY KEY,
  asset_id        TEXT        NOT NULL REFERENCES registry_assets(asset_id) ON DELETE CASCADE,
  version         TEXT        NOT NULL,
  changelog       TEXT,
  interface_schema JSONB      NOT NULL DEFAULT '{}',
  wrapper_config  JSONB       NOT NULL DEFAULT '{}',
  content_hash    TEXT,
  is_current      BOOLEAN     NOT NULL DEFAULT false,
  deprecated_at   TIMESTAMPTZ,
  deprecated_by   TEXT,
  created_by      TEXT        NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_registry_asset_versions_unique
  ON registry_asset_versions(asset_id, version);
CREATE INDEX IF NOT EXISTS idx_registry_asset_versions_asset
  ON registry_asset_versions(asset_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- registry_policies
-- PolicyQube: governs how an asset may be invoked.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS registry_policies (
  policy_id       TEXT        PRIMARY KEY,
  asset_id        TEXT        NOT NULL REFERENCES registry_assets(asset_id) ON DELETE CASCADE,
  policy_class    TEXT        NOT NULL,
  -- read_only | network_limited | sandbox_exec | browser_operator | secret_bound | human_approval_required
  allowed_hosts   JSONB       NOT NULL DEFAULT '[]',    -- for network_limited
  allowed_paths   JSONB       NOT NULL DEFAULT '[]',    -- for sandbox_exec
  secret_refs     JSONB       NOT NULL DEFAULT '[]',    -- for secret_bound (ref names only, no values)
  requires_human_approval BOOLEAN NOT NULL DEFAULT false,
  approval_timeout_s INTEGER  NOT NULL DEFAULT 300,
  max_exec_seconds INTEGER    NOT NULL DEFAULT 30,
  max_output_bytes BIGINT     NOT NULL DEFAULT 1048576, -- 1 MB default
  custom_rules    JSONB       NOT NULL DEFAULT '{}',
  created_by      TEXT        NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_registry_policies_asset ON registry_policies(asset_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- registry_validations
-- ValidationQube header: one row per validation run triggered for an asset.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS registry_validations (
  validation_id   TEXT        PRIMARY KEY,
  asset_id        TEXT        NOT NULL REFERENCES registry_assets(asset_id) ON DELETE CASCADE,
  version_id      TEXT        REFERENCES registry_asset_versions(version_id),
  triggered_by    TEXT        NOT NULL,  -- personaId or 'system'
  status          TEXT        NOT NULL DEFAULT 'started',
  -- started | running | completed | failed
  stages_completed JSONB      NOT NULL DEFAULT '[]',
  -- [ { stage, status, completedAt, result } ]
  overall_result  TEXT,        -- pass | fail | warn
  trust_band_cap  TEXT,        -- ceiling imposed by this validation run
  summary         TEXT,
  started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_registry_validations_asset ON registry_validations(asset_id);
CREATE INDEX IF NOT EXISTS idx_registry_validations_status ON registry_validations(status);

-- ─────────────────────────────────────────────────────────────────────────────
-- registry_validation_artifacts
-- Immutable evidence produced by each validation stage.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS registry_validation_artifacts (
  artifact_id     TEXT        PRIMARY KEY,
  validation_id   TEXT        NOT NULL REFERENCES registry_validations(validation_id) ON DELETE CASCADE,
  stage           TEXT        NOT NULL,
  -- license_check | dependency_inventory | secret_scan | sandbox_smoke | interface_conformance | reproducibility
  artifact_type   TEXT        NOT NULL,  -- report | log | hash | manifest
  content         JSONB       NOT NULL DEFAULT '{}',
  content_hash    TEXT,        -- SHA-256 of content
  passed          BOOLEAN,
  cap_trust_band  TEXT,        -- trust ceiling this artifact imposes (if any)
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_registry_val_artifacts_validation
  ON registry_validation_artifacts(validation_id);
CREATE INDEX IF NOT EXISTS idx_registry_val_artifacts_stage
  ON registry_validation_artifacts(stage);

-- ─────────────────────────────────────────────────────────────────────────────
-- registry_trust_scores
-- Computed trust score with factor breakdown. Append-only — one row per scoring.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS registry_trust_scores (
  score_id        TEXT        PRIMARY KEY,
  asset_id        TEXT        NOT NULL REFERENCES registry_assets(asset_id) ON DELETE CASCADE,
  validation_id   TEXT        REFERENCES registry_validations(validation_id),
  trust_band      TEXT        NOT NULL,
  -- L1_EXPERIMENTAL | L2_VERIFIED_COMMUNITY | L3_PRODUCTION_CANDIDATE | L4_PRODUCTION_APPROVED | L5_CORE_SOVEREIGN
  numeric_score   NUMERIC(5,2) NOT NULL,  -- 0.00 – 100.00
  factors         JSONB       NOT NULL DEFAULT '{}',
  -- { provenance_quality, license_clarity, maintenance_posture, dependency_risk,
  --   privilege_footprint, validation_pass_quality, reproducibility, wrapper_isolation_quality }
  explanation     TEXT,
  computed_by     TEXT        NOT NULL DEFAULT 'system',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_registry_trust_scores_asset ON registry_trust_scores(asset_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- registry_publications
-- PublicationQube: tracks each publish action and its state.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS registry_publications (
  publication_id  TEXT        PRIMARY KEY,
  asset_id        TEXT        NOT NULL REFERENCES registry_assets(asset_id) ON DELETE CASCADE,
  version_id      TEXT        REFERENCES registry_asset_versions(version_id),
  validation_id   TEXT        REFERENCES registry_validations(validation_id),
  score_id        TEXT        REFERENCES registry_trust_scores(score_id),
  trust_band      TEXT        NOT NULL,
  policy_class    TEXT        NOT NULL,
  published_by    TEXT        NOT NULL,
  published_at    TIMESTAMPTZ,
  revoked_at      TIMESTAMPTZ,
  revoked_by      TEXT,
  revoke_reason   TEXT,
  status          TEXT        NOT NULL DEFAULT 'pending',
  -- pending | published | revoked
  receipt_id      TEXT,        -- set after receipt emission
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_registry_publications_asset   ON registry_publications(asset_id);
CREATE INDEX IF NOT EXISTS idx_registry_publications_status  ON registry_publications(status);

-- ─────────────────────────────────────────────────────────────────────────────
-- registry_invocations
-- Each governed invocation of a published asset via the InvocationGateway.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS registry_invocations (
  invocation_id   TEXT        PRIMARY KEY,
  asset_id        TEXT        NOT NULL REFERENCES registry_assets(asset_id),
  version_id      TEXT        REFERENCES registry_asset_versions(version_id),
  invoked_by      TEXT        NOT NULL,  -- personaId
  tenant_id       TEXT        NOT NULL,
  wrapper_strategy TEXT       NOT NULL,
  policy_class    TEXT        NOT NULL,
  input_hash      TEXT,        -- SHA-256 of input payload (not stored raw)
  output_hash     TEXT,        -- SHA-256 of output (not stored raw)
  status          TEXT        NOT NULL DEFAULT 'pending',
  -- pending | running | completed | failed | blocked_policy | blocked_approval
  duration_ms     INTEGER,
  error_message   TEXT,
  receipt_id      TEXT,
  invoked_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_registry_invocations_asset   ON registry_invocations(asset_id);
CREATE INDEX IF NOT EXISTS idx_registry_invocations_invoker ON registry_invocations(invoked_by);
CREATE INDEX IF NOT EXISTS idx_registry_invocations_tenant  ON registry_invocations(tenant_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- registry_receipts
-- ReceiptQube: DVN-style append-only audit trail for all factory events.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS registry_receipts (
  receipt_id      TEXT        PRIMARY KEY,
  asset_id        TEXT        REFERENCES registry_assets(asset_id),
  intake_id       TEXT        REFERENCES registry_intakes(intake_id),
  invocation_id   TEXT        REFERENCES registry_invocations(invocation_id),
  event_type      TEXT        NOT NULL,
  -- intake.created | source.fetched | source.classified | asset.packaged
  -- validation.started | validation.completed | trust.assigned
  -- review.approved | review.rejected | asset.published
  -- asset.invoked | asset.version.deprecated
  actor_id        TEXT        NOT NULL,  -- personaId or 'system'
  tenant_id       TEXT        NOT NULL,
  payload         JSONB       NOT NULL DEFAULT '{}',
  content_hash    TEXT,        -- SHA-256 of payload
  dvn_message_id  TEXT,        -- set if submitted to DVN
  dvn_submitted_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_registry_receipts_asset      ON registry_receipts(asset_id);
CREATE INDEX IF NOT EXISTS idx_registry_receipts_intake     ON registry_receipts(intake_id);
CREATE INDEX IF NOT EXISTS idx_registry_receipts_event_type ON registry_receipts(event_type);
CREATE INDEX IF NOT EXISTS idx_registry_receipts_tenant     ON registry_receipts(tenant_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- registry_tags
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS registry_tags (
  tag_id          TEXT        PRIMARY KEY,
  name            TEXT        NOT NULL UNIQUE,
  category        TEXT,        -- capability | domain | integration | workflow | platform
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- registry_asset_tags
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS registry_asset_tags (
  asset_id        TEXT        NOT NULL REFERENCES registry_assets(asset_id) ON DELETE CASCADE,
  tag_id          TEXT        NOT NULL REFERENCES registry_tags(tag_id) ON DELETE CASCADE,
  PRIMARY KEY (asset_id, tag_id)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- registry_dependencies
-- Declared or detected dependencies between assets or external packages.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS registry_dependencies (
  dep_id          TEXT        PRIMARY KEY,
  asset_id        TEXT        NOT NULL REFERENCES registry_assets(asset_id) ON DELETE CASCADE,
  dep_type        TEXT        NOT NULL,  -- asset | npm | python | system | mcp
  dep_ref         TEXT        NOT NULL,  -- asset_id or package name
  version_constraint TEXT,
  risk_level      TEXT,        -- none | low | medium | high | critical
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_registry_dependencies_asset ON registry_dependencies(asset_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- registry_reviews
-- Human or agent review records for promotion through trust bands.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS registry_reviews (
  review_id       TEXT        PRIMARY KEY,
  asset_id        TEXT        NOT NULL REFERENCES registry_assets(asset_id) ON DELETE CASCADE,
  validation_id   TEXT        REFERENCES registry_validations(validation_id),
  reviewer_id     TEXT        NOT NULL,  -- personaId
  reviewer_type   TEXT        NOT NULL DEFAULT 'human',  -- human | agent
  decision        TEXT,        -- approved | rejected | deferred
  requested_trust_band TEXT,   -- the band being reviewed for
  notes           TEXT,
  evidence_refs   JSONB       NOT NULL DEFAULT '[]',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  decided_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_registry_reviews_asset   ON registry_reviews(asset_id);
CREATE INDEX IF NOT EXISTS idx_registry_reviews_decision ON registry_reviews(decision);
