# Commit Brief: `e2c6663` — seed CFS-035 discovery-ranking invariants (inv.reasoning.134-137)

| Field | Value |
|-------|-------|
| SHA | [`e2c6663`](https://github.com/iQube-Protocol/AigentZBeta/commit/e2c6663ca07f1dca93944dec28da227cb87fdc31) |
| Author | Claude |
| Date | 2026-07-16T17:43:51Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
seed CFS-035 discovery-ranking invariants (inv.reasoning.134-137)

Author the four discovery-ranking dimension invariants the CFS-035
discovery node projects (importance/novelty/trust/need), extracted from
the scoreCapsule magic numbers. Context discovery/ranking so the
domains:['discovery'] Field Snapshot slice matches them. proposed until
validated — deriveDimensionWeights stays faithful (all-1) while proposed,
so the shadow->authoritative flip becomes meaningful only once these earn
standing. Fixes the discovery node's DIMENSION_INVARIANT_SEED, which
referenced non-existent ids 086-089 (those numbers belong to other
namespaces). Mirror added to appendix-a in the same commit.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Y98FMjkM8zUDsYqJikzsMB
```

## Body

Author the four discovery-ranking dimension invariants the CFS-035
discovery node projects (importance/novelty/trust/need), extracted from
the scoreCapsule magic numbers. Context discovery/ranking so the
domains:['discovery'] Field Snapshot slice matches them. proposed until
validated — deriveDimensionWeights stays faithful (all-1) while proposed,
so the shadow->authoritative flip becomes meaningful only once these earn
standing. Fixes the discovery node's DIMENSION_INVARIANT_SEED, which
referenced non-existent ids 086-089 (those numbers belong to other
namespaces). Mirror added to appendix-a in the same commit.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Y98FMjkM8zUDsYqJikzsMB

## Files Changed

| Change | File |
|--------|------|
| Modified | `codexes/packs/irl/foundation/appendix-a_canonical-invariants.md` |
| Modified | `codexes/packs/irl/foundation/canonical-invariants.seed.json` |
| Modified | `services/invariants/nodes/discoveryRanking.ts` |

## Stats

 3 files changed, 69 insertions(+), 4 deletions(-)
