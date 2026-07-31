-- ============================================================================
-- Publish-to-myCluster flag on codex_configs
--
-- Adds published_to_cluster BOOLEAN to codex_configs so personal cartridges
-- can appear as dynamic sub-tabs in the owner's myCluster group within the
-- metaMe cartridge.
--
-- When published_to_cluster = true:
--   - The cartridge surfaces as a named tab in the mycluster group strip
--     (e.g. "metaWill" alongside myCanvas / myWorkspace / myCartridge /
--     myLedger).
--   - The tab renders the cartridge's configured tabs via the TAB_TEMPLATES
--     framework using PersonalCartridgeTab.
--   - Only the owner's metaMe view is affected — this does NOT make the
--     cartridge visible to other personas.
--
-- Toggled via POST /api/cartridge/[slug]/publish-to-cluster.
-- Read by GET /api/cartridge/published-for-cluster (owner-only, spine-gated).
--
-- Idempotent — ALTER TABLE … ADD COLUMN IF NOT EXISTS.
-- ============================================================================

ALTER TABLE public.codex_configs
  ADD COLUMN IF NOT EXISTS published_to_cluster BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.codex_configs.published_to_cluster IS
  'When true, this personal cartridge appears as a dynamic sub-tab in the '
  'owner''s myCluster group within the metaMe cartridge. Does not affect '
  'visibility to other personas — the row is still personal/RLS-isolated. '
  'Toggled via POST /api/cartridge/[slug]/publish-to-cluster. Added 2026-06-03.';
