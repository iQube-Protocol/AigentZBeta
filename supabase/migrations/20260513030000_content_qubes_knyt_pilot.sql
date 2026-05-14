-- ============================================================================
-- ContentQube Phase 6 — KNYT pilot: bridge master rows into content_qubes
--
-- Inserts content_qubes rows for every master_content_qubes and
-- codex_media_assets row in series='metaKnyts', links them via
-- master_qube_id / media_asset_id, seeds access policies from the
-- existing gating_kind column, binds each qube to the knyt-codex
-- cartridge, and emits a creation receipt for every inserted row.
--
-- Idempotent: all inserts use ON CONFLICT DO NOTHING so re-running
-- against a partially-migrated DB is safe.
--
-- Convention reminders (see /api/admin/codex/canonical route):
--   master_content_qubes.episode_number: 0..12 = episodes, -1 = GN
--   codex_media_assets.episode_number:   1..13  = characters (display# = ep-1)
-- ============================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────
-- 1. Bridge master_content_qubes → content_qubes
--    Columns derived:
--      content_kind  = CASE content_type
--      display_number = episode_number (GN maps to NULL — it has no
--                       sequence position in the display grid)
--      lifecycle_state: minted CID → canonized; http CID → semi_minted;
--                       null CID → draft
-- ─────────────────────────────────────────────────────────────────────────

INSERT INTO public.content_qubes (
  series,
  content_kind,
  content_type,
  display_number,
  title,
  lifecycle_state,
  master_qube_id
)
SELECT
  m.series,
  CASE m.content_type
    WHEN 'gn_still'       THEN 'gn'
    WHEN 'episode_still'  THEN 'episode'
    WHEN 'episode_motion' THEN 'episode'
    WHEN 'episode_print'  THEN 'episode'
    ELSE                       'other'
  END,
  m.content_type,
  CASE WHEN m.content_type = 'gn_still' THEN NULL
       ELSE m.episode_number
  END,
  m.title,
  CASE
    WHEN m.auto_drive_cid IS NOT NULL AND m.auto_drive_cid NOT LIKE 'http%'
      THEN 'canonized'
    WHEN m.auto_drive_cid IS NOT NULL AND m.auto_drive_cid LIKE 'http%'
      THEN 'semi_minted'
    ELSE 'draft'
  END,
  m.id::text
FROM public.master_content_qubes m
WHERE m.series = 'metaKnyts'
  AND m.content_type IN ('gn_still', 'episode_still', 'episode_motion', 'episode_print')
ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────
-- 2. Bridge codex_media_assets → content_qubes
--    display_number = episode_number - 1  (1-indexed DB → 0-indexed display)
-- ─────────────────────────────────────────────────────────────────────────

INSERT INTO public.content_qubes (
  series,
  content_kind,
  content_type,
  display_number,
  title,
  lifecycle_state,
  media_asset_id
)
SELECT
  a.series,
  CASE a.asset_kind
    WHEN 'character_poster' THEN 'character'
    WHEN 'powers_sheet'     THEN 'powers_sheet'
    ELSE                         'other'
  END,
  a.asset_kind,
  CASE WHEN a.episode_number IS NOT NULL THEN a.episode_number - 1 ELSE NULL END,
  a.title,
  CASE
    WHEN a.auto_drive_cid IS NOT NULL AND a.auto_drive_cid NOT LIKE 'http%'
      THEN 'canonized'
    WHEN a.auto_drive_cid IS NOT NULL AND a.auto_drive_cid LIKE 'http%'
      THEN 'semi_minted'
    ELSE 'draft'
  END,
  a.id::text
FROM public.codex_media_assets a
WHERE a.series = 'metaKnyts'
  AND a.asset_kind IN ('character_poster', 'powers_sheet')
ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────
-- 3. Storage — copy primary CIDs into content_qube_storage
--    Only rows that have a non-null auto_drive_cid. is_primary=true.
-- ─────────────────────────────────────────────────────────────────────────

-- From master_content_qubes
INSERT INTO public.content_qube_storage (
  content_qube_id,
  storage_kind,
  storage_url,
  mime_type,
  is_primary,
  content_state
)
SELECT
  cq.id,
  CASE WHEN m.auto_drive_cid LIKE 'http%' THEN 'supabase' ELSE 'auto_drive' END,
  m.auto_drive_cid,
  CASE m.content_type
    WHEN 'episode_print' THEN 'application/pdf'
    WHEN 'gn_still'      THEN 'application/pdf'
    WHEN 'episode_still' THEN 'image/jpeg'
    WHEN 'episode_motion'THEN 'video/mp4'
    ELSE NULL
  END,
  true,
  COALESCE(m.content_state,
    CASE WHEN m.auto_drive_cid LIKE 'http%' THEN 'C' ELSE 'D' END)
FROM public.master_content_qubes m
JOIN public.content_qubes cq ON cq.master_qube_id = m.id::text
WHERE m.series = 'metaKnyts'
  AND m.auto_drive_cid IS NOT NULL
ON CONFLICT DO NOTHING;

-- From codex_media_assets
INSERT INTO public.content_qube_storage (
  content_qube_id,
  storage_kind,
  storage_url,
  mime_type,
  is_primary,
  content_state
)
SELECT
  cq.id,
  CASE WHEN a.auto_drive_cid LIKE 'http%' THEN 'supabase' ELSE 'auto_drive' END,
  a.auto_drive_cid,
  CASE a.asset_kind
    WHEN 'character_poster' THEN 'image/jpeg'
    WHEN 'powers_sheet'     THEN 'application/pdf'
    ELSE NULL
  END,
  true,
  COALESCE(a.content_state,
    CASE WHEN a.auto_drive_cid LIKE 'http%' THEN 'C' ELSE 'D' END)
FROM public.codex_media_assets a
JOIN public.content_qubes cq ON cq.media_asset_id = a.id::text
WHERE a.series = 'metaKnyts'
  AND a.auto_drive_cid IS NOT NULL
ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────
-- 4. Access policies — seed from existing gating_kind columns
--    payment → owned; credential → subscription; null/free → free
-- ─────────────────────────────────────────────────────────────────────────

-- Access policies — metaKnyts content is paid (gated via SKU entitlements);
-- default every bridged row to gating_kind='owned'. The source tables
-- (master_content_qubes, codex_media_assets) do not carry a gating_kind
-- column, so there's no per-row override to read. Free / subscription
-- policies can be set via a follow-up migration if individual rows need
-- to differ from the series default.
INSERT INTO public.content_qube_access_policies (
  content_qube_id,
  gating_kind
)
SELECT
  cq.id,
  'owned'
FROM public.content_qubes cq
WHERE cq.series = 'metaKnyts'
ON CONFLICT (content_qube_id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────
-- 5. Cartridge bindings — bind all metaKnyts qubes to knyt-codex
--    Tab slug mapping:
--      episode / gn         → 'scrolls'
--      character            → 'characters'
--      powers_sheet         → 'characters'
--    display_order derived from display_number (NULLs sort last)
-- ─────────────────────────────────────────────────────────────────────────

INSERT INTO public.content_qube_cartridge_bindings (
  content_qube_id,
  codex_slug,
  tab_slug,
  display_order
)
SELECT
  cq.id,
  'knyt-codex',
  CASE cq.content_kind
    WHEN 'episode'      THEN 'scrolls'
    WHEN 'gn'           THEN 'scrolls'
    WHEN 'character'    THEN 'characters'
    WHEN 'powers_sheet' THEN 'characters'
    ELSE 'scrolls'
  END,
  cq.display_number
FROM public.content_qubes cq
WHERE cq.series = 'metaKnyts'
ON CONFLICT (content_qube_id, codex_slug, tab_slug) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────
-- 6. Creation receipts — one per inserted qube, no persona attribution
--    (system-level creation event; t2_alias_commitment = NULL)
-- ─────────────────────────────────────────────────────────────────────────

INSERT INTO public.content_qube_dvn_receipts (
  content_qube_id,
  receipt_kind,
  t2_alias_commitment,
  receipt_payload
)
SELECT
  cq.id,
  'creation',
  NULL,
  jsonb_build_object(
    'series',          cq.series,
    'content_kind',    cq.content_kind,
    'content_type',    cq.content_type,
    'display_number',  cq.display_number,
    'lifecycle_state', cq.lifecycle_state,
    'migration',       '20260513030000_content_qubes_knyt_pilot',
    'bridge_source',   CASE WHEN cq.master_qube_id IS NOT NULL
                              THEN 'master_content_qubes'
                            ELSE 'codex_media_assets' END
  )
FROM public.content_qubes cq
WHERE cq.series = 'metaKnyts'
  -- Only emit a creation receipt once; skip if one already exists for this qube.
  AND NOT EXISTS (
    SELECT 1 FROM public.content_qube_dvn_receipts r
    WHERE r.content_qube_id = cq.id
      AND r.receipt_kind = 'creation'
  );

COMMIT;
