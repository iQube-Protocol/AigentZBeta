-- ============================================================================
-- codex_configs RLS tightening — personal cartridge isolation, hardening pass.
--
-- Predecessor: 2026-06-02 isolation fix (registry GET filters out personal
-- rows by default; detail route gates personal rows).
--
-- The legacy SELECT policy on codex_configs was:
--
--   "Authenticated users can view all codexes"
--     FOR SELECT TO authenticated USING (true)
--
-- That predates Phase 4a (owner_persona_id column) and lets any
-- authenticated browser-side Supabase client read every personal
-- cartridge row directly — bypassing the API-layer registry filter.
--
-- This migration:
--   1. Drops the "see all" policy.
--   2. Replaces it with "authenticated users see system cartridges only"
--      (owner_persona_id IS NULL). Personal cartridges drop out of the
--      direct authenticated read path entirely.
--   3. Leaves service_role policies untouched. Every spine-gated route
--      (registry GET with persona resolution, /api/cartridge/list-mine,
--      /api/cartridge/[slug], the manager surface) uses the service role
--      and continues to see all rows; the spine + manageGuard apply the
--      per-persona scoping at the application layer.
--
-- Symmetric tightening on codex_tabs — the legacy public + authenticated
-- read policies on codex_tabs join to codex_configs.enabled, but don't
-- gate on owner_persona_id. Same browser-side leak risk. This migration:
--   4. Drops both legacy SELECT policies on codex_tabs.
--   5. Re-creates them with the same enabled-cartridge join PLUS an
--      "owner_persona_id IS NULL on the parent" clause for system rows.
--
-- Idempotent — DROP POLICY IF EXISTS … CREATE POLICY.
--
-- Why use a NULL discriminator and not a separate cartridge_kind column?
-- Phase 4a already added owner_persona_id; wizard rows populate it,
-- hand-curated + admin-created system rows leave it NULL. The two
-- populations are already cleanly separated on disk; no additional
-- column is necessary. A future migration could add an explicit
-- `cartridge_kind TEXT CHECK (kind IN ('system','personal','tenant'))`
-- column for richer semantics; the current shape is sufficient for the
-- isolation guarantee the operator asked for.
--
-- Phase 7 manager + Phase 6 wizard continue to work unchanged because
-- they go through the service-role API layer; the RLS tightening only
-- affects direct browser-side authenticated reads (which there
-- shouldn't be for codex_configs in practice — every codex read in the
-- codebase routes through an API endpoint).
-- ============================================================================

-- ─── codex_configs SELECT policy tightening ─────────────────────────────────

DROP POLICY IF EXISTS "Authenticated users can view all codexes" ON public.codex_configs;

CREATE POLICY "Authenticated users can view system codexes"
  ON public.codex_configs
  FOR SELECT
  TO authenticated
  USING (owner_persona_id IS NULL);

COMMENT ON POLICY "Authenticated users can view system codexes" ON public.codex_configs IS
  'Authenticated browser-side reads see system cartridges only (owner_persona_id IS NULL). Personal cartridges (wizard-created) are gated to the service-role API layer where the spine resolves the caller persona and applies per-persona scoping. Tightened 2026-06-02 from the prior "see all" policy.';

-- The "Public can view enabled codexes" policy stays as-is — public
-- (anon) reads were already gated on `enabled = true` and have never
-- exposed personal cartridges because the wizard's saves are
-- `enabled = true` by default but personal rows weren't previously
-- distinguished. Tightening it further is also right:

DROP POLICY IF EXISTS "Public can view enabled codexes" ON public.codex_configs;

CREATE POLICY "Public can view enabled system codexes"
  ON public.codex_configs
  FOR SELECT
  USING (enabled = true AND owner_persona_id IS NULL);

COMMENT ON POLICY "Public can view enabled system codexes" ON public.codex_configs IS
  'Public (anon) reads see enabled system cartridges only. Tightened 2026-06-02 to also gate on owner_persona_id IS NULL so wizard-created cartridges never appear on unauthenticated reads.';

-- ─── codex_tabs SELECT policy tightening ────────────────────────────────────
-- Tabs follow the cartridge's posture. If the parent cartridge isn't
-- visible to the caller via RLS, neither should its tabs be.

DROP POLICY IF EXISTS "Public can view tabs of enabled codexes" ON public.codex_tabs;

CREATE POLICY "Public can view tabs of enabled system codexes"
  ON public.codex_tabs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.codex_configs
      WHERE codex_configs.id = codex_tabs.codex_id
        AND codex_configs.enabled = true
        AND codex_configs.owner_persona_id IS NULL
    )
  );

DROP POLICY IF EXISTS "Authenticated users can view all tabs" ON public.codex_tabs;

CREATE POLICY "Authenticated users can view system tabs"
  ON public.codex_tabs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.codex_configs
      WHERE codex_configs.id = codex_tabs.codex_id
        AND codex_configs.owner_persona_id IS NULL
    )
  );

COMMENT ON POLICY "Authenticated users can view system tabs" ON public.codex_tabs IS
  'Authenticated browser-side reads see tabs of system cartridges only. Tabs of personal cartridges are gated to the service-role API layer (registry detail route applies the spine-based isolation check). Tightened 2026-06-02 alongside codex_configs.';
