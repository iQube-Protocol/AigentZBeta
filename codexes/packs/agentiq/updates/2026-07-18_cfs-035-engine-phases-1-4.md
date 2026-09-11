# CFS-035 The Invariant Engine — Phases 1–4 complete

**Date:** 2026-07-18
**Branch:** `claude/agentiq-onboarding-docs-jrbeha`

Carrying the engine from Phase-0 (discovery shadow + Observatory) through the
remaining phases. Each phase shipped as its own commit; all shadow-first / safe.

## Phase 1 — grounding consolidation + node invariants
- The 5 remaining grounded surfaces (specialist, runArtifact, ontology resolver,
  renderInstrumentation, composeArtifact) now route through the engine's Reasoning
  face `groundReasoning` instead of hand-rolled `buildInvariantSlice` — one seam.
- Shared node helpers in `engine.ts`: `deriveWeightsFromStanding` + `getCachedFieldSnapshot`
  (the discovery pattern generalised). discovery refactored onto them; nbe derives
  importance/need weights.
- Seeded node-governing invariants `inv.…151–156` (nbe/standing/journey), `proposed`.
- **Fix:** migration `20260718020000` adds `invariant_node_flipped` to the
  `activity_receipts` CHECK — without it the flip's DVN anchor was silently lost.

## Phase 2 — Experience face + Invariant Lenses + routing node
- `services/invariants/experience.ts`: the 5 Invariant Lenses (1:1 to the operator
  archetypes), a per-dimension bias applied on top of standing weights, mean-
  normalised — same field, per-pathway emphasis. Adopted on the discovery node.
- `routing.stage` node: the 4th Phase-2 node — HONEST status: routing already
  reached the Constitutional-Projection end-state (the ModelQube-driven Model
  Router), so it's a thin already-authoritative observer for Observatory parity.
- Canon: `inv.reasoning.157` (the Experience-face / lens principle).

## Phase 3 — Field Extractor (Perception) v0
- `services/invariants/perception.ts`: `extractField` (v0 deterministic keyword
  estimator) + `groundFromInput` — derive the grounding context from arbitrary
  input instead of hand-specifying it. Scoped v0 per the plan's guard; the
  semantic/embedding version is the Gen-3 drop-in follow-on.
- Canon: `inv.reasoning.158` (Perception principle), `proposed`.

## Phase 4 — Evolution loop closed + OS-wide
- The capsules route now cites a SERVED discovery projection's invariants
  (fire-and-forget Reach accrual) — a served projection feeds adoption back to its
  governing invariants (Law XII). The cybernetic loop closes in code.
- The Observatory computes per-node **ratification candidates** from persisted
  observation stability (`evolutionCandidate` + `health.evolutionCandidates`) — the
  reflection step; the operator ratifies from evidence, never automatically.
- OS-wide: the engine is now consumed by discovery, nbe, standing, journey, routing,
  and the 5 grounded surfaces; the flip mechanism + Observatory work for every
  registered node.
- Canon: `inv.cybernetics.159` (the Evolution face closes the loop), `validated`.

## Honest limits (named, not hidden)
- nbe/standing/journey run in shadow and are faithful — their governing invariants
  are `proposed`; making their flips *serve* + *diverge* needs (a) validating those
  invariants + seeding priors (as discovery has), and (b) per-surface plumbing to
  serve the flipped projection (discovery is wired; the others are the follow-on;
  `selectNbeCandidates` is sync, so nbe needs an async lift).
- The Evolution loop's **Reach** half is automatic; the **standing-from-outcome**
  half (CTR/selection → validation) is gated on outcome instrumentation — a named
  follow-on, not built.
- Perception is a v0 keyword heuristic; the semantic extractor is Gen-3.
- Lens bias values + node dimension weights are declared v0 parameters (candidates
  for `inv.lens.*` / earned-standing derivation).

## Operator steps to make it fully live
1. Run the migrations (see `2026-07-18_flip-dvn-anchor.md` + the Phase-1 fix
   `20260718020000` LAST) and re-run `node scripts/ingest-canonical-invariants.mjs`
   (now seeds `inv.…138–159`).
2. To make discovery's flip meaningful: validate `inv.reasoning.134–137` + seed
   standing priors (SQL already provided), then flip discovery authoritative from
   the Observatory's Projection pill.
