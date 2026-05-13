-- ============================================================================
-- ContentQube Phase 7 — Editions ledger seeding
--
-- Two rarity classes, with different lifecycle semantics:
--
--   CANONICAL-MINTABLE (1,860 per content_qube; pre-seeded by this migration):
--     legendary           18  (editions 1..18)
--     epic               186  (editions 19..204)
--     rare             1,654  (editions 205..1858)
--     secret_black_rare    2  (editions 1859..1860)
--     → Each edition is unique. Eligible for canonical non-fungible TokenQube
--       minting to Base (Phase 7B). May carry per-holder sovereign cyphertext
--       (state E) or shared canonical cyphertext (state D).
--
--   STREAMING-ACCESS (commons; NOT pre-seeded — appended on sale):
--     common         unlimited
--     → Encrypted at rest, token-gated for access, served via the streaming
--       decrypt proxy under remote-custody model. The same canonical cyphertext
--       is served to every holder; no per-holder mint. Each sale STILL writes
--       an editions row (for audit/receipt/revenue) but is NEVER canonically
--       minted — base_token_id and chain_minted_at remain NULL forever.
--       Common edition_number sequences continue after 1860 (1861, 1862, …).
--
-- This migration:
--   1. Relaxes the rarity CHECK to include 'common'
--   2. Adds a partial-index helper for "next common edition_number" lookups
--   3. Recreates v_content_qube_registry to expose common_count
--   4. Pre-seeds 1,860 canonical-mintable editions per metaKnyts content_qube
--      via generate_series; idempotent (NOT EXISTS guard)
-- ============================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────
-- 1. Add 'common' to rarity CHECK
-- ─────────────────────────────────────────────────────────────────────────

ALTER TABLE public.content_qube_editions
  DROP CONSTRAINT IF EXISTS content_qube_editions_rarity_check;
ALTER TABLE public.content_qube_editions
  ADD CONSTRAINT content_qube_editions_rarity_check
  CHECK (rarity IN ('common', 'rare', 'epic', 'legendary', 'secret_black_rare'));

-- Partial index — fast lookup of MAX(edition_number) for commons when
-- appending a new sale row. Canonical-mintable lookups go through the
-- pre-seed pool and don't need this.
CREATE INDEX IF NOT EXISTS idx_cq_edition_common_seq
  ON public.content_qube_editions (content_qube_id, edition_number DESC)
  WHERE rarity = 'common';

-- ─────────────────────────────────────────────────────────────────────────
-- 2. Recreate registry view with common_count
-- ─────────────────────────────────────────────────────────────────────────

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

  ap.gating_kind,
  ap.required_sku,
  ap.price_qc,
  ap.min_identity_level,

  ps.storage_kind     AS primary_storage_kind,
  ps.storage_url      AS primary_storage_url,
  ps.mime_type        AS primary_mime_type,
  ps.file_size_bytes  AS primary_file_size_bytes,
  ps.content_state    AS primary_content_state,

  sk.storage_kinds,

  COALESCE(ed.total_editions, 0)                AS total_editions,
  COALESCE(ed.issued_count, 0)                  AS issued_count,
  COALESCE(ed.chain_minted_count, 0)            AS chain_minted_count,
  COALESCE(ed.legendary_count, 0)               AS legendary_count,
  COALESCE(ed.epic_count, 0)                    AS epic_count,
  COALESCE(ed.rare_count, 0)                    AS rare_count,
  COALESCE(ed.secret_black_rare_count, 0)       AS secret_black_rare_count,
  COALESCE(ed.common_count, 0)                  AS common_count,

  cb.codex_slugs

FROM public.content_qubes cq
LEFT JOIN public.content_qube_access_policies ap
  ON ap.content_qube_id = cq.id
LEFT JOIN LATERAL (
  SELECT s.storage_kind, s.storage_url, s.mime_type, s.file_size_bytes, s.content_state
  FROM public.content_qube_storage s
  WHERE s.content_qube_id = cq.id AND s.is_primary = true
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
    COUNT(*)::int                                            AS total_editions,
    COUNT(*) FILTER (WHERE e.issued_at IS NOT NULL)::int     AS issued_count,
    COUNT(*) FILTER (WHERE e.chain_minted_at IS NOT NULL)::int AS chain_minted_count,
    COUNT(*) FILTER (WHERE e.rarity = 'legendary')::int      AS legendary_count,
    COUNT(*) FILTER (WHERE e.rarity = 'epic')::int           AS epic_count,
    COUNT(*) FILTER (WHERE e.rarity = 'rare')::int           AS rare_count,
    COUNT(*) FILTER (WHERE e.rarity = 'secret_black_rare')::int AS secret_black_rare_count,
    COUNT(*) FILTER (WHERE e.rarity = 'common')::int         AS common_count
  FROM public.content_qube_editions e
  WHERE e.content_qube_id = cq.id
) ed ON true
LEFT JOIN LATERAL (
  SELECT array_agg(DISTINCT b.codex_slug ORDER BY b.codex_slug) AS codex_slugs
  FROM public.content_qube_cartridge_bindings b
  WHERE b.content_qube_id = cq.id
) cb ON true;

COMMENT ON VIEW public.v_content_qube_registry IS
  'Denormalised read path for ContentQube registry. Server-internal; API layer must strip T0 fields and resolve persona_owns via evaluateAccess() before emitting browser-bound JSON. common_count reflects streaming-access (non-canonical) sales.';

-- ─────────────────────────────────────────────────────────────────────────
-- 3. Pre-seed canonical-mintable editions for metaKnyts content_qubes
--    Distribution: 18 legendary / 186 epic / 1,654 rare / 2 secret_black_rare
-- ─────────────────────────────────────────────────────────────────────────

INSERT INTO public.content_qube_editions (content_qube_id, edition_number, rarity)
SELECT
  cq.id,
  n.edition_number,
  CASE
    WHEN n.edition_number <=   18 THEN 'legendary'
    WHEN n.edition_number <=  204 THEN 'epic'
    WHEN n.edition_number <= 1858 THEN 'rare'
    ELSE                               'secret_black_rare'
  END
FROM public.content_qubes cq
CROSS JOIN generate_series(1, 1860) AS n(edition_number)
WHERE cq.series = 'metaKnyts'
  AND NOT EXISTS (
    SELECT 1 FROM public.content_qube_editions e
    WHERE e.content_qube_id = cq.id
      AND e.edition_number = n.edition_number
  );

COMMIT;
