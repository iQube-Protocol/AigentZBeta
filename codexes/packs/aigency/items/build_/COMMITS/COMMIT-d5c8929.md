# Commit Brief: `d5c8929` — Add EXP-003 rediscovery-savings benchmark harness (CFS-008 §2)

| Field | Value |
|-------|-------|
| SHA | [`d5c8929`](https://github.com/iQube-Protocol/AigentZBeta/commit/d5c8929237ec331f65348d20295c31d00637785a) |
| Author | Claude |
| Date | 2026-07-04T06:20:50Z |
| Branch | dev (direct push) |
| Type | `feat` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Add EXP-003 rediscovery-savings benchmark harness (CFS-008 §2)

Operator-run A/B harness: the same five fixed constitutional-design
tasks answered cold vs initialized with EXP-001's 18-invariant closure,
same model at temperature 0. Measures output tokens per arm (the
rediscovery cost), grounded-claim share and canon contradictions via an
independent judge pass, and distinct invariants cited. Results JSON +
markdown summary land in the experiment directory; the README carries
the hypothesis, method, run instructions, and Law XII honesty notes.

Co-Authored-By: Claude <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Y98FMjkM8zUDsYqJikzsMB
```

## Body

Operator-run A/B harness: the same five fixed constitutional-design
tasks answered cold vs initialized with EXP-001's 18-invariant closure,
same model at temperature 0. Measures output tokens per arm (the
rediscovery cost), grounded-claim share and canon contradictions via an
independent judge pass, and distinct invariants cited. Results JSON +
markdown summary land in the experiment directory; the README carries
the hypothesis, method, run instructions, and Law XII honesty notes.

Co-Authored-By: Claude <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Y98FMjkM8zUDsYqJikzsMB

## Files Changed

| Change | File |
|--------|------|
| Modified | `codexes/packs/agentiq/collections.json` |
| Added | `codexes/packs/agentiq/foundation/experiments/exp-003-rediscovery-savings/README.md` |
| Added | `scripts/benchmark-rediscovery.mjs` |

## Stats

 3 files changed, 368 insertions(+), 2 deletions(-)
