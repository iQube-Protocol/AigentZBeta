# Commit Brief: `a932a8e` — Charter CFS-034 research progression ladder + standing->rung mapping helper

| Field | Value |
|-------|-------|
| SHA | [`a932a8e`](https://github.com/iQube-Protocol/AigentZBeta/commit/a932a8ee9f45642c3d9f05eb752e7288f63a7d4a) |
| Author | Claude |
| Date | 2026-07-16T04:41:14Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Charter CFS-034 research progression ladder + standing->rung mapping helper

Operator confirmed "yes build it" for Aleatheon's seven-rung research ladder.

- CFS-034: the ladder as a TWO-AXIS model — standing (earned recognition,
  rungs 1-5) vs governance role (rungs 6-7); tooling (research_copilot tier)
  gates capability, never a rung. Paying never buys a rung; ratification stays
  a human constitutional act. Subscription alignment table (Explorer/Researcher/
  Steward/Founder Office) + scope guards + follow-ons.
- services/research/researchLadder.ts: pure, T2-safe researchLevelFor() mapping
  standingScore + role/tooling flags -> rung + next-rung requirement. Reuses the
  existing Standing composite (QUALIFY_THRESHOLD=25); no new scoring/persistence.
- registered CFS-034 in the irl pack collections.json

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Y98FMjkM8zUDsYqJikzsMB
```

## Body

Operator confirmed "yes build it" for Aleatheon's seven-rung research ladder.

- CFS-034: the ladder as a TWO-AXIS model — standing (earned recognition,
  rungs 1-5) vs governance role (rungs 6-7); tooling (research_copilot tier)
  gates capability, never a rung. Paying never buys a rung; ratification stays
  a human constitutional act. Subscription alignment table (Explorer/Researcher/
  Steward/Founder Office) + scope guards + follow-ons.
- services/research/researchLadder.ts: pure, T2-safe researchLevelFor() mapping
  standingScore + role/tooling flags -> rung + next-rung requirement. Reuses the
  existing Standing composite (QUALIFY_THRESHOLD=25); no new scoring/persistence.
- registered CFS-034 in the irl pack collections.json

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Y98FMjkM8zUDsYqJikzsMB

## Files Changed

| Change | File |
|--------|------|
| Modified | `codexes/packs/irl/collections.json` |
| Added | `codexes/packs/irl/foundation/CFS-034_research-progression-ladder.md` |
| Added | `services/research/researchLadder.ts` |

## Stats

 3 files changed, 236 insertions(+)
