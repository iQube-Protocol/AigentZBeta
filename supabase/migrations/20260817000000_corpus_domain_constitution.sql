-- 20260817000000_corpus_domain_constitution.sql
--
-- Corpus Scout (PRD-ICA-001) amendment — "Constitutional Discovery" (Phase 1):
-- codexes/packs/agentiq/updates/2026-07-23_prd-ica-001-amendment-constitutional-discovery-domain-architect.md
-- (RATIFIED 2026-07-23). Establishes the CONSTITUTIONAL SUBSTRATE Agent 0 (the
-- Domain Architect) produces, ahead of any acquisition:
--
--   corpus_domain_definitions    — §2.1: what the domain IS (one row per domain).
--   corpus_coverage_pillars      — §2.2: the Constitutional Coverage Model —
--                                  internal pillars, each with a completeness
--                                  definition (renamed from "Coverage Model" —
--                                  disambiguates from search/dataset coverage).
--   corpus_dependency_registry   — §2.3: the Constitutional Dependency Registry —
--                                  external domains that govern/measure/constrain
--                                  this one without being part of it (renamed
--                                  from "Adjacent Domain Registry" — the
--                                  relationships are constitutional dependencies,
--                                  not spatial adjacency).
--   corpus_institutional_registry — §3: Agent A's output, keyed to a ratified
--                                  pillar — the per-pillar authority list.
--
-- Law I of Constitutional Discovery (§2.0): every lane either CONSTITUTES the
-- domain (→ corpus_coverage_pillars) or CONSTRAINS it (→
-- corpus_dependency_registry). No third case, no shared table.
--
-- Ratification model: every artifact here carries the SAME two-state lifecycle
-- (proposed → ratified) rather than four different workflows — Agent 0/A
-- *propose*, a steward *ratifies* (PRD-ICA-001 §9/§11's human-approval ethos;
-- CFS-045-A1's validated/candidate tier distinction mirrors the same shape).
-- No auto-ratification path exists anywhere in this migration.
--
-- T0/T2 discipline: no caseId/personaId/authProfileId is ever stored on these
-- rows except `ratified_by`, which holds the STEWARD's own persona id (T1-safe
-- self-attribution of their own ratifying action — the same exposure class
-- CLAUDE.md's "owner self-view exception" already covers, not a new T0 leak).
-- Service-role access only; RLS enabled with no client policies, matching
-- corpus_candidate_sources / discovery_evidence. Additive/idempotent (CFS-010 §3).

CREATE TABLE IF NOT EXISTS public.corpus_domain_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain text NOT NULL UNIQUE,               -- e.g. 'financial-services' — matches campaign_domain elsewhere
  purpose text NOT NULL DEFAULT '',          -- the ratified "what is this domain" statement (§2.1)
  status text NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed', 'ratified')),
  ratified_by uuid,                          -- steward persona id (T1 self-attribution only)
  ratified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.corpus_coverage_pillars (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain text NOT NULL,
  pillar_key text NOT NULL,                  -- e.g. 'banking' — stable key, also used as campaignSubDomain
  pillar_label text NOT NULL,                -- e.g. 'Banking' — display label
  completeness_definition text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed', 'ratified')),
  ratified_by uuid,
  ratified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (domain, pillar_key)
);

CREATE TABLE IF NOT EXISTS public.corpus_dependency_registry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain text NOT NULL,
  dependency_name text NOT NULL,             -- e.g. 'Contract Law'
  relationship text NOT NULL DEFAULT '',     -- e.g. 'governed by' -- the edge label (§2.3), never omitted
  status text NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed', 'ratified')),
  ratified_by uuid,
  ratified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (domain, dependency_name)
);

-- Generated FROM the ratified Coverage Model (§3) — pillar_key must reference
-- an existing corpus_coverage_pillars row for the same domain; enforced at the
-- service layer (never lets an institution attach to an unratified/nonexistent
-- pillar), not by a DB foreign key, since pillar_key is a natural key shared
-- across two tables rather than a surrogate id relationship.
CREATE TABLE IF NOT EXISTS public.corpus_institutional_registry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain text NOT NULL,
  pillar_key text NOT NULL,
  institution_name text NOT NULL,            -- e.g. 'FATF'
  status text NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed', 'ratified')),
  ratified_by uuid,
  ratified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (domain, pillar_key, institution_name)
);

CREATE INDEX IF NOT EXISTS corpus_coverage_pillars_domain_idx ON public.corpus_coverage_pillars (domain);
CREATE INDEX IF NOT EXISTS corpus_dependency_registry_domain_idx ON public.corpus_dependency_registry (domain);
CREATE INDEX IF NOT EXISTS corpus_institutional_registry_domain_idx ON public.corpus_institutional_registry (domain, pillar_key);

ALTER TABLE public.corpus_domain_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.corpus_coverage_pillars ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.corpus_dependency_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.corpus_institutional_registry ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.corpus_domain_definitions IS
  'PRD-ICA-001 amendment §2.1 — the ratified "what is this domain" statement the Constitutional Coverage Model is constrained by.';
COMMENT ON TABLE public.corpus_coverage_pillars IS
  'PRD-ICA-001 amendment §2.2 — Constitutional Coverage Model: internal pillars that CONSTITUTE the domain (Law I, §2.0).';
COMMENT ON TABLE public.corpus_dependency_registry IS
  'PRD-ICA-001 amendment §2.3 — Constitutional Dependency Registry: external domains that CONSTRAIN this one (Law I, §2.0) without being part of it. Lightweight edge (name + relationship) only -- never a mandate to acquire the dependency''s own corpus.';
COMMENT ON TABLE public.corpus_institutional_registry IS
  'PRD-ICA-001 amendment §3 — Institutional Registry, generated from (keyed to) the ratified Constitutional Coverage Model''s pillars.';

-- ── Seed: the ratified financial-services first instance ───────────────────
-- The illustrative tables in the ratified amendment doc ARE the first
-- ratified content, not a placeholder example -- seeded here as already
-- `ratified` (ratified_by left NULL: this was operator-ratified in the
-- design document itself, before any steward UI existed to attribute it to
-- a persona; a steward editing these rows later re-ratifies under their own
-- id via the normal workflow, per the standard proposed->ratified path).

INSERT INTO public.corpus_domain_definitions (domain, purpose, status)
VALUES (
  'financial-services',
  'The systems governing the creation, movement, management, measurement, transfer, protection, and regulation of financial value.',
  'ratified'
)
ON CONFLICT (domain) DO NOTHING;

INSERT INTO public.corpus_coverage_pillars (domain, pillar_key, pillar_label, completeness_definition, status)
VALUES
  ('financial-services', 'banking', 'Banking', 'Core prudential/banking-regulation text per named jurisdiction in scope', 'ratified'),
  ('financial-services', 'payments', 'Payments', 'Governing payment-systems rules and settlement-finality frameworks', 'ratified'),
  ('financial-services', 'capital-markets', 'Capital Markets', 'Securities-issuance and trading-conduct regulation', 'ratified'),
  ('financial-services', 'asset-management', 'Asset Management', 'Fund-governance and fiduciary-duty frameworks', 'ratified'),
  ('financial-services', 'digital-assets', 'Digital Assets', 'Named jurisdictions'' digital-asset/crypto-asset regulatory frameworks', 'ratified'),
  ('financial-services', 'financial-crime-aml', 'Financial Crime / AML', 'AML/CFT recommendations and enforcement frameworks', 'ratified'),
  ('financial-services', 'insurance', 'Insurance', 'Solvency frameworks, actuarial standards, IAIS recommendations', 'ratified'),
  ('financial-services', 'financial-infrastructure', 'Financial Infrastructure', 'Market-infrastructure and systemic-risk oversight frameworks', 'ratified')
ON CONFLICT (domain, pillar_key) DO NOTHING;

INSERT INTO public.corpus_dependency_registry (domain, dependency_name, relationship, status)
VALUES
  ('financial-services', 'Contract Law', 'governed by', 'ratified'),
  ('financial-services', 'Corporate Law', 'governed by', 'ratified'),
  ('financial-services', 'Accounting & Audit', 'measured by', 'ratified'),
  ('financial-services', 'Taxation', 'constrained by', 'ratified'),
  ('financial-services', 'Identity & Personhood', 'identifies through', 'ratified'),
  ('financial-services', 'Cybersecurity', 'secured by', 'ratified'),
  ('financial-services', 'Privacy & Data Protection', 'constrained by', 'ratified'),
  ('financial-services', 'Consumer Protection', 'supervised by', 'ratified')
ON CONFLICT (domain, dependency_name) DO NOTHING;

INSERT INTO public.corpus_institutional_registry (domain, pillar_key, institution_name, status)
VALUES
  ('financial-services', 'banking', 'BIS', 'ratified'),
  ('financial-services', 'banking', 'FCA', 'ratified'),
  ('financial-services', 'banking', 'ECB', 'ratified'),
  ('financial-services', 'payments', 'FATF', 'ratified'),
  ('financial-services', 'payments', 'BIS Committee on Payments and Market Infrastructures', 'ratified'),
  ('financial-services', 'capital-markets', 'SEC', 'ratified'),
  ('financial-services', 'capital-markets', 'ESMA', 'ratified'),
  ('financial-services', 'digital-assets', 'MiCA (EU framework)', 'ratified'),
  ('financial-services', 'digital-assets', 'FinCEN', 'ratified'),
  ('financial-services', 'financial-crime-aml', 'FATF', 'ratified'),
  ('financial-services', 'financial-crime-aml', 'FinCEN', 'ratified'),
  ('financial-services', 'financial-crime-aml', 'CFTC', 'ratified'),
  ('financial-services', 'insurance', 'IAIS', 'ratified'),
  ('financial-services', 'insurance', 'NAIC', 'ratified'),
  ('financial-services', 'insurance', 'PRA', 'ratified'),
  ('financial-services', 'insurance', 'EIOPA', 'ratified'),
  ('financial-services', 'financial-infrastructure', 'IMF', 'ratified'),
  ('financial-services', 'financial-infrastructure', 'World Bank', 'ratified'),
  ('financial-services', 'financial-infrastructure', 'BIS', 'ratified')
ON CONFLICT (domain, pillar_key, institution_name) DO NOTHING;
