-- 20260903000000_bis_cpmi_reseed_publication_index.sql
--
-- BIS CPMI re-seed (operator ruling, 2026-07-28).
--
-- WHAT WAS WRONG. Migration 20260828000000 seeded the CPMI institution's
-- acquisition seeds as two INDIVIDUAL documents — `cpmi/publ/d216.htm` and
-- `cpmi/publ/d202.htm` — and both 404. The operator's correction is a rule,
-- not merely a URL swap:
--
--   "The canonical BIS seed should point to the official CPMI publications,
--    not a guessed document URL. … This avoids hard-coding an individual
--    report, so new CPMI papers become discoverable automatically while
--    keeping the seed anchored to the official BIS publication index."
--
-- A pinned document seed is brittle twice: it dies when the document moves,
-- and it can never surface anything published after the day it was written.
-- An index seed is self-renewing. This applies to every institutional seed,
-- not just this one.
--
-- WHAT THIS MIGRATION DOES.
--   1. Clears the stale `seed_url` on the CPMI registry row so
--      `ensureInstitutionSeedUrl` / `verifyInstitutionEntry` re-resolve it
--      from `canonicalInstitutionHomepages.ts`, which now carries the
--      operator's landing page (the CPMI overview).
--   2. Replaces the two 404 document seeds in `corpus_acquisition_seeds` with
--      the operator-supplied publication INDEXES.
--   3. Resets the row's verification state to `proposed` so the next
--      verification run re-checks it against the corrected URL. It does NOT
--      set `verified` — that is the verifier's finding to make, never a
--      migration's assertion (the same discipline 20260902000000 records).
--
-- URLs are stored WITHOUT the `?utm_source=` tracking parameters they arrived
-- with: a tracking parameter is not part of the canonical resource, and
-- storing one would put a referral marker into the corpus provenance trail.

-- ── 1. Force seed-URL re-resolution ────────────────────────────────────────

-- SCOPED TO `commercialisation`. This institution ALSO holds a ratified
-- `financial-services / payments` row (migration 20260817000000). An unscoped
-- UPDATE here would reset that row's verification state too — un-verifying a
-- working Financial Services institution as a side effect of fixing a
-- Commercialisation seed. Every statement below carries the domain predicate.
UPDATE public.corpus_institutional_registry
SET seed_url = NULL,
    updated_at = now()
WHERE domain = 'commercialisation'
  AND institution_name = 'BIS Committee on Payments and Market Infrastructures';

-- ── 2. Retire the 404 document seeds ───────────────────────────────────────
--
-- Deleted rather than left in place: they are not "unavailable", they are the
-- wrong KIND of seed, and leaving them would have every future discovery run
-- re-attempt two URLs known not to resolve.

DELETE FROM public.corpus_acquisition_seeds
WHERE domain = 'commercialisation'
  AND institution_name = 'BIS Committee on Payments and Market Infrastructures'
  AND document_url IN (
    'https://www.bis.org/cpmi/publ/d216.htm',
    'https://www.bis.org/cpmi/publ/d202.htm'
  );

-- ── 3. Seed the publication indexes ────────────────────────────────────────

INSERT INTO public.corpus_acquisition_seeds
  (domain, pillar_key, institution_name, document_url, claim, verification_status)
VALUES
  ('commercialisation', 'settlement-exchange', 'BIS Committee on Payments and Market Infrastructures',
   'https://www.bis.org/list/cpmi/tid_10/index.htm',
   'Operator claim: the canonical CPMI publications listing (primary seed).',
   'pending_verification'),
  ('commercialisation', 'settlement-exchange', 'BIS Committee on Payments and Market Infrastructures',
   'https://www.bis.org/cpmi/cross_border/publications.htm',
   'Operator claim: CPMI cross-border payments publications — interoperability, ISO 20022 harmonisation, standards.',
   'pending_verification'),
  ('commercialisation', 'settlement-exchange', 'BIS Committee on Payments and Market Infrastructures',
   'https://www.bis.org/publ/cmtpubl.htm',
   'Operator claim: BIS committee publications index, linking the major CPMI collections.',
   'pending_verification')
ON CONFLICT DO NOTHING;

-- ── 4. Re-open verification ────────────────────────────────────────────────

UPDATE public.corpus_institutional_registry
SET verification_status = 'proposed',
    verified_at = NULL,
    updated_at = now()
WHERE domain = 'commercialisation'
  AND institution_name = 'BIS Committee on Payments and Market Infrastructures';
