-- 20260828000000_corpus_registry_verification.sql
--
-- Operator RULING, 2026-07-27, on SPEC-CIR-001:
--
--   "Do not waive the five empty pillars, and do not ratify the
--    Commercialisation Institutional Registry yet. Populate them with
--    authoritative sources, land the registry-level verification protocol, run
--    verification on the deployed app, and only then ratify."
--
-- Three things, in one additive/idempotent migration (CFS-010 §3):
--   1. Registry-level VERIFICATION state on corpus_institutional_registry.
--   2. corpus_acquisition_seeds — the document-level acquisition plan, the
--      missing half of PRD-ICA-001 §5's Corpus Acquisition Plan.
--   3. Wave 2 of the Commercialisation registry: the ten institution-pillar
--      entries and seventeen acquisition seeds that close the five empty
--      pillars.
--
-- NOTHING IS RATIFIED AND NOTHING IS VERIFIED HERE. Every new row lands
-- `status = 'proposed'`. Every URL lands `verification_status =
-- 'pending_verification'`, per the operator's explicit instruction: "Do not
-- treat the URLs as verified merely because they are operator-supplied or
-- resolve in an ordinary browser." Only a completed verification RUN on the
-- deployed app can write 'verified' — `applyVerificationOutcome` refuses the
-- transition from any state but 'pending_verification'.

-- ── 1 · Verification state on the registry row ──────────────────────────────
--
-- ORTHOGONAL to `status` (proposed | ratified), which is a steward's
-- acceptance of the AUTHORITY. Verification is a machine's finding about the
-- URL. An entry can be ratified and verification_failed; collapsing the two
-- would make a dead link indistinguishable from an unapproved one.
--
-- Nullable with NO default on the CHECK'd column, same fail-closed discipline
-- as source_tier: an unrecognised or missing value is NOT 'verified', so the
-- discovery gate stays shut. The seeding statements below set
-- 'pending_verification' explicitly rather than relying on a default.

ALTER TABLE public.corpus_institutional_registry
  ADD COLUMN IF NOT EXISTS verification_status text,
  ADD COLUMN IF NOT EXISTS verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS verification_checked_at timestamptz,
  ADD COLUMN IF NOT EXISTS resolved_url text,
  ADD COLUMN IF NOT EXISTS verification_detail jsonb;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'corpus_institutional_registry_verification_status_check') THEN
    ALTER TABLE public.corpus_institutional_registry
      ADD CONSTRAINT corpus_institutional_registry_verification_status_check
      CHECK (verification_status IS NULL OR verification_status IN (
        'proposed', 'pending_verification', 'verified', 'verification_failed',
        'insufficient_corpus', 'temporarily_unavailable', 'redirect_changed', 'deprecated'
      ));
  END IF;
END $$;

COMMENT ON COLUMN public.corpus_institutional_registry.verification_status IS
  'SPEC-CIR-001 §9 — does this URL still lead to a qualifying corpus? Orthogonal to status. Only ''verified'' opens the discovery gate; NULL and every other value refuse.';

-- Existing rows (financial-services + Commercialisation wave 1) have never
-- been verified. They enter the protocol as `proposed` — NOT as verified, and
-- NOT as failed. This is the honest starting state, and it has a real
-- operational consequence the operator must know: Financial Services
-- institutional discovery will REFUSE until an FS verification run completes.
-- That is the gate working, not a regression.
UPDATE public.corpus_institutional_registry
   SET verification_status = 'proposed'
 WHERE verification_status IS NULL;

-- ── 2 · corpus_acquisition_seeds — the document-level acquisition plan ──────
--
-- Why a new table rather than `corpus_institutional_registry.seed_url`:
-- seed_url is ONE navigation entry point per institution — Agent B fetches it
-- and walks its links. A publication URL TERMINATES navigation rather than
-- starting it, there are several per institution, and each carries its own
-- claim and its own verification state. Overloading seed_url would break
-- Agent B's contract and collapse several documents into one.
--
-- Why not a candidate source: `createCandidateSource` retrieves and hashes
-- bytes. A candidate row without them asserts a Level-4 acquisition that never
-- happened (PRD-ICA-001 §2). A seed is a PLAN, not an acquisition.
--
-- PRD-ICA-001 §5 already specifies the Corpus Acquisition Plan — "target
-- source types, likely primary institutions… indicative document count,
-- priority". Only its INSTITUTION half was ever persisted. This is the
-- document half, which was always specified and never had a table.

CREATE TABLE IF NOT EXISTS public.corpus_acquisition_seeds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain text NOT NULL,
  pillar_key text NOT NULL,
  institution_name text NOT NULL,
  document_url text NOT NULL,
  -- The operator's own description of the document, recorded AS A CLAIM. Never
  -- a measured fact: a page count that comes back different on verification is
  -- a finding, and it can only be a finding if the claim was written first.
  claim text NOT NULL DEFAULT '',
  verification_status text,
  verification_checked_at timestamptz,
  resolved_url text,
  content_hash text,
  -- Set once this seed has produced a real candidate source through the normal
  -- retrieval pipeline. Until then the seed is a plan, nothing more.
  candidate_source_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (domain, pillar_key, institution_name, document_url)
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'corpus_acquisition_seeds_verification_status_check') THEN
    ALTER TABLE public.corpus_acquisition_seeds
      ADD CONSTRAINT corpus_acquisition_seeds_verification_status_check
      CHECK (verification_status IS NULL OR verification_status IN (
        'proposed', 'pending_verification', 'verified', 'verification_failed',
        'insufficient_corpus', 'temporarily_unavailable', 'redirect_changed', 'deprecated'
      ));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS corpus_acquisition_seeds_domain_idx
  ON public.corpus_acquisition_seeds (domain, pillar_key);

ALTER TABLE public.corpus_acquisition_seeds ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.corpus_acquisition_seeds IS
  'SPEC-CIR-001 §7 — the document half of PRD-ICA-001 §5''s Corpus Acquisition Plan: planned target documents per (pillar, institution). NOT institutional seed URLs (that is corpus_institutional_registry.seed_url, one navigation entry point per institution) and NOT candidate sources (those carry retrieved, hashed bytes).';

-- ── 3 · Commercialisation registry, WAVE 2 ─────────────────────────────────
--
-- The operator's ruling closes the five pillars SPEC-CIR-001 §5 reported as
-- empty. Institutions, traditions, evidence types, URLs AND pillars are the
-- operator's — unlike wave 1, these mappings were supplied, not inferred.
--
-- OECD gains two more pillars and NBER two more, each under a DIFFERENT
-- institutional tradition: "The existing institutions may serve more than one
-- pillar where their published corpus genuinely supports it. Reuse is
-- preferable to inventing a new institution merely to make the matrix look
-- complete. The provenance must attach to the specific pillar and acquired
-- document."
--
-- BIS CPMI is reused from the Financial Services registry; its seed URL stays
-- the more specific https://www.bis.org/cpmi/ already in the curated homepage
-- directory rather than the operator's parent https://www.bis.org — same
-- institution, better starting page for Agent B, no duplicate key.

INSERT INTO public.corpus_institutional_registry
  (domain, pillar_key, institution_name, source_tier, status, verification_status)
VALUES
  ('commercialisation', 'trust-formation', 'OECD', 'institutional-authority', 'proposed', 'pending_verification'),
  ('commercialisation', 'trust-formation', 'UK Competition and Markets Authority', 'institutional-authority', 'proposed', 'pending_verification'),
  ('commercialisation', 'pricing', 'NBER', 'institutional-authority', 'proposed', 'pending_verification'),
  ('commercialisation', 'pricing', 'OECD', 'institutional-authority', 'proposed', 'pending_verification'),
  ('commercialisation', 'distribution', 'World Trade Organization', 'institutional-authority', 'proposed', 'pending_verification'),
  ('commercialisation', 'distribution', 'UN Trade and Development (UNCTAD)', 'institutional-authority', 'proposed', 'pending_verification'),
  ('commercialisation', 'settlement-exchange', 'BIS Committee on Payments and Market Infrastructures', 'institutional-authority', 'proposed', 'pending_verification'),
  ('commercialisation', 'settlement-exchange', 'UNCITRAL', 'institutional-authority', 'proposed', 'pending_verification'),
  ('commercialisation', 'commercial-failure-modes', 'NBER', 'institutional-authority', 'proposed', 'pending_verification'),
  ('commercialisation', 'commercial-failure-modes', 'U.S. Bureau of Labor Statistics', 'institutional-authority', 'proposed', 'pending_verification')
ON CONFLICT (domain, pillar_key, institution_name) DO NOTHING;

-- Wave 1 rows move from 'proposed' to 'pending_verification' too — the whole
-- Commercialisation registry is submitted for verification together, and the
-- ratification bar is domain-wide.
UPDATE public.corpus_institutional_registry
   SET verification_status = 'pending_verification'
 WHERE domain = 'commercialisation' AND verification_status = 'proposed';

-- ── 4 · The acquisition seeds ──────────────────────────────────────────────
--
-- Seventeen operator-supplied target documents. `claim` records the operator's
-- own description verbatim, prefixed "Operator claim:" so no reader mistakes
-- it for something this system measured.

INSERT INTO public.corpus_acquisition_seeds
  (domain, pillar_key, institution_name, document_url, claim, verification_status)
VALUES
  ('commercialisation', 'trust-formation', 'OECD', 'https://www.oecd.org/en/publications/trust-in-peer-platform-markets_1a893b58-en.html', 'Operator claim: 76-page survey, 10,000 consumers, ten countries.', 'pending_verification'),
  ('commercialisation', 'trust-formation', 'OECD', 'https://www.oecd.org/en/publications/oecd-business-and-finance-outlook-2019_af784794-en.html', 'Operator claim: 140 pages, trust in business and online markets.', 'pending_verification'),
  ('commercialisation', 'trust-formation', 'UK Competition and Markets Authority', 'https://www.gov.uk/government/consultations/online-reviews-and-endorsements', 'Operator claim: 71-page findings report on reviews, endorsements, consumer reliance.', 'pending_verification'),
  ('commercialisation', 'pricing', 'NBER', 'https://www.nber.org/papers/w21679', 'Operator claim: "Pricing with Limited Knowledge of Demand".', 'pending_verification'),
  ('commercialisation', 'pricing', 'OECD', 'https://www.oecd.org/en/publications/personalised-pricing-in-the-digital-era_db4d9c9c-en.html', 'Operator claim: 49 pages.', 'pending_verification'),
  ('commercialisation', 'pricing', 'OECD', 'https://www.oecd.org/en/publications/algorithmic-pricing-and-competition-in-g7-jurisdictions_f36dacf8-en.html', 'Operator claim: 26 pages.', 'pending_verification'),
  ('commercialisation', 'distribution', 'World Trade Organization', 'https://www.wto.org/english/tratop_e/serv_e/distribution_e/distribution_e.htm', 'Operator claim: distribution-services gateway — wholesale, retail, franchising, commission agents, e-commerce.', 'pending_verification'),
  ('commercialisation', 'distribution', 'UN Trade and Development (UNCTAD)', 'https://unctad.org/topic/ecommerce-and-digital-economy/measuring-ecommerce-digital-economy', 'Operator claim: measuring e-commerce and the digital economy.', 'pending_verification'),
  ('commercialisation', 'distribution', 'UN Trade and Development (UNCTAD)', 'https://tft.unctad.org/en/publications/statistics-on-the-digital-economy-e-commerce-and-digital-trade-report-2025/', 'Operator claim: statistics on the digital economy, e-commerce and digital trade, 2025 report.', 'pending_verification'),
  ('commercialisation', 'settlement-exchange', 'BIS Committee on Payments and Market Infrastructures', 'https://www.bis.org/cpmi/publ/d216.htm', 'Operator claim: 33 pages, PvP adoption, settlement risk.', 'pending_verification'),
  ('commercialisation', 'settlement-exchange', 'BIS Committee on Payments and Market Infrastructures', 'https://www.bis.org/cpmi/publ/d202.htm', 'Operator claim: 65 pages, access to payment systems.', 'pending_verification'),
  ('commercialisation', 'settlement-exchange', 'UNCITRAL', 'https://uncitral.un.org/en/texts/ecommerce', 'Operator claim: electronic commerce texts.', 'pending_verification'),
  ('commercialisation', 'settlement-exchange', 'UNCITRAL', 'https://uncitral.un.org/en/texts/ecommerce/modellaw/electronic_commerce', 'Operator claim: Model Law on Electronic Commerce.', 'pending_verification'),
  ('commercialisation', 'settlement-exchange', 'UNCITRAL', 'https://uncitral.un.org/en/texts/ecommerce/modellaw/electronic_transferable_records', 'Operator claim: Model Law on Electronic Transferable Records.', 'pending_verification'),
  ('commercialisation', 'commercial-failure-modes', 'NBER', 'https://www.nber.org/papers/w19679', 'Operator claim: "Deals Not Done: Sources of Failure in the Market for Ideas".', 'pending_verification'),
  ('commercialisation', 'commercial-failure-modes', 'NBER', 'https://www.nber.org/papers/w34755', 'Operator claim: randomized evidence on venture shutdown, survival, "rational quitting".', 'pending_verification'),
  ('commercialisation', 'commercial-failure-modes', 'U.S. Bureau of Labor Statistics', 'https://www.bls.gov/osmr/research-papers/2004/st040060.htm', 'Operator claim: establishment survival, Business Employment Dynamics.', 'pending_verification')
ON CONFLICT (domain, pillar_key, institution_name, document_url) DO NOTHING;
