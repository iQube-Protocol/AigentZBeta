-- ============================================================================
-- ContentQube Phase 2 — Net-new tables for iQube Protocol content registry
--
-- Makes ContentQubes the authoritative object model for content. Existing
-- master_content_qubes + codex_media_assets rows are bridged via FK columns
-- (master_qube_id / media_asset_id) and will be fully superseded by the
-- registry VIEW in Phase 3.
--
-- New tables (all additive — no existing tables modified here):
--   content_qubes               — unified content object (MetaQube slice)
--   content_qube_storage        — storage references per content_qube
--   content_qube_access_policies— per-content access policy
--   content_qube_relationships  — prev/next, related, bundle edges
--   content_qube_cartridge_bindings — cartridge/tab surface bindings
--   content_qube_editions       — rarity-tiered edition ledger (1,860/collection)
--   content_qube_versions       — version history snapshots
--   content_qube_dvn_receipts   — DVN receipt anchors
--
-- Rarity distribution per collection (KNYT pilot: 1,860 total):
--   legendary          18   (1%)
--   epic              186  (10%)
--   rare            1,654  (89%)
--   secret_black_rare   2  (<1%)
--
-- Privacy contract (CLAUDE.md identity-spine rules):
--   persona_id fields in content_qube_editions + content_qube_versions are
--   T0 — server-internal only. Never returned in browser-bound JSON responses.
--   Only the ContentQube Resolver (services/content/resolveContentQube.ts)
--   may read them; it emits a redacted DisplayManifest to the browser.
--
-- Phase roadmap:
--   Phase 3 — registry VIEW + /api/registry/content-qube/[id]
--   Phase 4 — buildDisplayManifest + resolveContentQube thin wrapper
--   Phase 5 — DVN receipt emitter extension
--   Phase 6 — KNYT pilot bind + emit creation receipts
--   Phase 7 — Editions ledger seeding
--   Phase 7B — Base TokenQube minting (ERC-1155 editions, ERC-721 masters)
--   Phase 8 — Cartridge surface migration to Resolver
-- ============================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────
-- 1. content_qubes — unified content object (MetaQube slice)
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.content_qubes (
  id                  uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  series              text        NOT NULL,

  -- What kind of content and in what format
  content_kind        text        NOT NULL
    CHECK (content_kind IN (
      'episode', 'character', 'gn', 'lore_scroll', 'powers_sheet', 'bundle', 'other'
    )),
  content_type        text        NOT NULL,

  -- Canonical display number (0-indexed for episodes; 0..12 convention).
  -- NULL for bundles and content without a sequence position.
  display_number      integer,

  title               text,
  description         text,

  lifecycle_state     text        NOT NULL DEFAULT 'draft'
    CHECK (lifecycle_state IN (
      'draft', 'semi_minted', 'review_ready', 'canon_pending',
      'canonized', 'chain_minted', 'superseded', 'archived'
    )),

  -- Bridge FKs to existing tables (nullable — set during Phase 6 pilot).
  -- master_qube_id   → master_content_qubes.id (episodes + GN)
  -- media_asset_id   → codex_media_assets.id   (characters)
  -- Both are opaque internal IDs; do not use for math or display logic.
  master_qube_id      text,
  media_asset_id      text,

  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_content_qubes_series       ON public.content_qubes (series);
CREATE INDEX IF NOT EXISTS idx_content_qubes_kind_series  ON public.content_qubes (content_kind, series);
CREATE INDEX IF NOT EXISTS idx_content_qubes_lifecycle    ON public.content_qubes (lifecycle_state);
CREATE INDEX IF NOT EXISTS idx_content_qubes_master       ON public.content_qubes (master_qube_id) WHERE master_qube_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_content_qubes_media        ON public.content_qubes (media_asset_id) WHERE media_asset_id IS NOT NULL;

ALTER TABLE public.content_qubes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "content_qubes_read_service"  ON public.content_qubes FOR SELECT USING (auth.role() = 'service_role');
CREATE POLICY "content_qubes_write_service" ON public.content_qubes FOR ALL    USING (auth.role() = 'service_role');

CREATE TRIGGER content_qubes_updated_at
  BEFORE UPDATE ON public.content_qubes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ─────────────────────────────────────────────────────────────────────────
-- 2. content_qube_storage — storage references per content_qube
--
-- Multiple storage rows may exist for a single qube (e.g. Supabase WIP URL
-- + AutoDrive CID once minted). is_primary marks the canonical delivery path.
-- content_state mirrors the Phase 2 encryption convention:
--   A = free, unencrypted   B = free, encrypted
--   C = gated, wip-url      D = gated, auto-drive CID
--   E = gated, chain-minted
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.content_qube_storage (
  id                  uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  content_qube_id     uuid        NOT NULL REFERENCES public.content_qubes (id) ON DELETE CASCADE,

  storage_kind        text        NOT NULL
    CHECK (storage_kind IN ('supabase', 'auto_drive', 'ipfs', 'arweave')),
  storage_url         text        NOT NULL,
  mime_type           text,
  file_size_bytes     bigint,
  is_primary          boolean     NOT NULL DEFAULT false,

  -- Encryption state (mirrors master_content_qubes encryption columns)
  content_state       text
    CHECK (content_state IS NULL OR content_state IN ('A','B','C','D','E')),
  encryption_iv       bytea,
  encryption_auth_tag bytea,
  encryption_key_id   text,

  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cq_storage_qube    ON public.content_qube_storage (content_qube_id);
CREATE INDEX IF NOT EXISTS idx_cq_storage_primary ON public.content_qube_storage (content_qube_id, is_primary);
CREATE INDEX IF NOT EXISTS idx_cq_storage_state   ON public.content_qube_storage (content_state) WHERE content_state IS NOT NULL;

ALTER TABLE public.content_qube_storage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cq_storage_read_service"  ON public.content_qube_storage FOR SELECT USING (auth.role() = 'service_role');
CREATE POLICY "cq_storage_write_service" ON public.content_qube_storage FOR ALL    USING (auth.role() = 'service_role');

-- ─────────────────────────────────────────────────────────────────────────
-- 3. content_qube_access_policies — per-content access policy
--
-- Each content_qube has at most one policy row. Routes read this to decide
-- "is this gated and by what rule?" via evaluateAccess().
-- price_qc is stored as integer Q¢ cents ($1 = 100 Q¢).
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.content_qube_access_policies (
  id                  uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  content_qube_id     uuid        NOT NULL UNIQUE REFERENCES public.content_qubes (id) ON DELETE CASCADE,

  gating_kind         text        NOT NULL DEFAULT 'free'
    CHECK (gating_kind IN ('free', 'owned', 'subscription', 'sku_required')),

  -- SKU IDs that grant access (e.g. 'top-knyt-investor')
  required_sku        text[]      NOT NULL DEFAULT '{}',

  -- Price in Q¢ (integer cents). NULL = not for direct purchase.
  price_qc            integer     CHECK (price_qc IS NULL OR price_qc >= 0),

  min_identity_level  text
    CHECK (min_identity_level IS NULL OR min_identity_level IN (
      'anonymous', 'semi_anonymous', 'semi_identifiable', 'identifiable'
    )),

  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cq_policy_qube ON public.content_qube_access_policies (content_qube_id);

ALTER TABLE public.content_qube_access_policies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cq_policy_read_service"  ON public.content_qube_access_policies FOR SELECT USING (auth.role() = 'service_role');
CREATE POLICY "cq_policy_write_service" ON public.content_qube_access_policies FOR ALL    USING (auth.role() = 'service_role');

CREATE TRIGGER cq_policy_updated_at
  BEFORE UPDATE ON public.content_qube_access_policies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ─────────────────────────────────────────────────────────────────────────
-- 4. content_qube_relationships — directed edges between content_qubes
--
-- Covers: linear episode sequence (prev/next), related content, branching
-- narrative, and bundle membership. relationship_meta carries type-specific
-- payload (e.g. { position: 1 } for bundle_member).
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.content_qube_relationships (
  id                  uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  source_qube_id      uuid        NOT NULL REFERENCES public.content_qubes (id) ON DELETE CASCADE,
  target_qube_id      uuid        NOT NULL REFERENCES public.content_qubes (id) ON DELETE CASCADE,

  relationship_type   text        NOT NULL
    CHECK (relationship_type IN (
      'sequence_prev', 'sequence_next', 'related', 'branch', 'bundle_member'
    )),

  relationship_meta   jsonb,

  created_at          timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT cq_rel_no_self_loop CHECK (source_qube_id <> target_qube_id),
  CONSTRAINT cq_rel_unique       UNIQUE (source_qube_id, target_qube_id, relationship_type)
);

CREATE INDEX IF NOT EXISTS idx_cq_rel_source ON public.content_qube_relationships (source_qube_id);
CREATE INDEX IF NOT EXISTS idx_cq_rel_target ON public.content_qube_relationships (target_qube_id);
CREATE INDEX IF NOT EXISTS idx_cq_rel_type   ON public.content_qube_relationships (relationship_type);

ALTER TABLE public.content_qube_relationships ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cq_rel_read_service"  ON public.content_qube_relationships FOR SELECT USING (auth.role() = 'service_role');
CREATE POLICY "cq_rel_write_service" ON public.content_qube_relationships FOR ALL    USING (auth.role() = 'service_role');

-- ─────────────────────────────────────────────────────────────────────────
-- 5. content_qube_cartridge_bindings — surface bindings to codex/tab
--
-- Binds a content_qube to a cartridge surface for display. A single qube may
-- appear in multiple cartridges (e.g. KNYT episodes tab + Qriptopian tab).
-- display_order controls sort within a tab; context_meta carries surface-
-- specific hints (e.g. { featured: true, hero: false }).
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.content_qube_cartridge_bindings (
  id                  uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  content_qube_id     uuid        NOT NULL REFERENCES public.content_qubes (id) ON DELETE CASCADE,

  codex_slug          text        NOT NULL,
  tab_slug            text,
  display_order       integer,
  context_meta        jsonb,

  created_at          timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT cq_binding_unique UNIQUE (content_qube_id, codex_slug, tab_slug)
);

CREATE INDEX IF NOT EXISTS idx_cq_binding_qube   ON public.content_qube_cartridge_bindings (content_qube_id);
CREATE INDEX IF NOT EXISTS idx_cq_binding_codex  ON public.content_qube_cartridge_bindings (codex_slug);
CREATE INDEX IF NOT EXISTS idx_cq_binding_tab    ON public.content_qube_cartridge_bindings (codex_slug, tab_slug);

ALTER TABLE public.content_qube_cartridge_bindings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cq_binding_read_service"  ON public.content_qube_cartridge_bindings FOR SELECT USING (auth.role() = 'service_role');
CREATE POLICY "cq_binding_write_service" ON public.content_qube_cartridge_bindings FOR ALL    USING (auth.role() = 'service_role');

-- ─────────────────────────────────────────────────────────────────────────
-- 6. content_qube_editions — rarity-tiered edition ledger
--
-- 1,860 editions per collection (KNYT pilot):
--   legendary         18   (1%)
--   epic             186  (10%)
--   rare           1,654  (89%)
--   secret_black_rare  2  (<1%)
--
-- persona_id is T0 — server-internal only. Never returned to the browser.
-- base_token_id + chain_tx_hash are set by Phase 7B TokenQube mint service.
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.content_qube_editions (
  id                  uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  content_qube_id     uuid        NOT NULL REFERENCES public.content_qubes (id) ON DELETE CASCADE,

  edition_number      integer     NOT NULL CHECK (edition_number >= 1),
  rarity              text        NOT NULL
    CHECK (rarity IN ('legendary', 'epic', 'rare', 'secret_black_rare')),

  -- T0 — server-internal only. Who holds this edition (NULL = unissued).
  persona_id          text,

  issued_at           timestamptz,

  -- Base blockchain fields (Phase 7B). ERC-1155 token ID on Base mainnet.
  base_token_id       text,
  chain_tx_hash       text,
  chain_minted_at     timestamptz,

  created_at          timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT cq_edition_unique UNIQUE (content_qube_id, edition_number)
);

CREATE INDEX IF NOT EXISTS idx_cq_edition_qube    ON public.content_qube_editions (content_qube_id);
CREATE INDEX IF NOT EXISTS idx_cq_edition_rarity  ON public.content_qube_editions (content_qube_id, rarity);
CREATE INDEX IF NOT EXISTS idx_cq_edition_persona ON public.content_qube_editions (persona_id) WHERE persona_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cq_edition_issued  ON public.content_qube_editions (issued_at) WHERE issued_at IS NOT NULL;

ALTER TABLE public.content_qube_editions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cq_edition_read_service"  ON public.content_qube_editions FOR SELECT USING (auth.role() = 'service_role');
CREATE POLICY "cq_edition_write_service" ON public.content_qube_editions FOR ALL    USING (auth.role() = 'service_role');

-- ─────────────────────────────────────────────────────────────────────────
-- 7. content_qube_versions — version history
--
-- Snapshot written on each lifecycle transition or significant metadata edit.
-- author_persona_id is T0 — server-internal only.
-- snapshot_meta holds a JSON snapshot of the content_qube row at that point.
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.content_qube_versions (
  id                  uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  content_qube_id     uuid        NOT NULL REFERENCES public.content_qubes (id) ON DELETE CASCADE,

  version             integer     NOT NULL CHECK (version >= 1),
  change_summary      text,
  snapshot_meta       jsonb,

  -- T0 — server-internal only. Which persona made the change.
  author_persona_id   text,

  created_at          timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT cq_version_unique UNIQUE (content_qube_id, version)
);

CREATE INDEX IF NOT EXISTS idx_cq_version_qube   ON public.content_qube_versions (content_qube_id);
CREATE INDEX IF NOT EXISTS idx_cq_version_author ON public.content_qube_versions (author_persona_id) WHERE author_persona_id IS NOT NULL;

ALTER TABLE public.content_qube_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cq_version_read_service"  ON public.content_qube_versions FOR SELECT USING (auth.role() = 'service_role');
CREATE POLICY "cq_version_write_service" ON public.content_qube_versions FOR ALL    USING (auth.role() = 'service_role');

-- ─────────────────────────────────────────────────────────────────────────
-- 8. content_qube_dvn_receipts — DVN receipt anchors
--
-- Every significant state change (creation, access grant, transfer, mint,
-- burn) writes a receipt row. t2_alias_commitment is the only persona
-- identifier allowed here (T2 — public-network safe). persona_id NEVER
-- appears in this table.
-- icp_receipt_id is set once the receipt is anchored to the ICP canister.
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.content_qube_dvn_receipts (
  id                    uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  content_qube_id       uuid        NOT NULL REFERENCES public.content_qubes (id) ON DELETE CASCADE,

  receipt_kind          text        NOT NULL
    CHECK (receipt_kind IN ('creation', 'access', 'transfer', 'mint', 'burn')),

  -- T2 — the only persona handle allowed in receipts. Derived via
  -- hash(personaId + cohortId + salt) per DVN receipt taxonomy.
  t2_alias_commitment   text,

  receipt_payload       jsonb       NOT NULL DEFAULT '{}'::jsonb,
  anchored_at           timestamptz NOT NULL DEFAULT now(),

  -- Set once the receipt is confirmed on the ICP canister (Phase 5+).
  icp_receipt_id        text,

  created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cq_dvn_qube   ON public.content_qube_dvn_receipts (content_qube_id);
CREATE INDEX IF NOT EXISTS idx_cq_dvn_kind   ON public.content_qube_dvn_receipts (receipt_kind);
CREATE INDEX IF NOT EXISTS idx_cq_dvn_t2     ON public.content_qube_dvn_receipts (t2_alias_commitment) WHERE t2_alias_commitment IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cq_dvn_icp    ON public.content_qube_dvn_receipts (icp_receipt_id) WHERE icp_receipt_id IS NOT NULL;

ALTER TABLE public.content_qube_dvn_receipts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cq_dvn_read_service"  ON public.content_qube_dvn_receipts FOR SELECT USING (auth.role() = 'service_role');
CREATE POLICY "cq_dvn_write_service" ON public.content_qube_dvn_receipts FOR ALL    USING (auth.role() = 'service_role');

COMMIT;
