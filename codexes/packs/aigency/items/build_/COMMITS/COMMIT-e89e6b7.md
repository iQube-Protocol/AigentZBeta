# Commit Brief: `e89e6b7` — Codify the Sovereignty Scale: operator control as a spectrum (S0-S3), not a boolean

| Field | Value |
|-------|-------|
| SHA | [`e89e6b7`](https://github.com/iQube-Protocol/AigentZBeta/commit/e89e6b70fdf1b616dec57ebdcfcb8eb574395285) |
| Author | Claude |
| Date | 2026-07-06T16:04:06Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Codify the Sovereignty Scale: operator control as a spectrum (S0-S3), not a boolean

Operator refinement: sovereignty is essentially operator control — the
ability to choose and switch providers without commercial or platform
lock-in (S1, the essence); open weights are the maximum (S3), not the
definition. SOVEREIGNTY_SCALE pinned in types/constitutional.ts with a
canary; glossary redefines Constitutional Sovereignty as the scale and
adds a resolver-wired Sovereignty Scale term (runtime-verified). Drill
publishes now carry sovereigntyRung (rehearsal completion = s2-substitutable,
a live datum; sovereign run = s3-open-weight) and the Chrysalis criteria
narrate the rungs.

Co-Authored-By: Claude <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Y98FMjkM8zUDsYqJikzsMB
```

## Body

Operator refinement: sovereignty is essentially operator control — the
ability to choose and switch providers without commercial or platform
lock-in (S1, the essence); open weights are the maximum (S3), not the
definition. SOVEREIGNTY_SCALE pinned in types/constitutional.ts with a
canary; glossary redefines Constitutional Sovereignty as the scale and
adds a resolver-wired Sovereignty Scale term (runtime-verified). Drill
publishes now carry sovereigntyRung (rehearsal completion = s2-substitutable,
a live datum; sovereign run = s3-open-weight) and the Chrysalis criteria
narrate the rungs.

Co-Authored-By: Claude <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Y98FMjkM8zUDsYqJikzsMB

## Files Changed

| Change | File |
|--------|------|
| Modified | `app/api/constitutional/chrysalis-test/route.ts` |
| Modified | `codexes/packs/agentiq/foundation/CFS-015_operation-chrysalis-2-prd.md` |
| Modified | `codexes/packs/agentiq/foundation/constitutional-glossary.md` |
| Modified | `components/composer/Exp004SovereigntyRunner.tsx` |
| Modified | `tests/constitutional-contracts.test.ts` |
| Modified | `types/constitutional.ts` |

## Stats

 6 files changed, 67 insertions(+), 14 deletions(-)
