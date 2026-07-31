-- 20260711000000 — Canonical research report versions (CFS-019 / CFS-025 · CFS-026)
--
-- The Findings Report must REGENERATE its whole narrative from the collective
-- canonical findings to date (not append) whenever it is updated — and each
-- regeneration is saved as a CANONICAL, VERSIONED, DVN-receipted artifact, so the
-- next report can reset the narrative from the comprehensive record (or a scoped
-- area) and any prior version is verifiable via its receipt.
--
-- This is the Artifact Runtime `research` profile applied to the report itself:
-- the report becomes a produced constitutional artifact, not a hardcoded template.
--
-- T2 discipline: content + content_hash + receipt_id are T2-safe (a publication
-- commitment + its anchor). No T0 identifier is stored.

BEGIN;

CREATE TABLE IF NOT EXISTS public.research_report_versions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Monotonic per scope — v1, v2, … within 'foundational-validation-series' etc.
  version       INTEGER NOT NULL,
  -- The research area the report covers ('all' | a series id | an experiment id).
  scope         TEXT NOT NULL DEFAULT 'all',
  title         TEXT NOT NULL,
  -- The regenerated report markdown (a T2 publication artifact).
  content       TEXT NOT NULL,
  -- sha256 over `content` — the verifiable publication commitment.
  content_hash  TEXT NOT NULL,
  -- The DVN-anchorable `artifact_published` receipt id (verification anchor).
  receipt_id    TEXT,
  -- The sovereignty receipt (provider/model/floor) proving it ran natively.
  sovereignty   JSONB,
  -- The canonical result hashes the narrative was grounded on (provenance).
  grounded_on   JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (scope, version)
);

CREATE INDEX IF NOT EXISTS idx_research_report_scope_version
  ON public.research_report_versions (scope, version DESC);

COMMENT ON TABLE public.research_report_versions IS
  'Canonical, versioned, DVN-receipted research reports — each a full narrative regeneration from the collective findings to date (CFS-025 research profile applied to the report). content_hash + receipt_id make every version verifiable.';

-- ─── RLS — admins/service read; service writes (composed under the admin gate) ──
ALTER TABLE public.research_report_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS research_report_versions_read ON public.research_report_versions;
CREATE POLICY research_report_versions_read ON public.research_report_versions
  FOR SELECT USING (true); -- reports are shareable artifacts; content is T2-safe

DROP POLICY IF EXISTS research_report_versions_service_write ON public.research_report_versions;
CREATE POLICY research_report_versions_service_write ON public.research_report_versions
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

COMMIT;
