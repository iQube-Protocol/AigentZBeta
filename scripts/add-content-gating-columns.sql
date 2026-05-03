-- =============================================================================
-- Stamp gating at the content/data level (belt-and-braces with loader classifier).
--
-- Adds gating_kind + gating_credential to master_content_qubes and
-- codex_media_assets. The classifier reads these columns first; if NULL,
-- falls back to content_type / asset_kind heuristics. The row value is
-- authoritative — an operator can mark a specific row free/credential/payment
-- regardless of its category default.
--
-- Default-free invariant: rows with NULL gating_kind that don't match a
-- known paid or credentialed type stay free. Free content is NEVER
-- mistakenly locked — only known paid/credentialed kinds are stamped.
--
-- Run once in the Supabase SQL editor.
-- =============================================================================

-- ── Columns ─────────────────────────────────────────────────────────────────
ALTER TABLE master_content_qubes
  ADD COLUMN IF NOT EXISTS gating_kind TEXT
    CHECK (gating_kind IS NULL OR gating_kind IN ('free', 'payment', 'credential'));
ALTER TABLE master_content_qubes
  ADD COLUMN IF NOT EXISTS gating_credential TEXT;

ALTER TABLE codex_media_assets
  ADD COLUMN IF NOT EXISTS gating_kind TEXT
    CHECK (gating_kind IS NULL OR gating_kind IN ('free', 'payment', 'credential'));
ALTER TABLE codex_media_assets
  ADD COLUMN IF NOT EXISTS gating_credential TEXT;

COMMENT ON COLUMN master_content_qubes.gating_kind IS
  'Operator-overridable gating kind: free, payment, or credential. NULL = derive from content_type via classifier.';
COMMENT ON COLUMN codex_media_assets.gating_kind IS
  'Operator-overridable gating kind: free, payment, or credential. NULL = derive from asset_kind via classifier.';

-- ── Backfill — paid content ────────────────────────────────────────────────
-- All episode masters (still, motion, print) are payment-gated.
UPDATE master_content_qubes
SET gating_kind = 'payment'
WHERE gating_kind IS NULL
  AND content_type IN ('episode_still', 'episode_motion', 'episode_print');

-- Character posters are payment-gated (sold individually OR via bundle SKU).
UPDATE codex_media_assets
SET gating_kind = 'payment'
WHERE gating_kind IS NULL
  AND asset_kind = 'character_poster';

-- ── Backfill — credential-gated content ────────────────────────────────────
-- Lore documents are admin-credential gated (existing tab adminOnly behaviour).
UPDATE codex_media_assets
SET gating_kind = 'credential', gating_credential = 'admin'
WHERE gating_kind IS NULL
  AND asset_kind IN ('background_lore_doc', 'powers_sheet', 'twenty_one_sats_concept');

-- Cover variants, bundle packs, RaBadges, game stills, social campaign media
-- are NOT backfilled — they remain NULL, which the classifier resolves as
-- 'free' (display / promotional / preview imagery, not the gated payload).

-- ── Verification queries ────────────────────────────────────────────────────
-- Counts after backfill (run separately to inspect):
-- SELECT gating_kind, COUNT(*) FROM master_content_qubes GROUP BY gating_kind;
-- SELECT gating_kind, gating_credential, COUNT(*) FROM codex_media_assets GROUP BY gating_kind, gating_credential;
