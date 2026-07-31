# CFS-035 Invariant Engine — Phase 0: the seam + discovery-ranking shadow node

**Date:** 2026-07-18
**Workstream:** G (Invariant Engine, CFS-035). **Gate:** Phase 0 build authorized by the operator
("move from plan to full execution"). Shadow→authoritative flip remains operator-gated.

---

## What shipped

The first increment of the Invariant Engine — the Level-2 seam + the pilot Invariant Decision
Node (discovery ranking) running in **shadow mode**. Observe-only: it changes no platform
behaviour. It establishes the mechanism the whole rollout composes over.

| File | Role |
|---|---|
| `services/invariants/engine.ts` (NEW) | The engine seam. `FieldSnapshot` (one projection per intent, the shared interface) + `computeFieldSnapshot`/`groundReasoning` (Reasoning face, composing `buildInvariantSlice`) + the Constitutional-Projection contract (`DecisionProjection`, `NodeProjector`) + the Evolution/shadow loop (`compareShadow`, `rankAgreement`, `emitShadowObservation`, `runShadow`). Pure composition of existing façades; no new reader/ranker. |
| `services/invariants/nodes/discoveryRanking.ts` (NEW) | The discovery-ranking node. Re-expresses `scoreCapsule`'s four-forms heuristic (magic numbers + branches + ordering) as a transparent projection over four named dimensions — **importance · novelty · trust · need** — so every ranking carries a "why". Pure + deterministic (safe on the hot path). |
| `app/api/runtime/capsules/route.ts` | Shadow wiring (non-`play` branch): runs the projection alongside `scoreCapsule`, emits the divergence, serves the incumbent order **unchanged**. `runShadow` never throws. |
| `tests/invariant-engine-discovery-shadow.test.ts` (NEW) | Canary: valid ranking, faithful re-expression (dimensions sum to the incumbent total), shadow never mutates the incumbent order, `rankAgreement` math. |

## Why it is safe

- **Observe-mode-first (CFS-017).** The served ranking is `scored` (the incumbent), untouched.
  The shadow path is best-effort and swallows all errors (`runShadow` guards).
- **Pure on the hot path.** The Phase-0 projection uses no DB call — it re-expresses the same
  observable capsule signals, so the shadow adds negligible latency and no failure surface.
- **Faithful re-expression.** The four dimensions sum to exactly the incumbent `scoreCapsule`
  total (canary-pinned at 32 on the worked fixture), so Phase 0 is behaviour-preserving by
  construction. The divergence signal the Evolution face collects is the baseline; genuine
  divergence arrives only when the dimension weights become standing-derived.

## Honest limits (Phase 0 scope)

- **The dimension weights are transparent constants, not yet `inv.discovery.*` standing.** Those
  invariants are the parallel discovery workstream. Phase 0 ships the *mechanism* (dimensional
  decomposition + snapshot-citation path + shadow instrument), not learned weights.
- **`novelty` is neutral (0)** — it needs exposure/selection history from the Evolution face.
- **No receipt yet** — the capsules route has no persona; the shadow emits a structured
  `[INVARIANT-SHADOW]` log (observe floor). Persona-scoped nodes (NBE, journey) will receipt.
- **Canary runs in CI** — the sandbox lacks `node_modules` (vitest can't run here); the real node
  + engine agreement logic were verified via an esbuild-bundled pure-logic harness (9/9), and all
  four files pass esbuild parse gates.

## Next (per CFS-035 §11 sequencing)

Phase 1 — route the already-grounded LLM surfaces (NBE rerank, specialist, runArtifact) through
`groundReasoning` (consolidation, no behaviour change). Phase 2 — frontier projection nodes
(journey, NBE, standing, routing), each shadow-then-flip under its own ratification, + the
Experience face (lenses). The shadow→authoritative flip for discovery ranking awaits operator
ratification once enough `[INVARIANT-SHADOW]` divergence data is collected.
