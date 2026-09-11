# Commit Brief: `a8279a9` — Ratify + implement CFS-017 v1: a2ui plan path observed, with three honest amendments

| Field | Value |
|-------|-------|
| SHA | [`a8279a9`](https://github.com/iQube-Protocol/AigentZBeta/commit/a8279a9edb56d7aa5d1b7dea6cdce4b9db45f8e4) |
| Author | Claude |
| Date | 2026-07-06T07:42:47Z |
| Branch | dev (direct push) |
| Type | `feat` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Ratify + implement CFS-017 v1: a2ui plan path observed, with three honest amendments

v1 (OBSERVE MODE) of the a2ui coherence seam is RATIFIED (operator
direction, 2026-07-06) and implemented:

- services/constitutional/renderInstrumentation.ts: on every surface-
  plan build, grounding (invariant slice, cartridge-scoped) + ontology
  resolution over the plan's text run in parallel; the response gains a
  top-level `constitutional` block — invariantSeedIds (the CFS-007
  contract's long-empty field semantics finally populated for the a2ui
  path), resolved terms, drift, canon version, an HONEST coherence slot
  (evaluated:false with the reason), and a `receipted` flag. Reach
  citation fire-and-forget. A render is NEVER blocked — every failure
  degrades to the plan exactly as before (observe-mode contract).
- experience_render_validated receipts emit only when the spine
  resolves the caller (the plan route is mechanical/unauthenticated by
  design); unauthenticated calls are instrumented but unreceipted, and
  the block says so.

Three implementation amendments recorded in CFS-017 v1.0 (the
implementation teaches the spec):
1. The liquid path does NOT flow through the plan route — client-side
   registry lookup, no server chokepoint. The seam governs the a2ui
   path; liquid is inventoried UNGOVERNED pending v1.1 design.
2. The coherence engine is brief-shaped only — no plan-generic
   validator exists; v1 semantic integrity = the ontology drift check;
   plan-shaped validator named as the v1.1 gap.
3. The plan route resolves no persona — receipt posture stated
   honestly; requiring resolution is a v1.1 decision, not a silent
   change.

v2 (fail-closed gating) remains unratified — precondition: v1
observation data (the D1->D2 pattern applied to rendering).

Co-Authored-By: Claude <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Y98FMjkM8zUDsYqJikzsMB
```

## Body

v1 (OBSERVE MODE) of the a2ui coherence seam is RATIFIED (operator
direction, 2026-07-06) and implemented:

- services/constitutional/renderInstrumentation.ts: on every surface-
  plan build, grounding (invariant slice, cartridge-scoped) + ontology
  resolution over the plan's text run in parallel; the response gains a
  top-level `constitutional` block — invariantSeedIds (the CFS-007
  contract's long-empty field semantics finally populated for the a2ui
  path), resolved terms, drift, canon version, an HONEST coherence slot
  (evaluated:false with the reason), and a `receipted` flag. Reach
  citation fire-and-forget. A render is NEVER blocked — every failure
  degrades to the plan exactly as before (observe-mode contract).
- experience_render_validated receipts emit only when the spine
  resolves the caller (the plan route is mechanical/unauthenticated by
  design); unauthenticated calls are instrumented but unreceipted, and
  the block says so.

Three implementation amendments recorded in CFS-017 v1.0 (the
implementation teaches the spec):
1. The liquid path does NOT flow through the plan route — client-side
   registry lookup, no server chokepoint. The seam governs the a2ui
   path; liquid is inventoried UNGOVERNED pending v1.1 design.
2. The coherence engine is brief-shaped only — no plan-generic
   validator exists; v1 semantic integrity = the ontology drift check;
   plan-shaped validator named as the v1.1 gap.
3. The plan route resolves no persona — receipt posture stated
   honestly; requiring resolution is a v1.1 decision, not a silent
   change.

v2 (fail-closed gating) remains unratified — precondition: v1
observation data (the D1->D2 pattern applied to rendering).

Co-Authored-By: Claude <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Y98FMjkM8zUDsYqJikzsMB

## Files Changed

| Change | File |
|--------|------|
| Modified | `app/api/metame/runtime/plan/route.ts` |
| Modified | `codexes/packs/agentiq/foundation/CFS-015_operation-chrysalis-2-prd.md` |
| Modified | `codexes/packs/agentiq/foundation/CFS-017_a2ui-coherence-seam.md` |
| Added | `services/constitutional/renderInstrumentation.ts` |

## Stats

 4 files changed, 163 insertions(+), 6 deletions(-)
