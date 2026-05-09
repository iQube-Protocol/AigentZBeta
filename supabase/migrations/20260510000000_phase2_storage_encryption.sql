-- Phase 2 — Storage encryption parity
--
-- Adds the columns the spine's Phase 1 builder already reads as nullable,
-- plus the disambiguation columns called for in plan §Phase 2.1.
--
-- See:
--   codexes/packs/agentiq/updates/2026-05-05_unified-identity-content-access-foundation-plan.md §Phase 2
--   codexes/packs/agentiq/updates/2026-05-04_wip-vs-canonical-iqube-mint-plan.md
--
-- Schema additions (idempotent — safe to re-run):
--   master_content_qubes
--     wip_storage_url        — Supabase WIP path; mutable; nullable
--     mint_status            — 'wip' | 'minted' (text; existing rows may have other values)
--     content_state          — 'A' | 'B' | 'C' | 'D' | 'E' (matches plan §types)
--     encryption_iv          — 12-byte AES-256-GCM IV (bytea)
--     encryption_auth_tag    — 16-byte GCM auth tag (bytea)
--     encryption_key_id      — version pointer for HKDF derivation (e.g. 'v1')
--
--   codex_media_assets
--     same encryption columns + content_state. mint_status already exists.
--
-- Backfill rule (plan §Phase 2.1):
--   auto_drive_cid LIKE 'http%'  → state 'C', wip_storage_url = auto_drive_cid, mint_status = 'wip'
--   real Auto-Drive CID (no http prefix) → state 'D', wip_storage_url = NULL, mint_status = 'minted'
--   gating_kind='free' AND no encryption_iv (post-migration) → state 'A'
--   gating_kind='free' AND encryption_iv set → state 'B'
--
-- The 'C' rows are the leak surface this phase closes — those Supabase URLs
-- are currently being handed to the browser unencrypted. Phase 2.3 onwards
-- encrypts them at rest; Phase 2.4 adds the decrypt-supabase proxy.

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────
-- master_content_qubes
-- ─────────────────────────────────────────────────────────────────────────

ALTER TABLE master_content_qubes
  ADD COLUMN IF NOT EXISTS wip_storage_url     text,
  ADD COLUMN IF NOT EXISTS content_state       text,
  ADD COLUMN IF NOT EXISTS encryption_iv       bytea,
  ADD COLUMN IF NOT EXISTS encryption_auth_tag bytea,
  ADD COLUMN IF NOT EXISTS encryption_key_id   text;

-- mint_status enum-narrow check, additive only (don't break existing values)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'master_content_qubes' AND column_name = 'mint_status'
  ) THEN
    ALTER TABLE master_content_qubes ADD COLUMN mint_status text NOT NULL DEFAULT 'wip';
  END IF;
END $$;

-- content_state CHECK constraint — only enforce on values we set; NULL allowed.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'master_content_qubes_state_check'
  ) THEN
    ALTER TABLE master_content_qubes
      ADD CONSTRAINT master_content_qubes_state_check
      CHECK (content_state IS NULL OR content_state IN ('A','B','C','D','E'));
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────
-- codex_media_assets
-- ─────────────────────────────────────────────────────────────────────────

ALTER TABLE codex_media_assets
  ADD COLUMN IF NOT EXISTS wip_storage_url     text,
  ADD COLUMN IF NOT EXISTS content_state       text,
  ADD COLUMN IF NOT EXISTS encryption_iv       bytea,
  ADD COLUMN IF NOT EXISTS encryption_auth_tag bytea,
  ADD COLUMN IF NOT EXISTS encryption_key_id   text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'codex_media_assets' AND column_name = 'mint_status'
  ) THEN
    ALTER TABLE codex_media_assets ADD COLUMN mint_status text NOT NULL DEFAULT 'wip';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'codex_media_assets_state_check'
  ) THEN
    ALTER TABLE codex_media_assets
      ADD CONSTRAINT codex_media_assets_state_check
      CHECK (content_state IS NULL OR content_state IN ('A','B','C','D','E'));
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────
-- Backfill — derive content_state + wip_storage_url from auto_drive_cid
-- shape. Idempotent: only updates rows where content_state IS NULL.
-- ─────────────────────────────────────────────────────────────────────────

UPDATE master_content_qubes
SET
  content_state   = 'C',
  wip_storage_url = auto_drive_cid,
  mint_status     = COALESCE(mint_status, 'wip')
WHERE content_state IS NULL
  AND auto_drive_cid IS NOT NULL
  AND auto_drive_cid LIKE 'http%';

UPDATE master_content_qubes
SET
  content_state = 'D',
  mint_status   = 'minted'
WHERE content_state IS NULL
  AND auto_drive_cid IS NOT NULL
  AND auto_drive_cid NOT LIKE 'http%';

-- Free-state (A/B) backfill skipped: gating_kind column does not exist on
-- master_content_qubes / codex_media_assets in production. The spine
-- already derives A vs B at read time from encryption_iv presence
-- (services/content/getContentDescriptor.ts), so no DB backfill is needed.
-- If gating_kind lands later as a column, an additive backfill can run
-- then to fill in A/B explicitly.

UPDATE codex_media_assets
SET
  content_state   = 'C',
  wip_storage_url = auto_drive_cid,
  mint_status     = COALESCE(mint_status, 'wip')
WHERE content_state IS NULL
  AND auto_drive_cid IS NOT NULL
  AND auto_drive_cid LIKE 'http%';

UPDATE codex_media_assets
SET
  content_state = 'D',
  mint_status   = 'minted'
WHERE content_state IS NULL
  AND auto_drive_cid IS NOT NULL
  AND auto_drive_cid NOT LIKE 'http%';

-- ─────────────────────────────────────────────────────────────────────────
-- Index for state-aware proxy branching (Phase 2.4) — content_state is
-- queried on every gated read to pick the right delivery mode.
-- ─────────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_master_content_qubes_state
  ON master_content_qubes (content_state)
  WHERE content_state IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_codex_media_assets_state
  ON codex_media_assets (content_state)
  WHERE content_state IS NOT NULL;

COMMIT;
