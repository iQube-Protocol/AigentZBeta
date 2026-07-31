-- 20260829000000_commercialisation_law_ii_closure.sql
--
-- Operator RULING on Law II, 2026-07-27:
--
--   "Do not waive Law II. Add a second authority from a different tradition
--    for each pillar."
--
-- `partnerships` (Kauffman Foundation only) and `outcome-assurance` (INCOSE
-- only) each carried exactly ONE institutional authority and therefore failed
-- Law II's registry-time check. Neither is closed by lowering a threshold —
-- `LAW_II_MIN_AUTHORITIES` and `LAW_II_MIN_TRADITIONS` are unchanged at 2, and
-- both attempts to move them are mutation-tested. Each pillar gains a second
-- authority from a genuinely different institutional tradition.
--
-- A NEW migration, not an edit: `20260827000000` and `20260828000000` have
-- been RUN. Applied SQL is never edited; additive SQL is appended.
--
-- NOTHING IS RATIFIED AND NOTHING IS VERIFIED HERE. Both rows land
-- `status = 'proposed'`, `verification_status = 'pending_verification'`. The
-- operator live-checked both URLs in a browser; that is explicitly NOT
-- verification under SPEC-CIR-001 §9 — only the four-conjunct Corpus Scout
-- inspection run on the deployed app may award `verified`, and
-- `applyVerificationOutcome` refuses the transition from any state but
-- `pending_verification`.
--
-- Additive and idempotent (CFS-010 §3): every statement is ON CONFLICT DO
-- NOTHING. Re-running changes nothing, un-ratifies nothing, and un-verifies
-- nothing.

-- ── 1 · The two closing authorities ────────────────────────────────────────
--
-- partnerships / NBER — a THIRD pillar for an institution already serving
-- `pricing` and `commercial-failure-modes`, which is the reuse the earlier
-- ruling prefers ("Reuse is preferable to inventing a new institution merely
-- to make the matrix look complete"). Its tradition for THIS pillar is
-- 'Academic Economics / Empirical Entrepreneurship Research' — deliberately
-- NOT Kauffman's 'Entrepreneurship Research', because Law II counts DISTINCT
-- traditions per pillar and reusing Kauffman's label would leave
-- `partnerships` unsatisfied with two authorities on the board.
--
-- outcome-assurance / NISTA — the National Infrastructure and Service
-- Transformation Authority, the current body formed from the Infrastructure
-- and Projects Authority and the National Infrastructure Commission. An
-- independent public project-delivery assurance tradition beside INCOSE's
-- systems-engineering one. Same evidence type (standards), different
-- tradition — and tradition is what Law II counts.
--
-- The traditions themselves live in
-- `services/corpusScout/institutionalRegistry.ts` (the registry table carries
-- institution + pillar + tier; the template carries the classification), and
-- the two are pinned to each other by
-- `tests/commercialisation-institutional-registry.test.ts`.

INSERT INTO public.corpus_institutional_registry
  (domain, pillar_key, institution_name, source_tier, status, verification_status)
VALUES
  ('commercialisation', 'partnerships', 'NBER', 'institutional-authority', 'proposed', 'pending_verification'),
  ('commercialisation', 'outcome-assurance', 'National Infrastructure and Service Transformation Authority', 'institutional-authority', 'proposed', 'pending_verification')
ON CONFLICT (domain, pillar_key, institution_name) DO NOTHING;

-- ── 2 · Their acquisition seeds ────────────────────────────────────────────
--
-- INSTITUTIONAL LINEAGE, RECORDED SO A FUTURE REVIEWER DOES NOT "CORRECT" IT:
-- the NISTA seed's path says `infrastructure-and-projects-authority` while its
-- institution is NISTA. That is deliberate and correct — NISTA inherits IPA's
-- assurance material — but the path does not match the institution's name, and
-- a naive audit would read that as an error and "fix" a URL that is right. The
-- mismatch is explained in the claim text itself so the explanation travels
-- with the row rather than living only in a migration comment.
--
-- Both claims stay prefixed 'Operator claim:' — the operator's descriptions
-- are claims pending verification, never measurements this system made.

INSERT INTO public.corpus_acquisition_seeds
  (domain, pillar_key, institution_name, document_url, claim, verification_status)
VALUES
  ('commercialisation', 'partnerships', 'NBER',
   'https://www.nber.org/papers/w17181',
   'Operator claim: "Business Partners, Financing, and the Commercialization of Inventions" — studies how partners affect commercialisation probability and revenue outcomes. Operator note: "unusually well targeted… supports the pillar without relying on generic partnership commentary."',
   'pending_verification'),
  ('commercialisation', 'outcome-assurance', 'National Infrastructure and Service Transformation Authority',
   'https://www.gov.uk/government/collections/infrastructure-and-projects-authority-assurance-review-toolkit',
   'Operator claim: assurance review toolkit — independent review guidance across strategic assessment, business justification, delivery strategy, readiness for service, operations and benefits realisation. LINEAGE (do not "correct"): the collection path says infrastructure-and-projects-authority while the institution is NISTA, because NISTA is the current body formed from the Infrastructure and Projects Authority and the National Infrastructure Commission and inherits IPA''s assurance material.',
   'pending_verification')
ON CONFLICT (domain, pillar_key, institution_name, document_url) DO NOTHING;
