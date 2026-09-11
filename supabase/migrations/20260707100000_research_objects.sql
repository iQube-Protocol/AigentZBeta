-- 20260707100000_research_objects.sql
--
-- CCRL Phase C2.2 (CFS-019): persistence for research objects committed from
-- APPROVED copilot proposals (experiments / findings / publications). C2.1
-- kept approved objects in tab memory (they evaporated on refresh); this
-- table is the durable lab record behind GET/POST /api/research/objects.
--
-- Trust model: `payload` is the typed research object (ResearchExperiment /
-- ResearchFinding / ResearchPublication) exactly as coerced server-side by
-- the pure applyResearchProposal — T2-safe by construction (C2.1 payload
-- discipline: ids, families, claims, hash-commitment evidence refs, invariant
-- seed ids — NEVER T0 identifiers; the route additionally REJECTS any payload
-- carrying persona/auth-profile/root-did/fio-handle/kybe keys, so the guard
-- lives in the route, not the DB). `receipt_id` links the
-- `research_lifecycle_transition` activity receipt (DVN-anchorable) recorded
-- on approve — the receipt is the provenance, the row is the working state.
--
-- Additive-only (CFS-010 §3); idempotent, re-runnable. RLS enabled with no
-- policies: service-role access only (all reads/writes flow through the
-- spine-gated, admin-only API route), mirroring experiment_results.

CREATE TABLE IF NOT EXISTS public.research_objects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  object_kind text NOT NULL CHECK (object_kind IN ('experiment', 'finding', 'publication')),
  object_id text NOT NULL,
  payload jsonb NOT NULL,
  lifecycle_state text NOT NULL,
  receipt_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT research_objects_kind_object_id_key UNIQUE (object_kind, object_id)
);

CREATE INDEX IF NOT EXISTS research_objects_kind_updated_idx
  ON public.research_objects (object_kind, updated_at DESC);

ALTER TABLE public.research_objects ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.research_objects IS
  'CCRL working research objects (experiments/findings/publications) persisted from operator-approved copilot proposals (CFS-019 C2.2). Upsert key: (object_kind, object_id). receipt_id = the research_lifecycle_transition receipt recorded on approve.';
COMMENT ON COLUMN public.research_objects.object_id IS
  'Registry-style id (EXP-NNN / FIND-<slug> / PUB-<slug>) — T2-safe, never a T0 identifier.';
COMMENT ON COLUMN public.research_objects.payload IS
  'The typed research object exactly as coerced by applyResearchProposal server-side — T2-safe by construction; the API route rejects payloads carrying forbidden identifier keys.';
