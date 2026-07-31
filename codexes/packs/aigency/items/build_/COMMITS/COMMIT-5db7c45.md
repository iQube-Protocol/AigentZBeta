# Commit Brief: `5db7c45` — Add EXP-004 rehearsal arm: frontier fallback validates drill machinery while venice credits pend

| Field | Value |
|-------|-------|
| SHA | [`5db7c45`](https://github.com/iQube-Protocol/AigentZBeta/commit/5db7c45dcdb496807bf0b719349e47593550f3ae) |
| Author | Claude |
| Date | 2026-07-06T15:36:09Z |
| Branch | dev (direct push) |
| Type | `feat` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Add EXP-004 rehearsal arm: frontier fallback validates drill machinery while venice credits pend

Operator-directed unblock: the identical battery runs on openai (or
anthropic) in rehearsal mode — venice deliberately excluded from the
rehearsal allowlist because a venice run IS the sovereign drill. Honest
semantics at every layer: rehearsal publishes carry rehearsal:true and no
sovereigntyHolds; the banner reads Machinery VALIDATED, never Sovereignty
HOLDS; the Chrysalis sovereignty criterion reads the latest non-rehearsal
run for pass/fail and reports rehearsal-only history as partial. Runner
defaults into rehearsal when the venice key is absent. ChainGPT verified
present on the chat surface but not wired as an experiment adapter
(streaming-only API, no usage tokens for the degradation report). Canaries
pin the allowlist and exclusions.

Co-Authored-By: Claude <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Y98FMjkM8zUDsYqJikzsMB
```

## Body

Operator-directed unblock: the identical battery runs on openai (or
anthropic) in rehearsal mode — venice deliberately excluded from the
rehearsal allowlist because a venice run IS the sovereign drill. Honest
semantics at every layer: rehearsal publishes carry rehearsal:true and no
sovereigntyHolds; the banner reads Machinery VALIDATED, never Sovereignty
HOLDS; the Chrysalis sovereignty criterion reads the latest non-rehearsal
run for pass/fail and reports rehearsal-only history as partial. Runner
defaults into rehearsal when the venice key is absent. ChainGPT verified
present on the chat surface but not wired as an experiment adapter
(streaming-only API, no usage tokens for the degradation report). Canaries
pin the allowlist and exclusions.

Co-Authored-By: Claude <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Y98FMjkM8zUDsYqJikzsMB

## Files Changed

| Change | File |
|--------|------|
| Modified | `app/api/constitutional/chrysalis-test/route.ts` |
| Modified | `app/api/experiments/exp004/route.ts` |
| Modified | `codexes/packs/agentiq/foundation/CFS-015_operation-chrysalis-2-prd.md` |
| Modified | `components/composer/Exp004SovereigntyRunner.tsx` |
| Modified | `services/experiments/exp004.ts` |
| Modified | `tests/constitutional-contracts.test.ts` |

## Stats

 6 files changed, 275 insertions(+), 51 deletions(-)
