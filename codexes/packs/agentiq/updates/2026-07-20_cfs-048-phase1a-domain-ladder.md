# CFS-048 Phase 1a — Domain-ladder discovery + self-measuring signals

**Date:** 2026-07-20 · **Branch:** `claude/agentiq-onboarding-docs-jrbeha` · **Migration:** `20260804000000_discovery_scope_abstraction.sql` (operator runs — SQL below)

The Financial Services first-run (10 regulatory sources → 5 candidates) worked, and the operator + Aletheon converged on a methodology correction that reshapes the engine. Phase 1a operationalizes it, extension-only.

## What changed

1. **Domain-first, laddered discovery.** Discovery now runs at the **domain baseline** (the invariants that hold across the whole domain) OR a **sub-domain** rung beneath it (Payments, Trading, Banking, Custody, Cross-border, plus CRP-003's five capability domains — presets + free-text). Sub-domain invariants *refine, never contradict* the baseline. Universality is discovered later by cross-domain comparison — never presupposed (`inv.reasoning.340`).
   - `"field"` is deliberately NOT used for the industry axis — it is reserved for the abstract invariant field (CFS-002 §2a). The axis is `domain`; areas beneath are `sub_domain`.
2. **Cross-framework convergence signal.** Each candidate shows how many **independent source documents** imply it (deduped on sourceRef/title), with a tier (single / strong / broad). Open candidates **sort by convergence**. This is a *prioritisation* signal, not validity — support is evidence, not truth (Law XII; `inv.reasoning.342`).
3. **Abstraction-level awareness.** The extractor tags each candidate L2 (cross-regulation) / L3 (domain-constitutional) and **rejects L0/L1 (verbatim/summary)**; it does **not** abstract to L4 (domain-independent). Surfaced as a badge. This encodes the operator's correction — discover the invariants *of the domain*, not premature universals.
4. **Promotion threads the ladder.** `promoteCandidate` writes `contexts[].applicabilityConditions = { scopeLevel, subDomain, abstractionLevel }` (+ interpretation = sub-domain) through the existing context mechanism — no new field on `InvariantRecord` (`inv.reasoning.341`). Promotion still lands `proposed` / `agent_verified`, no canonisation path (discipline unchanged).

Doctrine canonized: `inv.reasoning.340–343` (domain-first · scope ladder · convergence-as-priority-not-validity · K\*_domain sufficiency-as-experiment). Method → canonical; the FS invariants themselves stay `proposed`.

## Files
- Migration `supabase/migrations/20260804000000_discovery_scope_abstraction.sql` (additive, idempotent).
- `services/invariants/discoveryEngine.ts` — scope opts, two prompt variants + abstraction mandate, `computeConvergence`/`enrichConvergence`, scope-aware `listEvidence`/`listCandidates`, ladder threaded into promotion contexts.
- `services/invariants/lifecycle.ts` — `discoverInvariant` contexts widened to carry `applicabilityConditions`/`retrievalTags` (forwarded to `upsertContext`).
- `app/api/invariants/discovery/route.ts` — `?subDomain=`, sub-domain presets, scope threaded to extract/add-evidence.
- `components/composer/InvariantDiscoveryTab.tsx` — scope bar, sub-domain evidence tag, abstraction badge + convergence chip, convergence sort.
- Canon `codexes/packs/irl/foundation/canonical-invariants.seed.json` — `inv.reasoning.340–343`.
- Canary `tests/discovery-scope-convergence.test.ts`.

## Charter reconciliation
This is **Phase 1a** (domain ladder + convergence + abstraction signals) — the methodology correction from the FS first-run. The charter's original Phase 1 (corpus-scale synthesis via `mergeInvariants` + validation-queue UI) remains **Phase 1b**.

## Deferred (ratify-before-build)
- **K\*_domain sufficiency runner** — reuses the pre-registered EXP-P2 **B2 (Minimal sufficiency / K\*)** + **B3 (ablation)** and the substrate seam `buildInvariantSlice({ domains:['financial-services'], statuses:['proposed'] })`. "Are these N enough?" grown until no reasoning lift.
- **Cross-domain comparison** — run discovery independently per domain (Healthcare, Aviation…), compute invariant overlap; constitutional invariants emerge from recurrence. Only after laddering within FS.
- **Graded EXP-006 scorer** (separate, from the same review): the exact-match evaluator double-counts morphological variants (`accessibility`/`accessible`, `data-collection`/`data_collection`) as both missing AND redundant, understating the sovereign arm. Fix = staged scorer (exact → normalized/morphological → semantic-equivalence → subsumption), reporting each tier + genuine deltas. The subsumption tier connects directly to this domain→sub-domain ladder (higher-order vs operational-refinement invariants).

## Operator action (Supabase SQL editor — after deploy)
```sql
ALTER TABLE public.discovery_evidence   ADD COLUMN IF NOT EXISTS sub_domain text;
ALTER TABLE public.discovery_candidates ADD COLUMN IF NOT EXISTS scope_level text NOT NULL DEFAULT 'domain';
ALTER TABLE public.discovery_candidates ADD COLUMN IF NOT EXISTS sub_domain text;
ALTER TABLE public.discovery_candidates ADD COLUMN IF NOT EXISTS abstraction_level text;
ALTER TABLE public.discovery_candidates DROP CONSTRAINT IF EXISTS discovery_candidates_scope_level_check;
ALTER TABLE public.discovery_candidates ADD  CONSTRAINT discovery_candidates_scope_level_check CHECK (scope_level IN ('domain','sub-domain','capability'));
ALTER TABLE public.discovery_candidates DROP CONSTRAINT IF EXISTS discovery_candidates_abstraction_level_check;
ALTER TABLE public.discovery_candidates ADD  CONSTRAINT discovery_candidates_abstraction_level_check CHECK (abstraction_level IS NULL OR abstraction_level IN ('L0','L1','L2','L3','L4'));
CREATE INDEX IF NOT EXISTS discovery_candidates_scope_idx ON public.discovery_candidates (domain, sub_domain, status, created_at DESC);
```
Backward-compatible: existing FS candidates default to `scope_level='domain'`, `sub_domain=NULL` — the domain baseline view — so the first run is unaffected.
