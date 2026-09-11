-- 20260803000000_invariant_discovery.sql
--
-- CFS-048 Invariant Discovery Engine — Phase 0 (constitutional arm, Financial
-- Services). The UPSTREAM primitive that builds a candidate invariant library
-- for a cold domain, feeding the existing validation harness + canonical
-- registry (services/invariants/lifecycle.ts). See the charter:
-- codexes/packs/agentiq/updates/2026-07-20_cfs-048-invariant-discovery-engine-charter.md
--
-- Two tables, sitting UPSTREAM of the invariants registry:
--   discovery_evidence   — Stage 1 (Evidence Collection). Domain artefacts with
--                          provenance. inv.reasoning.335: no candidate without
--                          traceable evidence.
--   discovery_candidates — Stages 2-3 (Candidate Extraction + Synthesis). NOT
--                          invariants — candidates awaiting validation. Promotion
--                          calls discoverInvariant() → status 'proposed' in the
--                          canonical registry; only validation → 'canonical'
--                          (inv.reasoning.337: discovery never bypasses
--                          validation).
--
-- T2 discipline: added_by is a one-way commitment, never a persona id.
-- Service-role access only; RLS enabled with no client policies.

CREATE TABLE IF NOT EXISTS public.discovery_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain text NOT NULL,
  title text NOT NULL,
  source_kind text NOT NULL DEFAULT 'other'
    CHECK (source_kind IN ('legislation','regulation','compliance','standard','contract','policy','other')),
  content text NOT NULL,
  source_ref text,
  added_by_commitment text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS discovery_evidence_domain_idx
  ON public.discovery_evidence (domain, created_at DESC);

CREATE TABLE IF NOT EXISTS public.discovery_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain text NOT NULL,
  -- The three discovery classes (inv.reasoning.338). Phase 0 = constitutional.
  discovery_class text NOT NULL DEFAULT 'constitutional'
    CHECK (discovery_class IN ('constitutional','structural','experiential')),
  statement text NOT NULL,
  rationale text NOT NULL DEFAULT '',
  -- Evidence provenance — the sources this candidate was compressed from.
  evidence_ids uuid[] NOT NULL DEFAULT '{}',
  confidence numeric NOT NULL DEFAULT 0.5 CHECK (confidence >= 0 AND confidence <= 1),
  -- candidate → promoted (landed as 'proposed' in the registry) | rejected.
  status text NOT NULL DEFAULT 'candidate'
    CHECK (status IN ('candidate','promoted','rejected')),
  promoted_invariant_id uuid,
  -- The discovery run that produced it (model/stage/governing invariants) —
  -- reproducibility receipt (charter §Core Principle 4).
  discovery_provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS discovery_candidates_domain_idx
  ON public.discovery_candidates (domain, status, created_at DESC);

ALTER TABLE public.discovery_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discovery_candidates ENABLE ROW LEVEL SECURITY;
