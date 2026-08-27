# Commit Brief: `e8f6696` — Stage 9 duplicate-pair queue: server-derived recommendations, complete receipting, authoritative advance

| Field | Value |
|-------|-------|
| SHA | [`e8f6696`](https://github.com/iQube-Protocol/AigentZBeta/commit/e8f669600ee34615cd1e1a3052b8e3f072af98a7) |
| Author | Claude |
| Date | 2026-08-27T02:49:02Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Stage 9 duplicate-pair queue: server-derived recommendations, complete receipting, authoritative advance

Replaces bare-id "keep A / keep B" adjudication with a real queue: each pair
now carries full statements and a server-derived survivor recommendation
(services/research/invariantDuplicateRecommendation.ts — provenance
eligibility, lifecycle status, standing, live relationship count, ratified
source, deterministic tiebreak; never a PROVENANCE_CLASSES strength ranking,
which the vocabulary's own doc comment refuses to assert).

crystalReadiness.ts enriches duplicate-detection's pairs in the same read
that finds them, reusing the existing intra-crystal edge fetch (hoisted
ahead of duplicate-detection) rather than a second query.

The merge route re-validates the submitted pair against a fresh read of the
same authoritative loadTrack2ProgrammeState composition every Track 2 GET
uses, rejecting a stale/out-of-scope pair with 409, and derives every
receipt field itself (recommendedId, operatorFollowedRecommendation,
confidence, reasons, pairIds) — the client sends only survivorId/mergedId/an
optional override reason. mergeInvariants gained an optional decisionContext
parameter forwarded to the existing invariant_superseded receipt's
actionInput; no new action type, no change to its edge/context/status
preservation semantics.

Track2ProgrammePanel's duplicate queue now renders one pair at a time with
no local resolution-tracking state: after each merge it re-reads the
authoritative Track 2 GET, and only once that reading confirms zero pairs
remain does it POST the canonical orchestrator advance route and scroll
using the response's own pendingDecision.deepLink.surfaceRef.anchorId.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01NQfGRfi4TgkQbnzUxbMKG9
```

## Body

Replaces bare-id "keep A / keep B" adjudication with a real queue: each pair
now carries full statements and a server-derived survivor recommendation
(services/research/invariantDuplicateRecommendation.ts — provenance
eligibility, lifecycle status, standing, live relationship count, ratified
source, deterministic tiebreak; never a PROVENANCE_CLASSES strength ranking,
which the vocabulary's own doc comment refuses to assert).

crystalReadiness.ts enriches duplicate-detection's pairs in the same read
that finds them, reusing the existing intra-crystal edge fetch (hoisted
ahead of duplicate-detection) rather than a second query.

The merge route re-validates the submitted pair against a fresh read of the
same authoritative loadTrack2ProgrammeState composition every Track 2 GET
uses, rejecting a stale/out-of-scope pair with 409, and derives every
receipt field itself (recommendedId, operatorFollowedRecommendation,
confidence, reasons, pairIds) — the client sends only survivorId/mergedId/an
optional override reason. mergeInvariants gained an optional decisionContext
parameter forwarded to the existing invariant_superseded receipt's
actionInput; no new action type, no change to its edge/context/status
preservation semantics.

Track2ProgrammePanel's duplicate queue now renders one pair at a time with
no local resolution-tracking state: after each merge it re-reads the
authoritative Track 2 GET, and only once that reading confirms zero pairs
remain does it POST the canonical orchestrator advance route and scroll
using the response's own pendingDecision.deepLink.surfaceRef.anchorId.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01NQfGRfi4TgkQbnzUxbMKG9

## Files Changed

| Change | File |
|--------|------|
| Modified | `app/api/research/track2/[experimentId]/duplicate-pairs/merge/route.ts` |
| Modified | `components/research/Track2ProgrammePanel.tsx` |
| Modified | `services/invariants/lifecycle.ts` |
| Modified | `services/research/crystalReadiness.ts` |
| Added | `services/research/invariantDuplicateRecommendation.ts` |
| Added | `tests/invariant-duplicate-recommendation.test.ts` |
| Added | `tests/invariant-lifecycle-merge-receipt.test.ts` |
| Added | `tests/track2-duplicate-pairs-merge-route.test.ts` |

## Stats

 8 files changed, 1113 insertions(+), 106 deletions(-)
