# CFS-017 — The a2ui/liquid Coherence Seam

**Chrysalis Foundation Specification · v0.1 · Status: DRAFT — awaiting operator ratification. NO implementation until ratified (Law XI).**
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

## Ratification decision requested from the operator

- [ ] **Ratify v1 (observe mode at the plan route)** — implementable in one increment; no render behaviour changes; the rendering-governed criterion gains its thin-client half.
- [ ] **Defer** — the seam stands as design.

v2 (gating) is intentionally not offered in this first decision: its precondition is v1 observation data.
