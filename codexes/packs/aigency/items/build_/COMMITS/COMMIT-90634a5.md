# Commit Brief: `90634a5` — Fix gap-analysis regression: stage detector is a hint, never a suppressor

| Field | Value |
|-------|-------|
| SHA | [`90634a5`](https://github.com/iQube-Protocol/AigentZBeta/commit/90634a54304884d41cb064cd4fde1186cec68ef9) |
| Author | Claude |
| Date | 2026-07-06T14:43:10Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Fix gap-analysis regression: stage detector is a hint, never a suppressor

The detector ranked bare implement/implementation above gaps and replaced
the capsule/session stage outright, hijacking gap-analysis requests to the
implementation stage — the Gaps card never received a proposal and the
sequence starved (consequences unreachable). Now: gap outranks
implementation, implementation matches phrase-level signals only, and when
the detected stage differs from the capsule/session stage BOTH schemas are
presented so the LLM emits the kind the operator actually means (the
ratified dual-schema design). Regression canaries added.

Co-Authored-By: Claude <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Y98FMjkM8zUDsYqJikzsMB
```

## Body

The detector ranked bare implement/implementation above gaps and replaced
the capsule/session stage outright, hijacking gap-analysis requests to the
implementation stage — the Gaps card never received a proposal and the
sequence starved (consequences unreachable). Now: gap outranks
implementation, implementation matches phrase-level signals only, and when
the detected stage differs from the capsule/session stage BOTH schemas are
presented so the LLM emits the kind the operator actually means (the
ratified dual-schema design). Regression canaries added.

Co-Authored-By: Claude <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Y98FMjkM8zUDsYqJikzsMB

## Files Changed

| Change | File |
|--------|------|
| Modified | `app/api/codex/chat/route.ts` |
| Modified | `codexes/packs/agentiq/foundation/CFS-015_operation-chrysalis-2-prd.md` |
| Modified | `services/devCommandCenter/stageOrchestrator.ts` |
| Modified | `tests/dev-command-center.test.ts` |

## Stats

 4 files changed, 75 insertions(+), 11 deletions(-)
