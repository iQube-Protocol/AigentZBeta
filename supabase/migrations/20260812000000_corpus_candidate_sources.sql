-- 20260812000000_corpus_candidate_sources.sql
--
-- PRD-ICA-001 (Corpus Scout / Invariant Corpus Acquisition Agent) — Phase 1
-- (Retrieval foundation) + Phase 2 (Review packaging), narrowed build.
--
-- Corpus Scout's OWN provenance store (PRD-ICA-001 §6, §8). This table is
-- upstream of, and separate from, `discovery_evidence` (CFS-048 Stage 1):
--
--   corpus_candidate_sources  — Corpus Scout's candidate/provenance record.
--                               One row per retrieved-and-inspected artifact,
--                               whether it passed verification or not (a
--                               failed acquisition is recorded, never
--                               silently dropped — PRD-ICA-001 §12).
--   discovery_evidence        — CFS-048 Stage 1 (unchanged by this migration).
--                               The Ingestion Broker (services/corpusScout/
--                               ingestionBroker.ts) writes ONE OR MORE rows
--                               here per approved candidate, then records the
--                               resulting evidence_row_id back onto this table
--                               so a source is never double-ingested.
--
-- Two independent, composable axes (PRD-ICA-001 §0.3 — do not conflate):
--   provenance_class      — evidence-integrity question ("what kind of
--                            source is this"). The four values ratified in
--                            CRYSTAL-ENLARGEMENT_plan.md §2a.
--   review_workflow_status — pipeline-state question ("what did the human
--                            reviewer decide to do with it"). PRD-ICA-001 §8's
--                            eleven values.
--
-- T0/T2 discipline: no caseId/personaId/authProfileId is ever stored here —
-- this table carries only source-document provenance (URLs, hashes, extracted
-- text), never subject identifiers. Service-role access only; RLS enabled
-- with no client policies, matching discovery_evidence/research_objects.
-- Additive/idempotent (CFS-010 §3).

CREATE TABLE IF NOT EXISTS public.corpus_candidate_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id text NOT NULL UNIQUE,

  -- Campaign targeting — the Discovery Engine domain/sub-domain this
  -- candidate is being acquired FOR (PRD-ICA-001 §6's field mapping table).
  campaign_domain text NOT NULL,
  campaign_sub_domain text,

  -- Bibliographic metadata (best-effort at retrieval time; refined at review).
  title text NOT NULL DEFAULT '',
  issuer text,
  authors jsonb NOT NULL DEFAULT '[]'::jsonb,
  publication_date date,

  -- Retrieval + byte-level identity (PRD-ICA-001 §7, §8).
  retrieved_at timestamptz,
  canonical_url text NOT NULL,
  artifact_hash text,             -- sha256 of the raw retrieved bytes
  normalized_text_hash text,      -- sha256 of the extracted/normalized text — SEPARATE hash (§8)
  mime_type text,
  file_size_bytes bigint,
  page_count integer,
  license_status text NOT NULL DEFAULT 'unknown',

  -- The two composable axes (§0.3) — kept distinct, never merged into one field.
  provenance_class text
    CHECK (provenance_class IS NULL OR provenance_class IN (
      'external-established', 'external-empirical', 'platform-derived', 'platform-hypothesized'
    )),
  review_workflow_status text NOT NULL DEFAULT 'pending_review'
    CHECK (review_workflow_status IN (
      'pending_review', 'needs_retrieval_fix',
      'approved_exp_p1', 'approved_general_finance', 'approved_reference_only',
      'duplicate', 'superseded',
      'rejected_out_of_domain', 'rejected_low_substance', 'rejected_provenance', 'rejected_access_or_license'
    )),

  acquisition_method text NOT NULL DEFAULT 'direct-url',
  -- { discoveryUrl, landingUrl?, downloadUrl, resolvedArtifactUrl, redirectCount }
  resolution_chain jsonb NOT NULL DEFAULT '{}'::jsonb,

  extraction_status text NOT NULL DEFAULT 'pending'
    CHECK (extraction_status IN ('pending', 'ok', 'below-threshold', 'failed')),
  -- Corpus Scout's own provenance store holds the extracted content (PRD-ICA-001
  -- §6: "the retrieval-chain / byte-hash detail stays in Corpus Scout's own
  -- provenance store — addEvidence's EvidenceRow schema is not extended").
  normalized_text text NOT NULL DEFAULT '',
  extraction_warnings jsonb NOT NULL DEFAULT '[]'::jsonb,

  -- Duplicate/version handling (§8) — never delete a duplicate row, link it.
  duplicate_of_source_id text REFERENCES public.corpus_candidate_sources (source_id),

  human_review_notes text,

  -- Set ONLY once the Ingestion Broker successfully calls add-evidence — the
  -- no-double-ingest guard (PRD-ICA-001 §6, §17).
  evidence_row_id uuid REFERENCES public.discovery_evidence (id),

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS corpus_candidate_sources_campaign_idx
  ON public.corpus_candidate_sources (campaign_domain, review_workflow_status, created_at DESC);

CREATE INDEX IF NOT EXISTS corpus_candidate_sources_url_idx
  ON public.corpus_candidate_sources (canonical_url);

CREATE INDEX IF NOT EXISTS corpus_candidate_sources_artifact_hash_idx
  ON public.corpus_candidate_sources (artifact_hash);

CREATE INDEX IF NOT EXISTS corpus_candidate_sources_normalized_text_hash_idx
  ON public.corpus_candidate_sources (normalized_text_hash);

ALTER TABLE public.corpus_candidate_sources ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.corpus_candidate_sources IS
  'Corpus Scout (PRD-ICA-001) provenance store — one row per retrieved+inspected candidate artifact, whether it passed verification or not. Upstream of and separate from discovery_evidence; the Ingestion Broker links evidence_row_id once (never double-ingest) after human approval.';
COMMENT ON COLUMN public.corpus_candidate_sources.provenance_class IS
  'Evidence-integrity axis — the four values ratified in CRYSTAL-ENLARGEMENT_plan.md §2a. Distinct from, and composes with, review_workflow_status (PRD-ICA-001 §0.3).';
COMMENT ON COLUMN public.corpus_candidate_sources.review_workflow_status IS
  'Pipeline-state axis — what the human reviewer decided to do with this source (PRD-ICA-001 §8). Distinct from, and composes with, provenance_class.';
COMMENT ON COLUMN public.corpus_candidate_sources.artifact_hash IS
  'sha256 of the raw retrieved bytes. Separate from normalized_text_hash (§8) — original artifact and normalized derivative get distinct hashes.';
COMMENT ON COLUMN public.corpus_candidate_sources.evidence_row_id IS
  'Set once ingestApprovedSource() successfully calls addEvidence() for this source. A non-null value refuses further ingestion (no double-ingest, §6/§17).';
