# Commit Brief: `5caee4a` — feat(chain): operator-driven advance — Approve / Mark complete / Cancel

| Field | Value |
|-------|-------|
| SHA | [`5caee4a`](https://github.com/iQube-Protocol/AigentZBeta/commit/5caee4afff9fbb2cd566f86861a8a6ec03687e20) |
| Author | Claude |
| Date | 2026-06-04T18:32:42Z |
| Branch | dev (direct push) |
| Type | `feat` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
feat(chain): operator-driven advance — Approve / Mark complete / Cancel

Adds the action surface the operator was missing: every chain-of-
intent header now carries Approve, Mark complete, and Cancel
buttons that POST /api/assistant/intent-advance and refresh the
panel in place. Closes the "I see the action plan but can't move
the task along" gap.

1. POST /api/assistant/intent-advance — spine-gated, owner-checked.
   Body: { intentId, action: 'approve' | 'complete' | 'cancel',
   note?: string }. Side effects:
   - 'approve':  emits approval_granted receipt (chain header status
                 flips draft-ready → delivered)
   - 'complete': sets intent status to completed + emits
                 session_completed receipt (workspace pill flips
                 Green, header reads "complete")
   - 'cancel':   sets intent status to cancelled + emits
                 approval_rejected receipt
   Idempotent on terminated intents — re-clicks return current state
   instead of erroring.

2. IntentChainPanel — new ChainActionRow component renders inside
   the Chain-of-intent header when intentId + onAdvanced are
   provided. Hides itself once intentStatus is 'completed' or
   'cancelled' so the operator can't re-advance a terminated row.
   Approve button label flips to "Re-approve" when an
   approval_granted receipt is already present.

3. useIntentChainCache — added invalidate(intentId) so callers can
   force a re-fetch after an action lands without juggling the
   underlying cache map. Pattern: action → onAdvanced →
   invalidate(intentId) + refetchIntents() → header re-derives.

4. MyWorkspaceTab — wires intentId + intentStatus + onAdvanced into
   the panel. handleIntentAdvanced both invalidates the chain cache
   and refetches the workspace pill list so the status chip
   (in progress → completed/cancelled) updates without a tab
   round-trip. Intents fetch extracted into refetchIntents callback
   so the action handler can call it directly.

5. ActivityReceiptCard — same plumbing for myLedger. fetchChain
   extracted into a callback that doubles as the onAdvanced
   refresh; intentStatus pulled from the chain payload's intent
   block so the action row hides correctly on terminated rows.

T0 / privacy: persona_id never leaves the server. All new receipts
flow through the existing createActivityReceipt service with its
T1-safe projection. No T0 fields introduced.
```

## Body

Adds the action surface the operator was missing: every chain-of-
intent header now carries Approve, Mark complete, and Cancel
buttons that POST /api/assistant/intent-advance and refresh the
panel in place. Closes the "I see the action plan but can't move
the task along" gap.

1. POST /api/assistant/intent-advance — spine-gated, owner-checked.
   Body: { intentId, action: 'approve' | 'complete' | 'cancel',
   note?: string }. Side effects:
   - 'approve':  emits approval_granted receipt (chain header status
                 flips draft-ready → delivered)
   - 'complete': sets intent status to completed + emits
                 session_completed receipt (workspace pill flips
                 Green, header reads "complete")
   - 'cancel':   sets intent status to cancelled + emits
                 approval_rejected receipt
   Idempotent on terminated intents — re-clicks return current state
   instead of erroring.

2. IntentChainPanel — new ChainActionRow component renders inside
   the Chain-of-intent header when intentId + onAdvanced are
   provided. Hides itself once intentStatus is 'completed' or
   'cancelled' so the operator can't re-advance a terminated row.
   Approve button label flips to "Re-approve" when an
   approval_granted receipt is already present.

3. useIntentChainCache — added invalidate(intentId) so callers can
   force a re-fetch after an action lands without juggling the
   underlying cache map. Pattern: action → onAdvanced →
   invalidate(intentId) + refetchIntents() → header re-derives.

4. MyWorkspaceTab — wires intentId + intentStatus + onAdvanced into
   the panel. handleIntentAdvanced both invalidates the chain cache
   and refetches the workspace pill list so the status chip
   (in progress → completed/cancelled) updates without a tab
   round-trip. Intents fetch extracted into refetchIntents callback
   so the action handler can call it directly.

5. ActivityReceiptCard — same plumbing for myLedger. fetchChain
   extracted into a callback that doubles as the onAdvanced
   refresh; intentStatus pulled from the chain payload's intent
   block so the action row hides correctly on terminated rows.

T0 / privacy: persona_id never leaves the server. All new receipts
flow through the existing createActivityReceipt service with its
T1-safe projection. No T0 fields introduced.

## Files Changed

| Change | File |
|--------|------|
| Added | `app/api/assistant/intent-advance/route.ts` |
| Modified | `app/triad/components/codex/tabs/MyWorkspaceTab.tsx` |
| Modified | `components/metame/cards/ActivityReceiptCard.tsx` |
| Modified | `components/metame/workbench/IntentChainPanel.tsx` |

## Stats

 4 files changed, 390 insertions(+), 59 deletions(-)
