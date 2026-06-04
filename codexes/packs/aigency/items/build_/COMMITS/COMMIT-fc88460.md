# Commit Brief: `fc88460` — feat(chain): persist specialist response + chain section in myLedger

| Field | Value |
|-------|-------|
| SHA | [`fc88460`](https://github.com/iQube-Protocol/AigentZBeta/commit/fc884603fac61dde0f9c9a61c8e4b736945cde14) |
| Author | Claude |
| Date | 2026-06-04T03:43:51Z |
| Branch | dev (direct push) |
| Type | `feat` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
feat(chain): persist specialist response + chain section in myLedger

Closes the two follow-ups on the chain-of-intent visibility gap:

1. Marketa's proposal body is now durable on the receipt.
   - Migration adds activity_receipts.specialist_response (jsonb,
     nullable). Carries { title, summary, recommendations[],
     suggestedArtifacts[], confidence, source }.
   - activityReceiptService round-trips it on insert + read.
   - /api/assistant/ask-agent persists the full SpecialistResponse
     on the specialist_consulted receipt at consultation time.
   - /api/assistant/intent-chain returns it under receipts[].
   - IntentChainPanel renders a "Show specialist response" toggle
     under each receipt row that reveals the summary +
     recommendations + suggested artifacts inline.
   - ActivityReceiptCard renders a Specialist response block at
     the top of the expanded card with the same content.

2. myLedger cards now surface the chain context.
   - ActivityReceiptCard swapped from JSON-only expansion to three
     sections: (a) Specialist response body (when present),
     (b) Chain of intent panel (lazy-fetched from
     /api/assistant/intent-chain?intentId when intentId is present
     on the receipt) which reuses the same IntentChainPanel +
     useIntentChainCache pattern as the workspace pill, (c) Show
     receipt JSON toggle for power users (collapsed by default
     instead of being the only payload).
   - MyLedgerTab swapped from its inline <li> render to
     ActivityReceiptCard so every receipt across the ledger
     inherits the same expansion experience: the operator can
     click any "Specialist consulted" card and see the chain of
     sibling receipts in this intent plus Marketa's actual
     proposal text — closing the "can't move the task to
     completion" feedback loop.

T0 / privacy: specialist_response is persona-scoped via the
parent row's existing RLS; the new field is never serialized
alongside personaId, authProfileId, rootDid, or any T0
identifier (none are on the projection).

Operator action: apply
supabase/migrations/20260603100000_activity_receipts_specialist_response.sql
```

## Body

Closes the two follow-ups on the chain-of-intent visibility gap:

1. Marketa's proposal body is now durable on the receipt.
   - Migration adds activity_receipts.specialist_response (jsonb,
     nullable). Carries { title, summary, recommendations[],
     suggestedArtifacts[], confidence, source }.
   - activityReceiptService round-trips it on insert + read.
   - /api/assistant/ask-agent persists the full SpecialistResponse
     on the specialist_consulted receipt at consultation time.
   - /api/assistant/intent-chain returns it under receipts[].
   - IntentChainPanel renders a "Show specialist response" toggle
     under each receipt row that reveals the summary +
     recommendations + suggested artifacts inline.
   - ActivityReceiptCard renders a Specialist response block at
     the top of the expanded card with the same content.

2. myLedger cards now surface the chain context.
   - ActivityReceiptCard swapped from JSON-only expansion to three
     sections: (a) Specialist response body (when present),
     (b) Chain of intent panel (lazy-fetched from
     /api/assistant/intent-chain?intentId when intentId is present
     on the receipt) which reuses the same IntentChainPanel +
     useIntentChainCache pattern as the workspace pill, (c) Show
     receipt JSON toggle for power users (collapsed by default
     instead of being the only payload).
   - MyLedgerTab swapped from its inline <li> render to
     ActivityReceiptCard so every receipt across the ledger
     inherits the same expansion experience: the operator can
     click any "Specialist consulted" card and see the chain of
     sibling receipts in this intent plus Marketa's actual
     proposal text — closing the "can't move the task to
     completion" feedback loop.

T0 / privacy: specialist_response is persona-scoped via the
parent row's existing RLS; the new field is never serialized
alongside personaId, authProfileId, rootDid, or any T0
identifier (none are on the projection).

Operator action: apply
supabase/migrations/20260603100000_activity_receipts_specialist_response.sql

## Files Changed

| Change | File |
|--------|------|
| Modified | `app/api/assistant/ask-agent/route.ts` |
| Modified | `app/api/assistant/intent-chain/route.ts` |
| Modified | `app/triad/components/codex/tabs/MyLedgerTab.tsx` |
| Modified | `components/metame/cards/ActivityReceiptCard.tsx` |
| Modified | `components/metame/workbench/IntentChainPanel.tsx` |
| Modified | `services/receipts/activityReceiptService.ts` |
| Added | `supabase/migrations/20260603100000_activity_receipts_specialist_response.sql` |

## Stats

 7 files changed, 428 insertions(+), 119 deletions(-)
