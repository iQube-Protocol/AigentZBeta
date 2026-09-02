-- 20260901000000_bridge_content_placements.sql
--
-- QRP-BRIDGE-ADMIN A2 (2026-09-01, extended 2026-09-02). Applied to the
-- dev Supabase project (bsjhfvctmduxhohtllly / "Aigent Z", the only
-- project referenced anywhere in this repo's committed config/seeded
-- storage URLs) on 2026-09-02 as part of closing the C-15/A3 media-work
-- infrastructure handoff — see codexes/packs/agentiq/updates/
-- 2026-09-02_moneypenny-authoritative-three-spec-import-and-reconciliation.md
-- §15 for the applied-migration record. Typed asset placements with a
-- real draft/publish distinction for CI/KNYTS bridge media slots
-- (video/poster/infographic) (see services/journey/bridgeContentPlacements.ts's
-- own header for why 'infographic' publish differs from video/poster: no
-- knyts_bridge_editorial_config column exists for it yet, so its publish
-- step is placement bookkeeping only).
--
-- Deliberately does NOT touch knyts_bridge_editorial_config or any reader.
-- That table/its GET/PUT route stay exactly as they are — the existing
-- immediate-save copy/URL fields remain a valid "Save & publish" path per
-- the spec's own A-02/A-03 acceptance of that model. This table adds a
-- SEPARATE, additive capability: a typed asset reference with a real draft
-- state that can be previewed before it is committed into the existing
-- video_url/poster_url columns. Publish is the ONLY code path that writes
-- into knyts_bridge_editorial_config from this table (via the existing
-- upsertKnytsBridgeEditorialSection function, unchanged) — so every reader
-- of that config keeps working with zero changes.
--
-- One row per (section, slot) rather than a full revision log: the smallest
-- shape that gives a real draft/published distinction, an asset identity,
-- and a revision counter, without inventing a second CMS (CLAUDE.md
-- "Extend, Don't Duplicate"). `section` reuses the SAME string vocabulary
-- knyts_bridge_editorial_config.section already uses (e.g. 'ci-home',
-- 'ci-view-the-disappearing-person', 'home') — no second destination
-- registry.
--
-- Service-role only (matches financial_profile_qubes' RLS shape,
-- 20260930180000): this table is admin-only bookkeeping. It is never read
-- by any public bridge renderer — publish's side effect (writing the
-- resolved URL into the existing config table) is what the public reader
-- actually consumes.

CREATE TABLE IF NOT EXISTS public.bridge_content_placements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section text NOT NULL,
  slot text NOT NULL CHECK (slot IN ('video', 'poster', 'infographic')),
  draft_asset_id text,
  draft_asset_url text,
  published_asset_id text,
  published_asset_url text,
  revision integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  actor text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  UNIQUE (section, slot)
);

ALTER TABLE public.bridge_content_placements ENABLE ROW LEVEL SECURITY;

CREATE POLICY bridge_content_placements_service_role_all
  ON public.bridge_content_placements
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.touch_bridge_content_placements_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = public;

CREATE TRIGGER bridge_content_placements_touch_updated_at
  BEFORE UPDATE ON public.bridge_content_placements
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_bridge_content_placements_updated_at();
