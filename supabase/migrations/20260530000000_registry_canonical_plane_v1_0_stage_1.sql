-- ============================================================================
-- Canonical iQube Registry Operating Plane — Stage 1 schema
--
-- Sources of truth:
--   - PRD v1.0  codexes/packs/agentiq/updates/2026-05-30_prd-canonical-iqube-
--               registry-operating-plane-v1.0.md
--   - PRD v1.1  codexes/packs/agentiq/updates/2026-05-30_prd-canonical-iqube-
--               registry-operating-plane-v1.1-guardrails.md
--   - Audit     codexes/packs/agentiq/updates/2026-05-30_stage-0-audit-report.md
--
-- This migration is purely ADDITIVE. No existing table or column is dropped
-- or renamed. New columns on existing tables are nullable. No application
-- code consumes these new surfaces until Stage 2 lands the canonical
-- resolver. The feature flag REGISTRY_CANONICAL_PLANE_V1_0 (defaulted to
-- false here in registry_config) gates the runtime switch.
--
-- Privacy contract (CLAUDE.md identity-spine rules, enforced here):
--   - persona_id columns are T0 — server-internal only. RLS denies all
--     non-service-role reads on every table that carries persona_id.
--   - No T0 column is exposed via PostgREST to anon/authenticated roles.
--   - All tables get RLS enabled + service-role-only policies.
--
-- Sections:
--   1. iqube_id_map                 — canonical UUID join table
--   2. persona_token_qube_ownership — per-persona iQube ownership ledger
--   3. mint_sagas                   — multi-step mint state machine
--   4. dvn_receipt_blocks           — logical block ledger for DVN receipts
--   5. dvn_receipt_block_items      — per-block receipt membership
--   6. iqube_canonization_requests  — operator approval queue
--   7. registry_config              — runtime config (feature flags, cadences)
--   8. Additive columns             — iqube_id + lifecycle + asset_class split
--   9. Initial seed                 — registry_config defaults
-- ============================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────
-- 1. iqube_id_map — canonical UUID join table
--
-- Every existing source surface (triad / ingestion / content / identity /
-- memory / code-only synthetic) writes a row here mapping its native
-- source_id to a canonical iqube_id UUID. The resolver
-- (services/registry/resolver.ts, Stage 2) dispatches by primitive_type
-- and reads the source row via source + source_id.
--
-- source values (closed set, extensible via this column not by enum):
--   'triad_meta'           → iq_meta_qubes.id
--   'triad_blak'           → iq_blak_qubes.id (rarely needed; resolver uses meta)
--   'triad_token'          → iq_token_qubes.id
--   'content_qube'         → content_qubes.id
--   'registry_asset'       → registry_assets.asset_id
--   'master_content_qube'  → master_content_qubes.id (legacy, bridged)
--   'codex_media_asset'    → codex_media_assets.id  (legacy, bridged)
--   'identity_iqube'       → personas.identity_iqube_id (or equivalent)
--   'memory_iqube'         → memory_iqubes.id
--   'code:aigentQubeSource'  → runtime string id (RUNTIME_AGENT_IDS member)
--   'code:toolQubeSource'    → runtime string id (openclawCore tool_id)
--   'code:liquidui-template' → 20 LiquidUI seeds (Stage 1 C1 reclassification)
--
-- synthetic = true marks iqube_ids derived deterministically (SHA-256 of
-- source + source_id) for code-only sources without DB rows. Real DB-
-- backed sources have synthetic = false.
--
-- legacy_primitive_type carries the pre-reclassification IQubeType value
-- for one-rev rollback safety (per v1.1 §A.2). Currently only used for the
-- 20 LiquidUI seeds reclassified from 'LiquidUITemplateArchetypeQube' to
-- 'DataQube'.
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.iqube_id_map (
  iqube_id              uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  source                text        NOT NULL,
  source_id             text        NOT NULL,
  primitive_type        text        NOT NULL
    CHECK (primitive_type IN ('DataQube','ContentQube','ToolQube','ModelQube','AigentQube','ClusterQube')),
  legacy_primitive_type text,
  synthetic             boolean     NOT NULL DEFAULT false,
  notes                 text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT iqube_id_map_source_unique UNIQUE (source, source_id)
);

CREATE INDEX IF NOT EXISTS idx_iqube_id_map_source        ON public.iqube_id_map(source);
CREATE INDEX IF NOT EXISTS idx_iqube_id_map_primitive     ON public.iqube_id_map(primitive_type);
CREATE INDEX IF NOT EXISTS idx_iqube_id_map_legacy_type   ON public.iqube_id_map(legacy_primitive_type) WHERE legacy_primitive_type IS NOT NULL;

COMMENT ON TABLE  public.iqube_id_map IS 'Canonical iqube_id UUID join table; every source surface writes one row per record. PRD v1.0 §5 / v1.1 §A.2.';
COMMENT ON COLUMN public.iqube_id_map.synthetic IS 'true = iqube_id was deterministically derived from source+source_id (code-only sources without DB rows)';
COMMENT ON COLUMN public.iqube_id_map.legacy_primitive_type IS 'Pre-reclassification IQubeType value, for one-rev rollback (v1.1 §A.2)';

ALTER TABLE public.iqube_id_map ENABLE ROW LEVEL SECURITY;
CREATE POLICY "iqube_id_map_read_service"  ON public.iqube_id_map FOR SELECT USING (auth.role() = 'service_role');
CREATE POLICY "iqube_id_map_write_service" ON public.iqube_id_map FOR ALL    USING (auth.role() = 'service_role');

-- ─────────────────────────────────────────────────────────────────────────
-- 2. persona_token_qube_ownership — per-persona iQube ownership ledger
--
-- Read substrate for services/rewards/assetOwnership.ts::userOwnsAsset()
-- (v1.1 §A.3). Callers consult userOwnsAsset; this table is never queried
-- directly from registry-path code (CI grep gate enforced in Stage 2.5).
--
-- One row per (token_qube_id, persona_id) ownership transition. Active
-- ownership = relinquished_at IS NULL. Transfers close the prior row and
-- open a new one.
--
-- persona_id is T0 — never exposed in client-bound JSON.
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.persona_token_qube_ownership (
  ownership_id     uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  persona_id       text        NOT NULL,
  token_qube_id    text        NOT NULL,
  iqube_id         uuid        NOT NULL REFERENCES public.iqube_id_map(iqube_id),
  chain_anchor     jsonb,
  acquired_at      timestamptz NOT NULL DEFAULT now(),
  relinquished_at  timestamptz,
  source           text        NOT NULL CHECK (source IN ('mint','transfer','gift','backfill','revocation')),
  receipt_id       text,

  CONSTRAINT persona_token_qube_acq_unique UNIQUE (token_qube_id, persona_id, acquired_at)
);

CREATE INDEX IF NOT EXISTS idx_pt_qube_persona_active
  ON public.persona_token_qube_ownership(persona_id)
  WHERE relinquished_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_pt_qube_iqube
  ON public.persona_token_qube_ownership(iqube_id);
CREATE INDEX IF NOT EXISTS idx_pt_qube_token
  ON public.persona_token_qube_ownership(token_qube_id);

COMMENT ON TABLE  public.persona_token_qube_ownership IS 'Per-persona iQube ownership history. Read substrate for userOwnsAsset(). PRD v1.1 §A.3. persona_id is T0.';
COMMENT ON COLUMN public.persona_token_qube_ownership.persona_id IS 'T0 — server-internal only. Never returned in client JSON.';

ALTER TABLE public.persona_token_qube_ownership ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pt_qube_read_service"  ON public.persona_token_qube_ownership FOR SELECT USING (auth.role() = 'service_role');
CREATE POLICY "pt_qube_write_service" ON public.persona_token_qube_ownership FOR ALL    USING (auth.role() = 'service_role');

-- ─────────────────────────────────────────────────────────────────────────
-- 3. mint_sagas — multi-step mint state machine
--
-- PRD v1.0 §7 / v1.1 §B.12. State transitions and the saga driver live in
-- services/registry/mintSaga.ts (Stage 5). Background worker reconciles
-- *_pending states every minute.
--
-- current_state values (per v1.0 §7.1, also tracked in idempotency_keys):
--   unminted | registry_draft_created | payload_encrypted | payload_uploaded |
--   token_qube_created | chain_minting | chain_minted | anchor_persisted |
--   receipt_emitting | receipt_emitted | card_publishing | card_published |
--   MINT_COMPLETE | mint_failed | payload_upload_failed | anchor_persist_failed |
--   anchor_pending | receipt_pending | card_publish_pending
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.mint_sagas (
  saga_id           uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  iqube_id          uuid        REFERENCES public.iqube_id_map(iqube_id),
  current_state     text        NOT NULL DEFAULT 'unminted',
  last_error        text,
  retry_count       integer     NOT NULL DEFAULT 0,
  idempotency_keys  jsonb       NOT NULL DEFAULT '{}'::jsonb,
  initiated_by_persona_id text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mint_sagas_iqube   ON public.mint_sagas(iqube_id);
CREATE INDEX IF NOT EXISTS idx_mint_sagas_state   ON public.mint_sagas(current_state);
CREATE INDEX IF NOT EXISTS idx_mint_sagas_pending
  ON public.mint_sagas(current_state)
  WHERE current_state IN ('anchor_pending','receipt_pending','card_publish_pending');

COMMENT ON TABLE  public.mint_sagas IS 'Mint-saga state machine. PRD v1.0 §7. Driver: services/registry/mintSaga.ts (Stage 5).';
COMMENT ON COLUMN public.mint_sagas.initiated_by_persona_id IS 'T0 — server-internal only.';

ALTER TABLE public.mint_sagas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mint_sagas_read_service"  ON public.mint_sagas FOR SELECT USING (auth.role() = 'service_role');
CREATE POLICY "mint_sagas_write_service" ON public.mint_sagas FOR ALL    USING (auth.role() = 'service_role');

-- ─────────────────────────────────────────────────────────────────────────
-- 4. dvn_receipt_blocks — logical block ledger for DVN receipts
--
-- PRD v1.0 §8.2 / v1.1 §B.5 + §B.7. Block model is Phase 1 — does NOT
-- depend on Bitcoin ordinal inscription (that's a later anchoring layer
-- populated into inscription_id when it ships).
--
-- Lifecycle: open → sealed → anchored | failed. Sealer triggers on size
-- (default 1000 items, configurable via registry_config) OR time (default
-- 1 hour, configurable). Per cartridge scope — 'platform' or a cartridge
-- slug.
--
-- Concurrency rules (v1.1 §B.7) enforced here:
--   - Single open block per cartridge_scope: UNIQUE partial index below.
--   - Block-number monotonicity: (cartridge_scope, block_number) UNIQUE.
--   - Append-side advisory lock applied in services/registry/dvnBlocks.ts
--     (Stage 6); see hashtext(cartridge_scope || ':' || block_number).
--   - Leader election for the sealer worker uses Postgres advisory lock
--     keyed 'dvn_block_sealer:' || cartridge_scope (Stage 6).
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.dvn_receipt_blocks (
  block_id           uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  block_number       bigint      NOT NULL,
  cartridge_scope    text        NOT NULL,
  epoch              integer     NOT NULL,
  status             text        NOT NULL DEFAULT 'open'
    CHECK (status IN ('open','sealed','anchored','failed')),
  opened_at          timestamptz NOT NULL DEFAULT now(),
  sealed_at          timestamptz,
  anchored_at        timestamptz,
  receipt_count      integer     NOT NULL DEFAULT 0,
  batch_hash         text,
  merkle_root        text,
  inscription_id     text,
  inscription_chain  text,
  failure_reason     text,

  CONSTRAINT dvn_blocks_scope_number_unique UNIQUE (cartridge_scope, block_number)
);

-- Single open block per cartridge scope. Any attempt to open a second
-- open block fails immediately at the DB layer (v1.1 §B.7).
CREATE UNIQUE INDEX IF NOT EXISTS uq_dvn_blocks_one_open_per_scope
  ON public.dvn_receipt_blocks(cartridge_scope)
  WHERE status = 'open';

CREATE INDEX IF NOT EXISTS idx_dvn_blocks_scope_status ON public.dvn_receipt_blocks(cartridge_scope, status);
CREATE INDEX IF NOT EXISTS idx_dvn_blocks_epoch       ON public.dvn_receipt_blocks(epoch);
CREATE INDEX IF NOT EXISTS idx_dvn_blocks_anchored
  ON public.dvn_receipt_blocks(cartridge_scope, anchored_at)
  WHERE status = 'anchored';

COMMENT ON TABLE  public.dvn_receipt_blocks IS 'Logical block ledger for DVN receipt analysis. PRD v1.0 §8.2 / v1.1 §B.5.';

ALTER TABLE public.dvn_receipt_blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dvn_blocks_read_service"  ON public.dvn_receipt_blocks FOR SELECT USING (auth.role() = 'service_role');
CREATE POLICY "dvn_blocks_write_service" ON public.dvn_receipt_blocks FOR ALL    USING (auth.role() = 'service_role');

-- ─────────────────────────────────────────────────────────────────────────
-- 5. dvn_receipt_block_items — per-block receipt membership
--
-- receipt_source values:
--   'orchestration_events'        — references orchestration_events.event_id
--   'content_qube_dvn_receipts'   — references content_qube_dvn_receipts.id
--
-- item_hash is SHA-256 of the receipt's canonical body (computed by the
-- sealer). batch_hash on the parent block is SHA-256 of sorted item_hash
-- values, ensuring deterministic replay.
--
-- (block_id, receipt_source, receipt_id) is unique → INSERT ON CONFLICT
-- DO NOTHING is safe for retries.
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.dvn_receipt_block_items (
  block_id           uuid        NOT NULL REFERENCES public.dvn_receipt_blocks(block_id) ON DELETE CASCADE,
  receipt_source     text        NOT NULL CHECK (receipt_source IN ('orchestration_events','content_qube_dvn_receipts')),
  receipt_id         text        NOT NULL,
  sequence_in_block  integer     NOT NULL,
  item_hash          text        NOT NULL,
  appended_at        timestamptz NOT NULL DEFAULT now(),

  PRIMARY KEY (block_id, sequence_in_block),
  CONSTRAINT dvn_block_item_unique UNIQUE (block_id, receipt_source, receipt_id)
);

CREATE INDEX IF NOT EXISTS idx_dvn_block_items_receipt
  ON public.dvn_receipt_block_items(receipt_source, receipt_id);

COMMENT ON TABLE public.dvn_receipt_block_items IS 'Per-block DVN receipt membership. Idempotent insert via UNIQUE (block_id, receipt_source, receipt_id). v1.1 §B.7.';

ALTER TABLE public.dvn_receipt_block_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dvn_block_items_read_service"  ON public.dvn_receipt_block_items FOR SELECT USING (auth.role() = 'service_role');
CREATE POLICY "dvn_block_items_write_service" ON public.dvn_receipt_block_items FOR ALL    USING (auth.role() = 'service_role');

-- ─────────────────────────────────────────────────────────────────────────
-- 6. iqube_canonization_requests — operator approval queue
--
-- PRD v1.1 §A.7. UI surfaces in iqube-registry cartridge → admin →
-- 'canonization' tab (Stage 8). Approval triggers the
-- published → canonized lifecycle transition (§6.1) which emits the sync
-- DVN receipt.
--
-- payment_authority_proposed is AigentQube-specific (v1.1 §B.6). For non-
-- AigentQube requests this stays NULL. When non-null on an AigentQube
-- request, the admin tab surfaces a separate confirmation step.
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.iqube_canonization_requests (
  request_id                  uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  iqube_id                    uuid        NOT NULL REFERENCES public.iqube_id_map(iqube_id),
  requester_persona_id        text        NOT NULL,
  requested_at                timestamptz NOT NULL DEFAULT now(),
  status                      text        NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','approved','rejected','withdrawn')),
  decided_by_persona_id       text,
  decided_at                  timestamptz,
  decision_notes              text,
  payment_authority_proposed  jsonb,
  receipt_id                  text
);

CREATE INDEX IF NOT EXISTS idx_canonization_status   ON public.iqube_canonization_requests(status);
CREATE INDEX IF NOT EXISTS idx_canonization_iqube    ON public.iqube_canonization_requests(iqube_id);
CREATE INDEX IF NOT EXISTS idx_canonization_pending
  ON public.iqube_canonization_requests(requested_at)
  WHERE status = 'pending';

COMMENT ON TABLE  public.iqube_canonization_requests IS 'Operator approval queue for iQube canonization. PRD v1.1 §A.7.';
COMMENT ON COLUMN public.iqube_canonization_requests.requester_persona_id IS 'T0 — server-internal only.';
COMMENT ON COLUMN public.iqube_canonization_requests.decided_by_persona_id IS 'T0 — server-internal only.';
COMMENT ON COLUMN public.iqube_canonization_requests.payment_authority_proposed IS 'AigentQube-only (v1.1 §B.6). Non-null requires separate operator confirm.';

ALTER TABLE public.iqube_canonization_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "canonization_read_service"  ON public.iqube_canonization_requests FOR SELECT USING (auth.role() = 'service_role');
CREATE POLICY "canonization_write_service" ON public.iqube_canonization_requests FOR ALL    USING (auth.role() = 'service_role');

-- ─────────────────────────────────────────────────────────────────────────
-- 7. registry_config — runtime configuration
--
-- PRD v1.1 §A.5 + feature flag table. Read at worker start; reloaded on
-- config-change SIGNALS (Stage 6 implements the reload trigger).
--
-- Keys used in Stage 1 seed:
--   feature_flag.REGISTRY_CANONICAL_PLANE_V1_0     (boolean — default false)
--   dvn_block_sealer.<scope>.size_threshold        (integer — default 1000)
--   dvn_block_sealer.<scope>.time_threshold_ms     (integer — default 3_600_000)
--   receipt_writer.dual_write_observation_until    (timestamptz — Stage 6 seed)
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.registry_config (
  config_key                text        PRIMARY KEY,
  config_value              jsonb       NOT NULL,
  cartridge_scope           text,
  description               text,
  updated_by_persona_id     text,
  updated_at                timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_registry_config_scope ON public.registry_config(cartridge_scope) WHERE cartridge_scope IS NOT NULL;

COMMENT ON TABLE public.registry_config IS 'Runtime configuration (feature flags, sealer cadences, etc.). PRD v1.1 §A.5.';
COMMENT ON COLUMN public.registry_config.updated_by_persona_id IS 'T0 — server-internal only.';

ALTER TABLE public.registry_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "registry_config_read_service"  ON public.registry_config FOR SELECT USING (auth.role() = 'service_role');
CREATE POLICY "registry_config_write_service" ON public.registry_config FOR ALL    USING (auth.role() = 'service_role');

-- ─────────────────────────────────────────────────────────────────────────
-- 8. Additive columns on existing tables
--
-- All new columns NULL-allowed. Running application code is unaffected;
-- new columns populate via Stage 2 resolver writes and via the operator-
-- run backfill scripts. No CHECK constraints added in this migration —
-- those land in a follow-up once backfill is complete and verified.
-- ─────────────────────────────────────────────────────────────────────────

-- content_qubes: surface vs internal lifecycle columns (computed-cached
-- by the card builder; raw lifecycle_state remains the source of truth
-- on this table until Stage 3 reconciles the ContentQube-internal
-- enum into the universal internal enum).
ALTER TABLE public.content_qubes
  ADD COLUMN IF NOT EXISTS iqube_id           uuid,
  ADD COLUMN IF NOT EXISTS internal_lifecycle text,
  ADD COLUMN IF NOT EXISTS surface_lifecycle  text;

CREATE INDEX IF NOT EXISTS idx_content_qubes_iqube_id          ON public.content_qubes(iqube_id) WHERE iqube_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_content_qubes_surface_lifecycle ON public.content_qubes(surface_lifecycle) WHERE surface_lifecycle IS NOT NULL;

COMMENT ON COLUMN public.content_qubes.iqube_id IS 'Canonical iqube_id (FK conceptually to iqube_id_map.iqube_id). Backfill: copy id since both are UUIDs. Stage 1 backfill script populates.';
COMMENT ON COLUMN public.content_qubes.internal_lifecycle IS 'Universal internal lifecycle (PRD v1.0 §4.2 — 9 states). Collapsed from ContentQube-internal lifecycle_state. Stage 3 mapping in services/registry/lifecycle.ts.';
COMMENT ON COLUMN public.content_qubes.surface_lifecycle IS 'Surface lifecycle (PRD v1.0 §4.1 / shipped legibility — 5 states). Derived from internal_lifecycle via §4.3 mapping table.';

-- registry_assets: iqube_id + ToolQube subtype split + lifecycle columns
ALTER TABLE public.registry_assets
  ADD COLUMN IF NOT EXISTS iqube_id            uuid,
  ADD COLUMN IF NOT EXISTS primitive_type      text,
  ADD COLUMN IF NOT EXISTS tool_subtype        text,
  ADD COLUMN IF NOT EXISTS wrapper_strategy    text,
  ADD COLUMN IF NOT EXISTS internal_lifecycle  text,
  ADD COLUMN IF NOT EXISTS surface_lifecycle   text;

CREATE INDEX IF NOT EXISTS idx_registry_assets_iqube_id   ON public.registry_assets(iqube_id) WHERE iqube_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_registry_assets_primitive  ON public.registry_assets(primitive_type) WHERE primitive_type IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_registry_assets_subtype    ON public.registry_assets(tool_subtype) WHERE tool_subtype IS NOT NULL;

COMMENT ON COLUMN public.registry_assets.iqube_id IS 'Canonical iqube_id. Stage 1 backfill populates.';
COMMENT ON COLUMN public.registry_assets.primitive_type IS 'Universal primitive (DataQube/ContentQube/ToolQube/ModelQube/AigentQube/ClusterQube). Collapses SkillQube/WorkflowQube/ConnectorQube into ToolQube + tool_subtype per PRD v0.2 §A.1.';
COMMENT ON COLUMN public.registry_assets.tool_subtype IS 'ToolQube subtype: skill | connector | workflow | browser. NULL for non-ToolQube primitives.';
COMMENT ON COLUMN public.registry_assets.wrapper_strategy IS 'Wrapper strategy from ingestion classifier (mcp | skill | workflow | browser). Mirrors tool_subtype for ToolQube records; NULL otherwise.';

-- registry_assets backfill: split asset_class into (primitive_type, tool_subtype)
-- per PRD v0.2 §A.1. This migration touches 23 rows in dev (19 SkillQube +
-- 3 WorkflowQube + 1 ConnectorQube) per Stage 0 audit Deliverable 1.
UPDATE public.registry_assets
SET primitive_type = 'ToolQube',
    tool_subtype = 'skill',
    wrapper_strategy = COALESCE(wrapper_strategy, 'skill')
WHERE asset_class = 'SkillQube' AND primitive_type IS NULL;

UPDATE public.registry_assets
SET primitive_type = 'ToolQube',
    tool_subtype = 'connector',
    wrapper_strategy = COALESCE(wrapper_strategy, 'mcp')
WHERE asset_class = 'ConnectorQube' AND primitive_type IS NULL;

UPDATE public.registry_assets
SET primitive_type = 'ToolQube',
    tool_subtype = 'workflow',
    wrapper_strategy = COALESCE(wrapper_strategy, 'workflow')
WHERE asset_class = 'WorkflowQube' AND primitive_type IS NULL;

UPDATE public.registry_assets
SET primitive_type = 'ToolQube',
    tool_subtype = NULL,
    wrapper_strategy = COALESCE(wrapper_strategy, 'browser')
WHERE asset_class = 'ToolQube' AND primitive_type IS NULL;

UPDATE public.registry_assets
SET primitive_type = 'AigentQube'
WHERE asset_class = 'AigentQube' AND primitive_type IS NULL;

UPDATE public.registry_assets
SET primitive_type = 'DataQube'
WHERE asset_class = 'DataQube' AND primitive_type IS NULL;

-- iq_meta_qubes: add iqube_id column. Backfill copies id (already UUID).
ALTER TABLE public.iq_meta_qubes
  ADD COLUMN IF NOT EXISTS iqube_id uuid;

CREATE INDEX IF NOT EXISTS idx_iq_meta_qubes_iqube_id ON public.iq_meta_qubes(iqube_id) WHERE iqube_id IS NOT NULL;

-- orchestration_events: add iqube_id for v1.0 §8.1 cross-primitive query.
-- Backfill from metadata.asset_id where present is an operator-run script
-- (not in this migration — runs after Stage 2 resolver is wired).
ALTER TABLE public.orchestration_events
  ADD COLUMN IF NOT EXISTS iqube_id text;

CREATE INDEX IF NOT EXISTS idx_orch_events_iqube       ON public.orchestration_events(iqube_id, created_at DESC) WHERE iqube_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orch_events_alias       ON public.orchestration_events(actor_alias_commitment, created_at DESC) WHERE actor_alias_commitment IS NOT NULL;

COMMENT ON COLUMN public.orchestration_events.iqube_id IS 'Canonical iqube_id for cross-primitive receipt queries (PRD v1.0 §8.1). Backfill from metadata.asset_id via operator-run script post-Stage-2.';

-- ─────────────────────────────────────────────────────────────────────────
-- 9. Initial seed — registry_config defaults
--
-- Feature flag defaults to false. Operator flips REGISTRY_CANONICAL_PLANE_V1_0
-- to true once Stage 2 resolver passes integration tests in dev. Block-
-- sealer config seeded with PRD v1.1 §A.5 defaults; per-cartridge
-- overrides go in rows with cartridge_scope set.
-- ─────────────────────────────────────────────────────────────────────────

INSERT INTO public.registry_config (config_key, config_value, description) VALUES
  ('feature_flag.REGISTRY_CANONICAL_PLANE_V1_0', 'false'::jsonb,
   'Master gate for canonical resolver runtime; flip true once Stage 2 lands and passes tests.'),
  ('dvn_block_sealer.default.size_threshold', '1000'::jsonb,
   'Default block sealer size threshold per cartridge scope (v1.1 §A.5).'),
  ('dvn_block_sealer.default.time_threshold_ms', '3600000'::jsonb,
   'Default block sealer time threshold ms per cartridge scope (1 hour).')
ON CONFLICT (config_key) DO NOTHING;

COMMIT;

-- ============================================================================
-- Post-migration operator actions (NOT run in this transaction):
--
-- 1. Backfill iqube_id_map from existing source surfaces. Run the backfill
--    script that Stage 2 produces (services/registry/backfill/runBackfill.ts).
--    The script is idempotent and re-runnable.
--
-- 2. Backfill content_qubes.iqube_id (copy from id since both are UUID):
--      UPDATE content_qubes SET iqube_id = id WHERE iqube_id IS NULL;
--    Then write the corresponding iqube_id_map row for each content_qube.
--
-- 3. Backfill iq_meta_qubes.iqube_id (copy from id):
--      UPDATE iq_meta_qubes SET iqube_id = id WHERE iqube_id IS NULL;
--    Decide disposition of the 4 orphan metas from Stage 0 Finding F
--    before running iqube_id_map writes.
--
-- 4. Backfill orchestration_events.iqube_id from metadata.asset_id where
--    present:
--      UPDATE orchestration_events
--      SET iqube_id = metadata->>'asset_id'
--      WHERE iqube_id IS NULL AND metadata ? 'asset_id';
--
-- 5. Verify the per-surface backfill gate (PRD v1.1 §B.3):
--      SELECT COUNT(*) FROM iq_meta_qubes
--      EXCEPT
--      SELECT COUNT(*) FROM iqube_id_map WHERE source = 'triad_meta';
--    Must return zero rows.
--
-- 6. Flip the feature flag once Stage 2 resolver tests pass:
--      UPDATE registry_config
--      SET config_value = 'true'::jsonb, updated_at = now()
--      WHERE config_key = 'feature_flag.REGISTRY_CANONICAL_PLANE_V1_0';
-- ============================================================================
