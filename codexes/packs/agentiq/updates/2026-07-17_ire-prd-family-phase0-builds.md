# The IRE PRD family — all four Phase-0 builds (CCR · IPE · KRE · CFO)

**Date:** 2026-07-17
**Branch:** `claude/agentiq-onboarding-docs-jrbeha`
**Specs:** CFS-038/039/040/041 (the CFS-037 PRD family)

Operator ratified all four follow-on PRDs ("All four ratified. Build all 4") —
Phase 0 of each is built, sequenced foundational-first, each node-verified.

## CCR Phase 0 (CFS-038) — the Constitutional Coordinates Registry
`services/invariants/coordinates.ts` — the governed basis of constitutional
space: **22 vectors across 3 classes** (7 structural / 9 constitutional / 6
operational), each carrying key/class/question/basis/status/stability. The
stable-operational-vs-evolving-research split is real: **6 vectors 'operational'**
(the ones the IRE derives today) and **16 'research' candidates** (all
constitutional-class need actor context — never faked). Lifts `IQubeScoreBlock`'s
calibrated-axis+provenance pattern to the basis level (extension, not
replacement). Wired into the IRE — `resolution.ts` now sources every
coordinate's `basis` from the registry (`basisFor`). **14/14 drill.**

## IPE Phase 1 (CFS-039) — deriveWeightsFromCoordinates
`engine.ts` (the Invariant Projection Engine) gains `deriveWeightsFromCoordinates`
— node dimension weights from a **resolved field's coordinates** instead of the
raw slice. **Backward-compatible by construction:** the default `evidenceDensity`
axis IS the standing axis, so coordinate weights **equal** `deriveWeightsFromStanding`
weights (drill-proven); absent/empty coordinates return all-1 faithful — nothing
consuming CFS-035 changes unless a caller opts in. No cycle (a minimal
`CoordinateBearing` shape; the projector consumes a field, never constructs one).
The 120-ref Invariant Engine → IPE rename stays its own staged increment. **6/6
drill.**

## KRE Phase 0 (CFS-040) — the reuse-before-create decision node
`services/invariants/knowledgeResolution.ts` — `decideKnowledgeStrategy`: from
discovery candidates, recommend **reuse** (one iQube covers the field), **compose**
(a set together covers it, probabilistic-union coverage), or **create** (not
realised — generation belongs here, gap-gated). **Recommend, never auto** (Law
XI): `recommendationOnly` is structurally true on every result — the node exists
to PREVENT the CS-001 duplicate at the knowledge level. Discovery injected;
proximity is the CCR signal (trust proxy until it ships). **10/10 drill.**

## CFO Phase 0 (CFS-041) — the Resolved-Field view
`app/api/invariants/resolve/route.ts` (POST an intent → the IRE-resolved field:
coordinates + operational estimates + CCR basis summary; spine-gated, T1-safe) +
an additive **'Resolve' perspective** on the Observatory `FieldView` (enter an
intent, see the resolved region — domains, coordinates, coverage/reuse/ttv, the
operational-vs-research basis split). No existing perspective changed; route
composes the already-drilled resolution.ts + coordinates.ts.

## The pipeline, now standing
```
Intent → IRE (resolve field + coordinates) → KRE (reuse/compose/create) → IPE (project via coordinates) → reasoning
```
All Phase-0, observe-first — the substrate is in place; wiring each into the
authoritative path (per surface) is the next ratification per engine.

## Honest limits (carried from the specs)
- The **Universal Invariant Library seeding** is the operator-run reconciliation
  pass (ratify-before-seed) — until then the IRE universal pass uses the named
  proxy namespaces and 16 constitutional-class coordinates stay `research`.
- **KRE proximity** uses the existing trust score until CCR constitutional-
  proximity ships; the Compose/Realise/Register stages beyond the decision node
  are the KRE follow-on.
- **IPE**: the additive coordinate path is built; wiring a live node to consume a
  resolved field (shadow) + the full rename are staged.
- **CFO** UI not run in-sandbox (additive, mirrors the existing pattern).
