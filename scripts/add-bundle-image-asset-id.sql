-- =============================================================================
-- Make bundle hero images operator-editable per SKU.
--
-- Adds a nullable FK from store_skus → codex_media_assets so the operator
-- can pick which bundle_pack image to display for each bundle SKU directly
-- from the admin UI (StoreSkusPanel). When NULL, the legacy BUNDLE_ID_TO_TIER
-- mapping (bronze/silver/gold) is used as a fallback so existing wiring
-- continues to work without disruption.
--
-- Run once in the Supabase SQL editor.
-- =============================================================================

ALTER TABLE store_skus
  ADD COLUMN IF NOT EXISTS bundle_image_asset_id UUID
    REFERENCES codex_media_assets(id) ON DELETE SET NULL;

COMMENT ON COLUMN store_skus.bundle_image_asset_id IS
  'Optional FK to codex_media_assets — the bundle_pack image used as this SKU''s hero. NULL = fall back to BUNDLE_ID_TO_TIER tier mapping in code.';
