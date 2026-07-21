# Commit Brief: `7186b5b` — Refine sovereignty as a provider-class property (open-weight), pin with canary

| Field | Value |
|-------|-------|
| SHA | [`7186b5b`](https://github.com/iQube-Protocol/AigentZBeta/commit/7186b5bc3fd148d040aff70c1b286c3049cbfb21) |
| Author | Claude |
| Date | 2026-07-06T15:49:16Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Refine sovereignty as a provider-class property (open-weight), pin with canary

Operator refinement: the sovereignty claim is about running on a
non-frontier (open-weight) provider alone — venice by class membership,
not by name. SOVEREIGN_CLASS exported and canary-pinned to the
constitutional provider inventory's kind field; drill UI copy updated
(Sovereign toggle reads open-weight, intro + rehearsal banner explain the
class semantics and that a forced openai run tests full capability
end-to-end incl. usage tokens). No behavioral change to the gate.

Co-Authored-By: Claude <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Y98FMjkM8zUDsYqJikzsMB
```

## Body

Operator refinement: the sovereignty claim is about running on a
non-frontier (open-weight) provider alone — venice by class membership,
not by name. SOVEREIGN_CLASS exported and canary-pinned to the
constitutional provider inventory's kind field; drill UI copy updated
(Sovereign toggle reads open-weight, intro + rehearsal banner explain the
class semantics and that a forced openai run tests full capability
end-to-end incl. usage tokens). No behavioral change to the gate.

Co-Authored-By: Claude <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Y98FMjkM8zUDsYqJikzsMB

## Files Changed

| Change | File |
|--------|------|
| Modified | `codexes/packs/agentiq/foundation/CFS-015_operation-chrysalis-2-prd.md` |
| Modified | `components/composer/Exp004SovereigntyRunner.tsx` |
| Modified | `services/experiments/exp004.ts` |
| Modified | `tests/constitutional-contracts.test.ts` |

## Stats

 4 files changed, 38 insertions(+), 9 deletions(-)
