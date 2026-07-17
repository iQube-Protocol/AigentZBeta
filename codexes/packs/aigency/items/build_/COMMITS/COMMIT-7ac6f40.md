# Commit Brief: `7ac6f40` — CFS-035 Phase 1 + a second shadow node — Reasoning-face consolidation + NBE ranking

| Field | Value |
|-------|-------|
| SHA | [`7ac6f40`](https://github.com/iQube-Protocol/AigentZBeta/commit/7ac6f408fec7d8fbc90f06224ec3ebae5690090a) |
| Author | Claude |
| Date | 2026-07-16T16:39:03Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
CFS-035 Phase 1 + a second shadow node — Reasoning-face consolidation + NBE ranking

- Phase 1 (Reasoning face): route nbeLlmRerank's invariant grounding through
  the engine's groundReasoning() instead of a hand-rolled buildInvariantSlice.
  Behaviour-preserving (groundReasoning wraps the same slice) — proves the
  single-entry consolidation.
- Phase 2 node #2: services/invariants/nodes/nbeRanking.ts — re-expresses
  selectNbeCandidates' weight+goal-fit heuristic as a transparent importance/
  need projection (need = score - weight, faithful by construction, no
  duplicated constants; generic over the candidate type to keep the
  engine->orchestration dependency direction clean). Wired in SHADOW into
  nbeCatalog.selectNbeCandidates (server-only) — serves the incumbent order
  unchanged, emits the divergence.

Both verified via pure-logic harness (4/4) + parse gates. Observe-only; no
platform behaviour change. Shadow->authoritative flips remain operator-gated.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Y98FMjkM8zUDsYqJikzsMB
```

## Body

- Phase 1 (Reasoning face): route nbeLlmRerank's invariant grounding through
  the engine's groundReasoning() instead of a hand-rolled buildInvariantSlice.
  Behaviour-preserving (groundReasoning wraps the same slice) — proves the
  single-entry consolidation.
- Phase 2 node #2: services/invariants/nodes/nbeRanking.ts — re-expresses
  selectNbeCandidates' weight+goal-fit heuristic as a transparent importance/
  need projection (need = score - weight, faithful by construction, no
  duplicated constants; generic over the candidate type to keep the
  engine->orchestration dependency direction clean). Wired in SHADOW into
  nbeCatalog.selectNbeCandidates (server-only) — serves the incumbent order
  unchanged, emits the divergence.

Both verified via pure-logic harness (4/4) + parse gates. Observe-only; no
platform behaviour change. Shadow->authoritative flips remain operator-gated.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Y98FMjkM8zUDsYqJikzsMB

## Files Changed

| Change | File |
|--------|------|
| Added | `services/invariants/nodes/nbeRanking.ts` |
| Modified | `services/orchestration/nbeCatalog.ts` |
| Modified | `services/orchestration/nbeLlmRerank.ts` |

## Stats

 3 files changed, 81 insertions(+), 4 deletions(-)
