# CFS-048 Phase 2 — Compare: earned domain invariants from cross-sub-domain compression

**Date:** 2026-07-20 · **Branch:** `claude/agentiq-onboarding-docs-jrbeha`

With all five CRP-003 Financial Services sub-domains populated, the **Compare** stage becomes an empirical exercise rather than a design one (operator + Aletheon). Compare compresses the independently-discovered sub-domain candidate sets into **earned** domain-level invariants — the point where the registry stops being a store of LLM statements and becomes a record of *compression with provenance*.

## What it does
`compareSubDomains(admin, domain)` (in `discoveryEngine.ts`), route action `compare`, and a **Compare sub-domains** button at the domain-baseline scope:
- Gathers open sub-domain candidates grouped by sub-domain (needs ≥2) + the domain baseline as **provisional hypotheses** (not truth).
- One sovereign-routed compression pass **clusters manifestations of the same invariant across sub-domains** (e.g. payments "verifiable accountability" + banking "transaction accountability" + trading "market transparency" → one accountability invariant), **rewrites upward into invariant form** (not policy statements), and **classifies** each output against the baseline:
  - **Supported** — recurs independently across ≥2 sub-domains
  - **Specialized** — one branch only (belongs lower)
  - **Split** — a baseline hypothesis that is really several
  - **Novel** — recurs across sub-domains but absent from the baseline
- Persists outputs as domain-scoped candidates (`sub_domain=NULL`, `provenance.stage='compare'`) carrying `classification`, `coverage` (which sub-domains), and `contributingCandidateIds`. **Confidence is driven by independent recurrence (coverage breadth), not model self-report** — `min(0.97, 0.55 + 0.1·coverage)`. Convergence uses the union of contributing evidence.
- Compare outputs render in the domain-baseline candidate view with **classification + coverage + framework badges**, alongside the original five (now visibly provisional).

Also in this pass (Aletheon "build now"): **scope-class candidate labels** ("Domain / Sub-domain invariant candidates") and **richer evidence badges** (framework names inline when ≤3, not just a count — distinguishes genuine convergence from two extracts of one source).

Doctrine canonized: `inv.reasoning.344` (domain invariants earned by recurrence; baseline is a hypothesis set) + `inv.reasoning.345` (discovery is recursive compression: evidence → domain → cross-domain → constitutional, each a distinct operation; higher-order invariants earned, never presupposed).

## Files
- `services/invariants/discoveryEngine.ts` — `compareSubDomains`, `CompareClassification`, candidate `stage`/`classification`/`coverage`.
- `app/api/invariants/discovery/route.ts` — `compare` action.
- `components/composer/InvariantDiscoveryTab.tsx` — Compare button, classification/coverage badges, scope-class headings, inline framework names.
- `codexes/packs/irl/foundation/canonical-invariants.seed.json` — `inv.reasoning.344–345`.
- `tests/discovery-scope-convergence.test.ts` — Compare discipline canaries (≥2 sub-domains, recurrence-based confidence, four classifications, baseline-as-hypothesis).

No migration — reuses `discovery_candidates` + `discovery_provenance` jsonb (needs the Phase 1a `20260804000000` columns already provided).

## Immediate next (parent-linking on promotion — Aletheon's keystone)
When a sub-domain candidate is promoted, propose parent domain invariant(s) via similarity, operator confirms (never fully automatic), and create `specializes` graph edges (multiple parents allowed — a graph, not a tree). That writes the topology Compare discovers into the invariant graph so the **Invariant Field** tab renders inheritance/specialization. Compare already records the child→parent contributions in provenance; parent-linking makes them first-class edges.

## Deferred
- Cross-**domain** comparison (Healthcare, Aviation…) → constitutional invariants by recurrence across independently-discovered domains.
- Compare's own semantic-structure clustering (compare compressed structures, not text) as a dedicated stage.
