-- ============================================================================
-- ContentQube Phase 3 — Registry VIEW
--
-- Provides a single denormalised read path for ContentQube data. Joins the
-- core content_qubes table with its access policy, primary storage, edition
-- counts, and cartridge binding slugs.
--
-- Consumed by:
--   - /api/registry/content-qube/[id]   (Phase 3)
--   - services/content/resolveContentQube.ts (Phase 4, thin wrapper over
--     evaluateAccess that decorates this view with persona_owns)
--
-- This VIEW is server-internal. RLS on the underlying tables is honoured
-- because Postgres VIEWs inherit the calling role's RLS context. The
-- expectation is that service_role calls this view; the API layer strips
-- any T0 fields before emitting browser-bound JSON.
--
-- Notes:
--   - LATERAL subqueries return at most one row per qube for the storage +
--     edition aggregates. The cartridge_bindings aggregate is an array of
--     distinct codex slugs.
--   - persona_id columns are NOT exposed in this view — the API layer
--     resolves "persona_owns" via evaluateAccess() rather than leaking
--     T0 identifiers into the view shape.
-- ============================================================================

BEGIN;

CREATE OR REPLACE VIEW public.v_content_qube_registry AS
SELECT
  cq.id,
  cq.series,
  cq.content_kind,
  cq.content_type,
  cq.display_number,
  cq.title,
  cq.description,
  cq.lifecycle_state,
  cq.master_qube_id,
  cq.media_asset_id,
  cq.created_at,
  cq.updated_at,

  -- Access policy slice (at most one per qube — UNIQUE constraint on content_qube_id)
  ap.gating_kind,
  ap.required_sku,
  ap.price_qc,
  ap.min_identity_level,

  -- Primary storage row (LATERAL — at most one)
  ps.storage_kind     AS primary_storage_kind,
  ps.storage_url      AS primary_storage_url,
  ps.mime_type        AS primary_mime_type,
  ps.file_size_bytes  AS primary_file_size_bytes,
  ps.content_state    AS primary_content_state,

  -- Storage kinds available (array of distinct kinds)
  sk.storage_kinds,

  -- Edition counts (LATERAL — aggregates)
  COALESCE(ed.total_editions, 0)       AS total_editions,
  COALESCE(ed.issued_count, 0)         AS issued_count,
  COALESCE(ed.chain_minted_count, 0)   AS chain_minted_count,
  COALESCE(ed.legendary_count, 0)      AS legendary_count,
  COALESCE(ed.epic_count, 0)           AS epic_count,
  COALESCE(ed.rare_count, 0)           AS rare_count,
  COALESCE(ed.secret_black_rare_count, 0) AS secret_black_rare_count,

  -- Cartridge bindings (array of distinct codex slugs)
  cb.codex_slugs

FROM public.content_qubes cq
LEFT JOIN public.content_qube_access_policies ap
  ON ap.content_qube_id = cq.id
LEFT JOIN LATERAL (
  SELECT s.storage_kind, s.storage_url, s.mime_type, s.file_size_bytes, s.content_state
  FROM public.content_qube_storage s
  WHERE s.content_qube_id = cq.id
    AND s.is_primary = true
  ORDER BY s.created_at DESC
  LIMIT 1
) ps ON true
LEFT JOIN LATERAL (
  SELECT array_agg(DISTINCT s.storage_kind ORDER BY s.storage_kind) AS storage_kinds
  FROM public.content_qube_storage s
  WHERE s.content_qube_id = cq.id
) sk ON true
LEFT JOIN LATERAL (
  SELECT
    COUNT(*)::int                                                            AS total_editions,
    COUNT(*) FILTER (WHERE e.issued_at IS NOT NULL)::int                     AS issued_count,
    COUNT(*) FILTER (WHERE e.chain_minted_at IS NOT NULL)::int               AS chain_minted_count,
    COUNT(*) FILTER (WHERE e.rarity = 'legendary')::int                      AS legendary_count,
    COUNT(*) FILTER (WHERE e.rarity = 'epic')::int                           AS epic_count,
    COUNT(*) FILTER (WHERE e.rarity = 'rare')::int                           AS rare_count,
    COUNT(*) FILTER (WHERE e.rarity = 'secret_black_rare')::int              AS secret_black_rare_count
  FROM public.content_qube_editions e
  WHERE e.content_qube_id = cq.id
) ed ON true
LEFT JOIN LATERAL (
  SELECT array_agg(DISTINCT b.codex_slug ORDER BY b.codex_slug) AS codex_slugs
  FROM public.content_qube_cartridge_bindings b
  WHERE b.content_qube_id = cq.id
) cb ON true;

COMMENT ON VIEW public.v_content_qube_registry IS
  'Denormalised read path for ContentQube registry. Server-internal; API layer must strip T0 fields and resolve persona_owns via evaluateAccess() before emitting browser-bound JSON.';

COMMIT;
