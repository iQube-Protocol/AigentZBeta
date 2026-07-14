-- CVR-003 (2026-07-14) — cited-invariant recording on artifact records.
--
-- The Artifact Runtime now resolves the canonical invariants grounding every
-- non-disposable production (consumed from the composition's grounded
-- component, else a live profile-scoped slice) and the record seams persist
-- WHICH invariants each artifact reasoned under. This closes the loop between
-- production and the invariant substrate: every consequential artifact
-- becomes an auditable grounding citation (Reach accrues via the consequence
-- return path, CFS-006 §4 — never Standing, Law XII).
--
-- Additive + safe: rows written before this migration read as '[]'.

ALTER TABLE public.artifact_records
  ADD COLUMN IF NOT EXISTS cited_invariant_ids JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.artifact_records.cited_invariant_ids IS
  'CVR-003: canonical invariant ids (public knowledge-object ids, T2-safe) that grounded this production. Source: runArtifact groundingOf(result) or the composition grounded component.';
