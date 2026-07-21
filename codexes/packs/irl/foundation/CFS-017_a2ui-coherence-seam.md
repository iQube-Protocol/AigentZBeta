# CFS-017 — The a2ui/liquid Coherence Seam

**Chrysalis Foundation Specification · v1.0 · Status: v1 (OBSERVE MODE) RATIFIED by operator direction 2026-07-06 and implemented same day; v2 (gating) UNRATIFIED — precondition: v1 observation data.**
Constitutional anchor: `codexes/packs/polity-core/constitutional-records/invariant-intelligence.md`
Companion to CFS-007 (renderer abstraction), CFS-014 (Coherence Engine), CFS-015 (Strand One: every rendering surface governed).

---

## The gap this closes

The a2ui/liquid render path is the platform's thin-client rendering surface — and it is currently **unvalidated and unreceipted**. Verified state (Phase-2 scout):

- Renders execute via the CopilotKit action (`app/(shell)/copilot/actions/a2ui.ts`) and the liquid path in `TabRenderer.tsx`, both flowing through **`POST /api/metame/runtime/plan`** — the single server chokepoint.
- No coherence validation runs anywhere on this path (`services/coherence` is not imported by it).
- The CFS-007 renderer contract carries an `invariantSeedIds` field that **nothing populates** — the seam was named before it was wired (Law IV), and this document is the wiring decision.

The video-brief path (the Phase-1B rendering slice) shows what "governed rendering" means concretely: grounding → composition → coherence validation → `experience_render_validated` receipt → Reach citation. This spec extends the same cycle to the thin-client path.

## Decision 1 to ratify — WHERE the seam lives

**Recommendation: the plan route (`/api/metame/runtime/plan`), server-side.**

| Option | For | Against |
|---|---|---|
| **A. Plan route (recommended)** | The single chokepoint BOTH a2ui and liquid flow through; fail-closed semantics stay server-side (CFS-014 §7: no renderer executes until coherence succeeds); receipts have the persona context they need (T0 stays server-side) | Validation runs even for renders a client later discards |
| B. Renderer adapters (CFS-007 seam, client) | Closest to the render | Client-side gating is advisory at best (a modified client skips it); receipts would need a round-trip; two adapters to instrument instead of one chokepoint |

Option B remains available later for render-time telemetry (the experience validator's future signal source); it is not the enforcement seam.

## Decision 2 to ratify — GATE or OBSERVE in v1

**Recommendation: OBSERVE first, gate later — the D1→D2 pattern applied to rendering.**

- **v1 (observe):** the plan route populates `invariantSeedIds` from the plan's grounding, runs the applicable coherence validators, attaches the `CoherenceResult` to the plan response, and emits an `experience_render_validated` receipt — but NEVER blocks a render. Rationale: renders that flow today are unvalidated; turning on fail-closed gating in the same change that introduces validation would make previously-working surfaces start failing on day one, conflating "the validator works" with "the content is wrong."
- **v2 (gate, separate ratification):** after an observation period the operator judges sufficient, fail-closed gating per CFS-014 §7 is ratified with the observed violation data as evidence — the Improvement Loop applied to rendering governance, exactly as D1 operating history gates D2.

## What flows through the seam (v1, observe mode)

1. **Grounding**: the plan's semantic context resolves through the Canonical Ontology Service (`resolveOntology`) and the invariant slice (`buildInvariantSlice`) — populating the contract's `invariantSeedIds` at last.
2. **Validation**: the coherence validators that are REAL today — semantic guardrail integrity. The experience and reasoning validators remain honest stubs (`evaluated: false`) until renderer telemetry flows; the seam ships saying so, never faking dimension scores (CFS-014 v1 discipline).
3. **Receipt**: `experience_render_validated` (existing anchorable type) with `invariants_used`; T2-safe summary (dimension scores + pass, no content).
4. **Learning**: Reach citation on grounding invariants per render (Law XII — a render that consumes invariants is adoption).

All best-effort in observe mode: instrumentation failure never blocks a plan response.

## Honest limits, stated at ratification time

- Semantic-only validation at first — a `pass` in v1 means "no semantic guardrail violation," not full five-dimension coherence.
- The plan route's latency budget gains one grounding query + one validation pass (pure/sync); if observed latency matters, the grounding slice is cacheable per canon version (the `initializeKnowledge` pattern).
- Liquid renders that bypass the plan route (if any exist — none found by the scout) would remain ungoverned and must be inventoried before v2 gating.

## Ratification record

- [x] **v1 (OBSERVE MODE) RATIFIED — 2026-07-06, by operator direction.** Implemented same day: `services/constitutional/renderInstrumentation.ts` + the plan route attaches a top-level `constitutional` block (grounding seed ids, resolved terms, drift, canon version, honest coherence slot, receipted flag). A render is never blocked.
- [ ] **v2 (gating) — not requested, not ratified.** Precondition: v1 observation data.

## Implementation amendments — what building v1 taught the spec (2026-07-06)

The implementation scout corrected three assumptions in the draft; recorded here per the constitutional-honesty discipline (the implementation teaches the theory):

1. **The liquid path does NOT flow through the plan route.** It is a client-side registry lookup (`liquidTemplateRegistry` in `liquidExperienceRenderer.ts`) with no server chokepoint — the draft's "single chokepoint both paths flow through" claim was wrong for liquid. The seam as implemented governs the **a2ui path**; liquid renders are inventoried as UNGOVERNED pending a v1.1 design amendment (candidate: instrument at the CFS-007 adapter with a server round-trip for receipts, or accept client-advisory-only status explicitly).
2. **The coherence engine is brief-shaped only.** `validateVideoBriefCoherence` is the sole entry point; no plan-generic validator exists. v1's semantic-integrity signal is therefore the ontology drift check (real, but narrower than the draft implied); the attached `coherence` slot ships `evaluated: false` with this reason. **v1.1 gap: a plan-shaped validator** (CFS-014 §9 extension).
3. **The plan route resolves no persona** (mechanical by design — trusts body refs). Receipts emit only when `getActivePersona(request)` resolves; unauthenticated plan calls are instrumented but unreceipted, and the block says so (`receipted: false`). Whether the plan route should REQUIRE persona resolution is a v1.1 decision, not silently changed here.

## v1.1 items (named, not ratified)

1. Plan-shaped coherence validator (unlocks a real `coherence.evaluated: true` at this seam).
2. Liquid-path governance design.
3. Persona-resolution posture for the plan route.
