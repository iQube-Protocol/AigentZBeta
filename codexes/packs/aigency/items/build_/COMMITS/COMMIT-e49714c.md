# Commit Brief: `e49714c` — CFS-035 Phase 2: Experience face + Invariant Lenses + routing node

| Field | Value |
|-------|-------|
| SHA | [`e49714c`](https://github.com/iQube-Protocol/AigentZBeta/commit/e49714cbba9312876fc024e439c7546065174e28) |
| Author | Claude |
| Date | 2026-07-16T22:59:16Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
CFS-035 Phase 2: Experience face + Invariant Lenses + routing node

- Experience face (services/invariants/experience.ts): the 5 Invariant Lenses
  1:1 to the OperatorArchetype pathways (citizen/clarity, entrepreneurial/progress,
  technical/observability, creative/inspiration, research/discovery). A lens is a
  per-dimension bias applied on top of standing weights, re-normalised to mean 1 —
  same field, per-pathway emphasis, never a fork. Adopted on the discovery node
  (optional archetype → lens; rides DecisionProjection.lens). Verified: research
  lens foregrounds novelty, citizen foregrounds importance, scale preserved.
- Routing node (routing.stage): the 4th Phase-2 node — HONEST status: routing
  already reached the Constitutional-Projection end-state (modelRouter routeFor is
  ModelQube-driven + standing-ranked + invariant-citing), so this is a thin
  already-authoritative OBSERVER for Observatory parity, not a shadow migration.
  Pure (caller supplies routes; no modelRouter import in the nodes layer).
- Canonize inv.reasoning.157 (the Experience face / lens principle) + appendix.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Y98FMjkM8zUDsYqJikzsMB
```

## Body

- Experience face (services/invariants/experience.ts): the 5 Invariant Lenses
  1:1 to the OperatorArchetype pathways (citizen/clarity, entrepreneurial/progress,
  technical/observability, creative/inspiration, research/discovery). A lens is a
  per-dimension bias applied on top of standing weights, re-normalised to mean 1 —
  same field, per-pathway emphasis, never a fork. Adopted on the discovery node
  (optional archetype → lens; rides DecisionProjection.lens). Verified: research
  lens foregrounds novelty, citizen foregrounds importance, scale preserved.
- Routing node (routing.stage): the 4th Phase-2 node — HONEST status: routing
  already reached the Constitutional-Projection end-state (modelRouter routeFor is
  ModelQube-driven + standing-ranked + invariant-citing), so this is a thin
  already-authoritative OBSERVER for Observatory parity, not a shadow migration.
  Pure (caller supplies routes; no modelRouter import in the nodes layer).
- Canonize inv.reasoning.157 (the Experience face / lens principle) + appendix.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Y98FMjkM8zUDsYqJikzsMB

## Files Changed

| Change | File |
|--------|------|
| Modified | `codexes/packs/irl/foundation/appendix-a_canonical-invariants.md` |
| Modified | `codexes/packs/irl/foundation/canonical-invariants.seed.json` |
| Added | `services/invariants/experience.ts` |
| Modified | `services/invariants/nodes/discoveryRanking.ts` |
| Modified | `services/invariants/nodes/index.ts` |
| Added | `services/invariants/nodes/routingStage.ts` |

## Stats

 6 files changed, 207 insertions(+), 4 deletions(-)
