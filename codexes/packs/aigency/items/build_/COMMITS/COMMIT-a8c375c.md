# Commit Brief: `a8c375c` — extend activity_receipts action types for factor+aegis constitutional decisions

| Field | Value |
|-------|-------|
| SHA | [`a8c375c`](https://github.com/iQube-Protocol/AigentZBeta/commit/a8c375cdd98a5d494bce49084629cd8f91eaf2ce) |
| Author | Claude |
| Date | 2026-09-04T17:08:31Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
extend activity_receipts action types for factor+aegis constitutional decisions

11 new ActivityActionType union members (factor case pipeline, aegis
assessment lifecycle, moneypenny admission decision, authority chain
establish/revoke, standing proposal) plus the matching wholesale CHECK
constraint rebuild in the same migration commit. 6 of the 11 (the
ratified decisions, not pre-decision pipeline events) added to
ANCHORABLE_ACTION_TYPES — the one unilaterally-permitted DVN pipeline
change per CLAUDE.md. tests/activity-receipts-action-type-parity.test.ts
passes.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01S5Y1pnDdW3LyguwPdfJjXy
```

## Body

11 new ActivityActionType union members (factor case pipeline, aegis
assessment lifecycle, moneypenny admission decision, authority chain
establish/revoke, standing proposal) plus the matching wholesale CHECK
constraint rebuild in the same migration commit. 6 of the 11 (the
ratified decisions, not pre-decision pipeline events) added to
ANCHORABLE_ACTION_TYPES — the one unilaterally-permitted DVN pipeline
change per CLAUDE.md. tests/activity-receipts-action-type-parity.test.ts
passes.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01S5Y1pnDdW3LyguwPdfJjXy

## Files Changed

| Change | File |
|--------|------|
| Modified | `services/dvn/activityReceiptDvnPipeline.ts` |
| Modified | `services/receipts/activityReceiptService.ts` |

## Stats

 2 files changed, 36 insertions(+), 1 deletion(-)
