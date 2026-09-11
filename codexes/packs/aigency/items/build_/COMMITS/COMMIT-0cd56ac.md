# Commit Brief: `0cd56ac` — operator-gated shadow->authoritative flip control (CFS-035 §11)

| Field | Value |
|-------|-------|
| SHA | [`0cd56ac`](https://github.com/iQube-Protocol/AigentZBeta/commit/0cd56ac6d463e1386483b0f292ab0867cb6ea7cd) |
| Author | Claude |
| Date | 2026-07-16T18:25:19Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
operator-gated shadow->authoritative flip control (CFS-035 §11)

Flipping an Invariant Decision Node makes the runtime serve its projection
instead of the incumbent heuristic — the ratification step.

- migration 20260718010000_invariant_node_flips: node_id, authoritative,
  rationale, flipped_by_persona (T0 audit, server-internal only), flipped_at.
- services/invariants/flipStore.ts: isNodeAuthoritative(+Cached, 30s TTL,
  fail-faithful for the hot path), getNodeFlip/listNodeFlips/setNodeFlip.
  Client-safe projections never include the personaId.
- /api/invariants/flip: GET (flips + viewer isAdmin); POST admin-gated via the
  identity spine (persona.cartridgeFlags.isAdmin — never a parallel gate),
  validates the node is registered, records who/why.
- capsules route: always shadow-observes; serves the discovery projection order
  only when discovery.ranking is authoritative (cached, fail-faithful). Default
  behaviour unchanged (incumbent served).
- Observatory API exposes viewer.isAdmin + the discovery projection's
  authoritative/flippedAt; FieldView Projection gets an admin-only flip toggle
  + AUTHORITATIVE/shadow badge.

Both Observatory migrations are additive; until applied the engine degrades to
in-memory observations + shadow-only (no behaviour change).

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Y98FMjkM8zUDsYqJikzsMB
```

## Body

Flipping an Invariant Decision Node makes the runtime serve its projection
instead of the incumbent heuristic — the ratification step.

- migration 20260718010000_invariant_node_flips: node_id, authoritative,
  rationale, flipped_by_persona (T0 audit, server-internal only), flipped_at.
- services/invariants/flipStore.ts: isNodeAuthoritative(+Cached, 30s TTL,
  fail-faithful for the hot path), getNodeFlip/listNodeFlips/setNodeFlip.
  Client-safe projections never include the personaId.
- /api/invariants/flip: GET (flips + viewer isAdmin); POST admin-gated via the
  identity spine (persona.cartridgeFlags.isAdmin — never a parallel gate),
  validates the node is registered, records who/why.
- capsules route: always shadow-observes; serves the discovery projection order
  only when discovery.ranking is authoritative (cached, fail-faithful). Default
  behaviour unchanged (incumbent served).
- Observatory API exposes viewer.isAdmin + the discovery projection's
  authoritative/flippedAt; FieldView Projection gets an admin-only flip toggle
  + AUTHORITATIVE/shadow badge.

Both Observatory migrations are additive; until applied the engine degrades to
in-memory observations + shadow-only (no behaviour change).

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Y98FMjkM8zUDsYqJikzsMB

## Files Changed

| Change | File |
|--------|------|
| Added | `app/api/invariants/flip/route.ts` |
| Modified | `app/api/invariants/observatory/route.ts` |
| Modified | `app/api/runtime/capsules/route.ts` |
| Modified | `codexes/packs/agentiq/collections.json` |
| Added | `codexes/packs/agentiq/updates/2026-07-18_observatory-history-graph-flip.md` |
| Modified | `components/registry/FieldView.tsx` |
| Added | `services/invariants/flipStore.ts` |
| Added | `supabase/migrations/20260718010000_invariant_node_flips.sql` |

## Stats

 8 files changed, 433 insertions(+), 24 deletions(-)
