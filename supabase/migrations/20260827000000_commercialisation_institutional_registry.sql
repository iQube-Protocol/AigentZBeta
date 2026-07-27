-- 20260827000000_commercialisation_institutional_registry.sql
--
-- Phase 1 of the operator direction of 2026-07-27 — the CURATED, RATIFIED-LATER
-- Commercialisation Institutional Registry. Specified in
-- `codexes/packs/irl/foundation/SPEC-CIR-001_commercialisation-institutional-registry.md`;
-- the curated input it is generated from is
-- `services/corpusScout/institutionalRegistry.ts` (pinned to this file by
-- `tests/commercialisation-institutional-registry.test.ts`).
--
--   "Commercialisation should not begin with open-ended web search. It should
--    begin with a curated, ratified corpus of authoritative commercialisation
--    sources… The IDE derives invariants from the corpus. It does not define
--    the corpus."
--
-- NOTHING HERE IS RATIFIED. Every row lands `proposed`, which is the whole
-- point: Phase 1 produces the registry, Phase 2 is the steward's ratification
-- act (`ratifyDomainDefinition` / `ratifyCoveragePillar` /
-- `ratifyDependencyEntry` / `ratifyInstitutionEntry`, all admin-gated through
-- `POST /api/corpus-scout/domain-constitution`). This differs deliberately
-- from the Financial Services seed in `20260817000000`, which landed
-- `ratified` because the operator had already ratified those tables in the
-- amendment document itself.
--
-- Additive and idempotent (CFS-010 §3): every statement is IF NOT EXISTS or
-- ON CONFLICT DO NOTHING. Re-running changes nothing and un-ratifies nothing.

-- ── 1 · The tier column — making the tier-1/tier-2 boundary STRUCTURAL ──────
--
-- The operator's direction separates a first tier of institutional authorities
-- from a second tier of practitioner sources that "are not primary scientific
-- authorities". That distinction has to survive into SQL-level analysis: a
-- later query that treats a consultancy insight piece as equivalent evidence
-- to an NBER working paper is a serious methodological error, and prose in a
-- notes field cannot prevent it.
--
-- NULLABLE with NO default, on purpose. A row that does not declare a tier is
-- UNDECLARED, not assumed-authoritative — `assessRegistryDiversity` refuses to
-- count it toward Law II. Fail-closed. The already-ratified Financial Services
-- rows are backfilled explicitly below, because they genuinely are the
-- institutional-authority tier.

ALTER TABLE public.corpus_institutional_registry
  ADD COLUMN IF NOT EXISTS source_tier text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'corpus_institutional_registry_source_tier_check'
  ) THEN
    ALTER TABLE public.corpus_institutional_registry
      ADD CONSTRAINT corpus_institutional_registry_source_tier_check
      CHECK (source_tier IS NULL OR source_tier IN ('institutional-authority', 'practitioner-pattern'));
  END IF;
END $$;

COMMENT ON COLUMN public.corpus_institutional_registry.source_tier IS
  'SPEC-CIR-001 §3 — institutional-authority (primary, acquired first) vs practitioner-pattern (operational patterns, compared against the academic corpus, never equivalent evidence). NULL = undeclared, never counted as an authority.';

UPDATE public.corpus_institutional_registry
   SET source_tier = 'institutional-authority'
 WHERE domain = 'financial-services' AND source_tier IS NULL;

-- ── 2 · Domain Definition (§2.1) ────────────────────────────────────────────
-- PRD-IDE-002 §1's operator-supplied definition, verbatim.

INSERT INTO public.corpus_domain_definitions (domain, purpose, status)
VALUES (
  'commercialisation',
  'Commercialisation is the discovery of recurring structural patterns governing the creation, delivery, adoption, exchange and sustainable capture of value across domains.',
  'proposed'
)
ON CONFLICT (domain) DO NOTHING;

-- ── 3 · Constitutional Coverage Model (§2.2) ────────────────────────────────
-- PRD-IDE-002 §7.2: "propose the fourteen §4 sub-domains as coverage pillars".
-- The completeness definition binds Law II into saturation: a pillar is not
-- complete on one authority, however good.

INSERT INTO public.corpus_coverage_pillars (domain, pillar_key, pillar_label, completeness_definition, status)
VALUES
  ('commercialisation', 'value-proposition', 'Value Proposition', 'Institutional-authority sources on what the offer asserts it preserves or creates, and how that assertion is structured — from at least two distinct institutional traditions (Law II).', 'proposed'),
  ('commercialisation', 'customer-discovery', 'Customer Discovery & Fit', 'Institutional-authority sources on how a commercial system identifies who it is for and detects that it has found them — from at least two distinct institutional traditions (Law II).', 'proposed'),
  ('commercialisation', 'trust-formation', 'Trust Formation', 'Institutional-authority sources on how warranted confidence is established between parties before value moves — from at least two distinct institutional traditions (Law II).', 'proposed'),
  ('commercialisation', 'pricing', 'Pricing', 'Institutional-authority sources on how value is denominated, tiered, discounted and steered — from at least two distinct institutional traditions (Law II).', 'proposed'),
  ('commercialisation', 'distribution', 'Distribution & Go-to-Market', 'Institutional-authority sources on how the offer reaches an audience — channels, sequences, cohorts, segments — from at least two distinct institutional traditions (Law II).', 'proposed'),
  ('commercialisation', 'adoption', 'Adoption', 'Institutional-authority sources on how a party moves through the states of using the offer — from at least two distinct institutional traditions (Law II).', 'proposed'),
  ('commercialisation', 'revenue-architecture', 'Revenue Architecture', 'Institutional-authority sources on where revenue originates and how offers compose without cannibalising each other — from at least two distinct institutional traditions (Law II).', 'proposed'),
  ('commercialisation', 'settlement-exchange', 'Settlement & Exchange', 'Institutional-authority sources on how value actually transfers — rails, adapters, attribution, integrity — from at least two distinct institutional traditions (Law II).', 'proposed'),
  ('commercialisation', 'partnerships', 'Partnerships & Ecosystem Development', 'Institutional-authority sources on how third parties are qualified, sequenced and grown into the system — from at least two distinct institutional traditions (Law II).', 'proposed'),
  ('commercialisation', 'outcome-assurance', 'Outcome Assurance & Retention', 'Institutional-authority sources on how delivered outcome is measured, sustained and kept — from at least two distinct institutional traditions (Law II).', 'proposed'),
  ('commercialisation', 'scaling', 'Scaling', 'Institutional-authority sources on how delivery is repeated without linear cost, and what the repeatable unit is — from at least two distinct institutional traditions (Law II).', 'proposed'),
  ('commercialisation', 'venture-operations', 'Venture Operations', 'Institutional-authority sources on how the commercialising organisation itself is structured and progressed — from at least two distinct institutional traditions (Law II).', 'proposed'),
  ('commercialisation', 'commercial-governance', 'Commercial Governance', 'Institutional-authority sources on the authority, attribution and disclosure rules that govern commercial action — from at least two distinct institutional traditions (Law II).', 'proposed'),
  ('commercialisation', 'commercial-failure-modes', 'Commercial Failure Modes', 'Institutional-authority sources on the recurring shapes of commercial failure and what they constrain afterwards — from at least two distinct institutional traditions (Law II).', 'proposed')
ON CONFLICT (domain, pillar_key) DO NOTHING;

-- ── 4 · Constitutional Dependency Registry (§2.3) — where the DISCIPLINES go ─
--
-- The operator's third tier is DISCIPLINES, not institutions: "Organisation
-- design · Behavioural economics · Network science · Platform economics ·
-- Complexity science · Diffusion of innovation · Service science · Operations
-- management". They cannot be institutional rows — a discipline has no
-- homepage, publishes nothing, and cannot be navigated to, so registering one
-- as an institution would break seed-URL resolution for a row that could never
-- resolve. Law I leaves exactly two homes; a discipline does not CONSTITUTE
-- commercialisation, it CONSTRAINS/EXPLAINS it — so: here, each with its edge.
--
-- Ten from PRD-IDE-002 §7.3 plus six of the operator's eight. "Platform
-- economics" and "Operations management" are already present as
-- `platform-economics` and `operations` and are NOT duplicated.

INSERT INTO public.corpus_dependency_registry (domain, dependency_name, relationship, status)
VALUES
  ('commercialisation', 'financial-services', 'compared against', 'proposed'),
  ('commercialisation', 'economics', 'explained by', 'proposed'),
  ('commercialisation', 'operations', 'explained by', 'proposed'),
  ('commercialisation', 'product-management', 'compared against', 'proposed'),
  ('commercialisation', 'organisational-behaviour', 'explained by', 'proposed'),
  ('commercialisation', 'systems-engineering', 'explained by', 'proposed'),
  ('commercialisation', 'service-design', 'compared against', 'proposed'),
  ('commercialisation', 'innovation-management', 'compared against', 'proposed'),
  ('commercialisation', 'entrepreneurship', 'compared against', 'proposed'),
  ('commercialisation', 'platform-economics', 'explained by', 'proposed'),
  ('commercialisation', 'organisation-design', 'explained by', 'proposed'),
  ('commercialisation', 'behavioural-economics', 'explained by', 'proposed'),
  ('commercialisation', 'network-science', 'explained by', 'proposed'),
  ('commercialisation', 'complexity-science', 'explained by', 'proposed'),
  ('commercialisation', 'diffusion-of-innovation', 'explained by', 'proposed'),
  ('commercialisation', 'service-science', 'explained by', 'proposed')
ON CONFLICT (domain, dependency_name) DO NOTHING;

-- ── 5 · Institutional Registry (§3) — TIER 1 ONLY ───────────────────────────
--
-- The operator's fifteen first-tier institutions, expanded to one row per
-- (pillar, institution) pair — 28 rows. `seed_url` is left NULL and resolved
-- from `services/corpusScout/canonicalInstitutionHomepages.ts`, which holds
-- the operator-supplied URLs; `ensureInstitutionSeedUrl` persists the resolved
-- value onto the row on first use, so the URL becomes visible, auditable
-- provenance rather than a silent runtime fallback.
--
-- The pillar assignment is AGENT-PROPOSED (SPEC-CIR-001 §4 argues each one
-- from the operator's own Category/Purpose text). Five pillars — trust-
-- formation, pricing, distribution, settlement-exchange, commercial-failure-
-- modes — receive NO institution, because the operator's list supplies no
-- basis for one and inventing one would be fabrication. That is a finding, not
-- an omission (SPEC-CIR-001 §5).
--
-- The operator's SECOND tier is deliberately NOT seeded. No URL and no pillar
-- was supplied for any of the nine, and `upsertInstitutionEntry` refuses an
-- entry whose pillar does not exist — so a practitioner source structurally
-- cannot enter the corpus until a steward assigns it one. That is exactly the
-- "once the institutional corpus has been exhausted" gate, enforced by the
-- shape of the data instead of by a reviewer's memory.

INSERT INTO public.corpus_institutional_registry (domain, pillar_key, institution_name, source_tier, status)
VALUES
  ('commercialisation', 'venture-operations', 'NBER', 'institutional-authority', 'proposed'),
  ('commercialisation', 'adoption', 'NBER', 'institutional-authority', 'proposed'),
  ('commercialisation', 'venture-operations', 'Kauffman Foundation', 'institutional-authority', 'proposed'),
  ('commercialisation', 'partnerships', 'Kauffman Foundation', 'institutional-authority', 'proposed'),
  ('commercialisation', 'venture-operations', 'SSRN', 'institutional-authority', 'proposed'),
  ('commercialisation', 'adoption', 'SSRN', 'institutional-authority', 'proposed'),
  ('commercialisation', 'adoption', 'OECD', 'institutional-authority', 'proposed'),
  ('commercialisation', 'scaling', 'OECD', 'institutional-authority', 'proposed'),
  ('commercialisation', 'venture-operations', 'World Bank', 'institutional-authority', 'proposed'),
  ('commercialisation', 'commercial-governance', 'World Bank', 'institutional-authority', 'proposed'),
  ('commercialisation', 'adoption', 'MIT Sloan', 'institutional-authority', 'proposed'),
  ('commercialisation', 'venture-operations', 'MIT Sloan', 'institutional-authority', 'proposed'),
  ('commercialisation', 'scaling', 'Stanford Graduate School of Business', 'institutional-authority', 'proposed'),
  ('commercialisation', 'venture-operations', 'Stanford Graduate School of Business', 'institutional-authority', 'proposed'),
  ('commercialisation', 'revenue-architecture', 'Harvard Business School', 'institutional-authority', 'proposed'),
  ('commercialisation', 'adoption', 'Harvard Business School', 'institutional-authority', 'proposed'),
  ('commercialisation', 'revenue-architecture', 'Strategic Management Society', 'institutional-authority', 'proposed'),
  ('commercialisation', 'commercial-governance', 'Strategic Management Society', 'institutional-authority', 'proposed'),
  ('commercialisation', 'scaling', 'Santa Fe Institute', 'institutional-authority', 'proposed'),
  ('commercialisation', 'outcome-assurance', 'INCOSE', 'institutional-authority', 'proposed'),
  ('commercialisation', 'commercial-governance', 'INCOSE', 'institutional-authority', 'proposed'),
  ('commercialisation', 'customer-discovery', 'Silicon Valley Product Group', 'institutional-authority', 'proposed'),
  ('commercialisation', 'value-proposition', 'Silicon Valley Product Group', 'institutional-authority', 'proposed'),
  ('commercialisation', 'customer-discovery', 'Product School', 'institutional-authority', 'proposed'),
  ('commercialisation', 'value-proposition', 'Product School', 'institutional-authority', 'proposed'),
  ('commercialisation', 'value-proposition', 'Strategyzer', 'institutional-authority', 'proposed'),
  ('commercialisation', 'revenue-architecture', 'Strategyzer', 'institutional-authority', 'proposed'),
  ('commercialisation', 'customer-discovery', 'Lean Startup', 'institutional-authority', 'proposed')
ON CONFLICT (domain, pillar_key, institution_name) DO NOTHING;
