-- 20260804000000_discovery_scope_abstraction.sql
--
-- CFS-048 Phase 1a — domain-ladder discovery + abstraction-level tagging.
--
-- Methodology correction from the Financial Services first-run (operator +
-- Aletheon, 2026-07-20): invariants are discovered DOMAIN-FIRST, then laddered
-- WITHIN the domain (domain baseline -> sub-domain -> capability) before any
-- cross-domain generalisation. Universality is discovered by comparison, never
-- presupposed (inv.reasoning.340-343).
--
-- This adds the scope ladder + abstraction level to the discovery tables. It is
-- ADDITIVE and BACKWARD-COMPATIBLE: existing FS rows default to domain-level
-- (scope_level = 'domain', sub_domain = NULL, abstraction_level = NULL), so the
-- prior run is unaffected. Idempotent (ADD COLUMN IF NOT EXISTS + DROP/ADD
-- CONSTRAINT). Convergence (independent-source support) is DERIVED at read time
-- from evidence_ids, so it needs no column.
--
-- "field" is deliberately NOT used here — it is reserved for the abstract
-- invariant field (CFS-002 §2a). The industry axis is `domain`; areas beneath
-- it are `sub_domain`.

-- Evidence may be tagged to a sub-domain (e.g. 'payments'); NULL = domain-wide,
-- applicable to every sub-domain discovery run under the domain.
ALTER TABLE public.discovery_evidence
  ADD COLUMN IF NOT EXISTS sub_domain text;

-- Candidates carry their scope rung, the sub-domain they were discovered for,
-- and the constitutional-abstraction level the extractor assigned.
ALTER TABLE public.discovery_candidates
  ADD COLUMN IF NOT EXISTS scope_level text NOT NULL DEFAULT 'domain';
ALTER TABLE public.discovery_candidates
  ADD COLUMN IF NOT EXISTS sub_domain text;
ALTER TABLE public.discovery_candidates
  ADD COLUMN IF NOT EXISTS abstraction_level text;

-- scope_level: domain baseline -> sub-domain refinement -> capability (≤4-deep
-- ladder, mirroring ontology_classes single-inheritance, CFS-002 §3).
ALTER TABLE public.discovery_candidates
  DROP CONSTRAINT IF EXISTS discovery_candidates_scope_level_check;
ALTER TABLE public.discovery_candidates
  ADD  CONSTRAINT discovery_candidates_scope_level_check
    CHECK (scope_level IN ('domain', 'sub-domain', 'capability'));

-- abstraction_level: L0 verbatim | L1 summary | L2 cross-regulation |
-- L3 domain-constitutional | L4 domain-independent. Discovery targets L2-L3 and
-- rejects L0/L1; L4 is discovered later by cross-domain comparison, not forced
-- here. Nullable for rows predating this migration.
ALTER TABLE public.discovery_candidates
  DROP CONSTRAINT IF EXISTS discovery_candidates_abstraction_level_check;
ALTER TABLE public.discovery_candidates
  ADD  CONSTRAINT discovery_candidates_abstraction_level_check
    CHECK (abstraction_level IS NULL OR abstraction_level IN ('L0', 'L1', 'L2', 'L3', 'L4'));

-- Scope-aware candidate listing.
CREATE INDEX IF NOT EXISTS discovery_candidates_scope_idx
  ON public.discovery_candidates (domain, sub_domain, status, created_at DESC);
