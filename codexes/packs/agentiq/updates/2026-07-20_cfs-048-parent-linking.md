# CFS-048 — Parent-linking on promotion (the ontology keystone)

**Date:** 2026-07-20 · **Branch:** `claude/agentiq-onboarding-docs-jrbeha`

Aletheon's keystone: once Compare has earned a domain invariant (e.g. *Transparency*), a sub-domain invariant (*Trading transparency*) shouldn't merely exist — it should say `specializes → Transparency`. That turns the registry into an **invariant ontology** (a graph, not a list). This closes the loop with the domain→sub-domain ladder: the topology Compare *discovers* becomes first-class `specializes` edges in the invariant graph, which the **Invariant Field** tab renders.

## What it does
- **`suggestParents(admin, candidateId)`** — for a sub-domain candidate, proposes parent DOMAIN-level invariants (already-promoted baseline or Compare-earned invariants in the same domain), ranked by statement similarity (reuses `comparison.similarity`). The engine PROPOSES; the operator CONFIRMS — never automatic (Aletheon: false hierarchy would later look canonical simply because it's rendered).
- **`promoteCandidate(..., parentInvariantIds[])`** — after landing the invariant as `proposed`, creates a `specializes` edge (child → parent) per confirmed parent via `addEdge`. **Multiple parents allowed** (a graph, not a tree — e.g. cybersecurity specializes both *manage risk* and *protect client data*). Edge failures only log; they never fail the promotion.
- **UI** — promoting a sub-domain candidate opens an inline confirm panel: suggested parents with similarity, checkboxes (strong matches preselected), *Link N & promote* / *Promote (no parent)* / *Cancel*. Domain-level candidates promote directly.
- **Compare's fifth class — `equivalent`** (Aletheon): the SAME invariant as a baseline item at a different abstraction level — distinct from `split` (two invariants). This stops abstraction mismatches from being mislabelled as novelty, and directly feeds EXP-006A's abstraction-delta handling.

No new doctrine needed — this realises `inv.reasoning.341` ("the ladder … expressed through contexts and **edges**, not presupposed parents"). No migration — uses the existing invariant `edges` table via `addEdge`.

## Files
- `services/invariants/discoveryEngine.ts` — `suggestParents`, `ParentSuggestion`, `promoteCandidate` parent-linking + edges, `equivalent` class.
- `app/api/invariants/discovery/route.ts` — `suggest-parents` action + `parentInvariantIds` on `promote`.
- `components/composer/InvariantDiscoveryTab.tsx` — parent-link confirm panel, `equivalent` badge.
- `tests/discovery-scope-convergence.test.ts` — parent-linking + equivalent canaries.

## Next (aligns with EXP-006A, already drafted)
- **EXP-006A** — topology/abstraction-aware scoring (`services/experiments/topologyProjectionScore.ts` drafted): four-class deltas (vocabulary / abstraction / omission / redundant) + composite Projection Fidelity. v1 uses embedding "same-family" cosine; the **graph** version can now use these `specializes` edges as ground-truth subsumption. Wire the route + runner next.
- **Invariant Stability / Recurrence Index** (Aletheon, deferred): evidence × regulations × sub-domains × domains × time → a scientific measure of constitutional emergence. Needs cross-domain runs first.
