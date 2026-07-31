-- 20260813000000_corpus_candidate_sources_structural_tags.sql
--
-- PRD-ICA-001 (Corpus Scout) — Phase 3 lightweight corpus intelligence
-- (§8 structural-value classification, §14.3).
--
-- Additive, idempotent: one nullable-defaulted jsonb column on the Phase 1/2
-- provenance store (20260812000000). Holds the HEURISTIC structural-value
-- tags computed at retrieval time by services/corpusScout/intelligence.ts
-- (keyword/pattern heuristics only — no ML, no LLM; the tags assist human
-- review and NEVER replace human judgment, PRD-ICA-001 §8). Values are a
-- subset of the PRD §8 vocabulary: causal, conditional, relational,
-- mathematical, probabilistic, temporal, threshold-based, feedback,
-- trade-off, constraint, failure-derived, governance, definitional,
-- empirical-association. Enforced in TypeScript (services/corpusScout/
-- types.ts), not via CHECK — the heuristic vocabulary may be refined without
-- a schema change, and the column is advisory review metadata, not a
-- decision axis (unlike provenance_class / review_workflow_status).

ALTER TABLE public.corpus_candidate_sources
  ADD COLUMN IF NOT EXISTS structural_tags jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.corpus_candidate_sources.structural_tags IS
  'HEURISTIC structural-value tags (PRD-ICA-001 §8) computed at retrieval time from keyword/pattern matching — advisory review metadata only, never a substitute for human judgment. Subset of the PRD §8 vocabulary.';
