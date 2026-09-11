-- 20260802000000_canonical_plate_registry.sql
--
-- Canonical Plate Registry (operator + Aletheon design, 2026-07-20): plates
-- become REGISTERED constitutional objects, not displayed images. Extends the
-- existing CP system (CFS-027) — the seven code-resident v1 plates
-- (CANONICAL_PLATES_V1) remain the ratified seed canon; this table holds
-- OPERATOR-COMPOSED plates (CP-008+) moving through the constitutional
-- lifecycle:
--
--   draft → candidate → ratified (canonisation) → published (exposure)
--
-- Canonisation and publication are DISTINCT acts: ratification is the
-- constitutional decision; publishing merely exposes a ratified plate on the
-- public IRL OS registry. Internal IRL (the laboratory) sees every status;
-- IRL OS (the publishing layer) sees status = 'published' only.
--
-- The machine representation (structure jsonb — "plate.json") is the plate;
-- SVG/PNG/PDF assets are RENDERINGS of it (CFS-027 doctrine: agents read the
-- ontology, the image is one rendering). Assets are stored as refs (jsonb),
-- not blobs.
--
-- T0/T2 discipline: composed_by is a T2-safe commitment (sha256/16), never a
-- persona id. Service-role access only; RLS enabled with no client policies.

CREATE TABLE IF NOT EXISTS public.canonical_plate_registry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Canonical plate number, continuing the v1 series (CP-008, CP-009, …).
  cp_number text UNIQUE NOT NULL,
  title text NOT NULL,
  version text NOT NULL DEFAULT '1.0',
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'candidate', 'ratified', 'published')),
  -- Visual grammar (mirrors services/artifact/canonicalPlates.ts PlateForm/kind)
  form text NOT NULL DEFAULT 'branch'
    CHECK (form IN ('branch', 'radial', 'circle', 'stack', 'flow')),
  kind text NOT NULL DEFAULT 'ontology',
  -- THE machine representation — the plate itself (plate.json).
  structure jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- What the plate MEANS — the one-line reading.
  message text NOT NULL DEFAULT '',
  -- Renderings of the structure: { svg?: url, png?: url, pdf?: url } refs.
  assets jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- Constitutional references (CFS ids, Laws, invariant seed ids).
  constitutional_refs text[] NOT NULL DEFAULT '{}',
  -- Prerequisite/related plates (CP numbers) — the constitutional graph.
  dependencies text[] NOT NULL DEFAULT '{}',
  machine_tags text[] NOT NULL DEFAULT '{}',
  -- Optional KnowledgeQube linkage (asset/qube ref) so the copilot can
  -- reason from the plate directly.
  knowledge_qube_ref text,
  -- T2-safe composer commitment — never a raw persona id.
  composed_by_commitment text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  ratified_at timestamptz,
  published_at timestamptz
);

CREATE INDEX IF NOT EXISTS canonical_plate_registry_status_idx
  ON public.canonical_plate_registry (status, cp_number);

ALTER TABLE public.canonical_plate_registry ENABLE ROW LEVEL SECURITY;
