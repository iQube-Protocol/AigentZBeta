-- 20260811000000_discovery_evidence_allow_corpus_scout_kinds.sql
--
-- Widen discovery_evidence.source_kind to accept the three EvidenceKind values
-- added for Corpus Scout (PRD-ICA-001 §6, resolved 2026-07-22):
--   • academic-literature — actuarial/risk-science papers, practitioner standards
--   • incident-report     — bank/insurance/operational failure post-mortems
--   • disclosure-report   — annual reports/risk reports/stress tests (used only
--                           in aggregation across multiple institutions —
--                           Crystal Canon Collection H)
--
-- The prior constraint (20260803000000) was
--   CHECK (source_kind IN ('legislation','regulation','compliance','standard','contract','policy','other'))
-- which rejects these at INSERT. Any addEvidence() call tagging a Corpus Scout
-- source with one of the new kinds would be rejected by Postgres before landing.
--
-- Additive/idempotent (CFS-010 §3): DROP ... IF EXISTS + ADD is re-runnable.

ALTER TABLE public.discovery_evidence
  DROP CONSTRAINT IF EXISTS discovery_evidence_source_kind_check,
  ADD CONSTRAINT discovery_evidence_source_kind_check
    CHECK (source_kind IN (
      'legislation', 'regulation', 'compliance', 'standard', 'contract', 'policy',
      'academic-literature', 'incident-report', 'disclosure-report', 'other'
    ));
