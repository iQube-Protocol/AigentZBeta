# Commit Brief: `9c15b5d` — intent chains commit 7: wire AigentMeWelcomeSplitTab seam — dispatch + complete

| Field | Value |
|-------|-------|
| SHA | [`9c15b5d`](https://github.com/iQube-Protocol/AigentZBeta/commit/9c15b5db33de5372673f4a39e01393a919cac3fe) |
| Author | Claude |
| Date | 2026-06-02T01:21:03Z |
| Branch | dev (direct push) |
| Type | `feat` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
intent chains commit 7: wire AigentMeWelcomeSplitTab seam — dispatch + complete

The seam the audit identified (AigentMeWelcomeSplitTab.tsx:1227). Two
edits close the loop end-to-end for compose-class CTAs:

1. handleApprovalApprove (after IntentQube creation):
   POST /api/intent-chains/dispatch with initiating_nbe_id + cartridge
   + nbe_seed { handoffHint, label, rationale }. The dispatcher
   resolves a template by triggered_by_nbe match (no template_id
   needed from client). Stores chain_id in chainsByIntent state
   keyed by intent_id so the compose-completion path can find it.
   Best-effort — 404 (no chain template for this NBE) is silent;
   the existing intent flow is unaffected.

2. handleComposeGoogleDoc (after create-artifact succeeds):
   Looks up chain_id from chainsByIntent[composerSourceIntentId];
   if present, POST /api/intent-chains/[chain_id]/complete-step with
   { artifact_id, title }. The server-side advancer transitions the
   chain from compose-brief → submit-to-marketa (the RPC step), which
   calls /api/marketa/propose, which emits proposal_drafted, which
   advances the chain to review-proposal (user-facing pill).
   Best-effort — chain advance failure never blocks the artifact UX.

services/intentChains/dispatcher.ts:
- DispatchInput.template_id is now optional. When omitted with an
  initiating_nbe_id present, the dispatcher resolves the first
  template whose triggered_by_nbe array includes the NBE id.
- DispatchError still surfaces 'template_not_found' if neither path
  resolves a template.

app/api/intent-chains/dispatch/route.ts:
- Body validator updated: either template_id OR initiating_nbe_id is
  required (was: template_id required).
- Error code: template_id_or_initiating_nbe_id_required

Net result for the marketa.ask-partner-proposal worked example:
- User clicks the CTA "Ask Marketa for a partner proposal"
- IntentQube created (existing) + chain dispatched (new)
- Composer opens, user writes brief
- Brief artifact created (existing) + chain advances to
  submit-to-marketa step (new)
- Marketa.propose endpoint hits, emits proposal_drafted (new)
- Listener hook advances chain to review-proposal (new); pill
  materializes via intent_chain_step_user_pending event
- User reviews + confirms (commit 8 pill UI)
- Chain advances to send-to-partner → 3-day delay → follow-up
- Every transition emits DVN-receipt-eligible orchestration_events

The pill UI for review-proposal lands in commit 8.
```

## Body

The seam the audit identified (AigentMeWelcomeSplitTab.tsx:1227). Two
edits close the loop end-to-end for compose-class CTAs:

1. handleApprovalApprove (after IntentQube creation):
   POST /api/intent-chains/dispatch with initiating_nbe_id + cartridge
   + nbe_seed { handoffHint, label, rationale }. The dispatcher
   resolves a template by triggered_by_nbe match (no template_id
   needed from client). Stores chain_id in chainsByIntent state
   keyed by intent_id so the compose-completion path can find it.
   Best-effort — 404 (no chain template for this NBE) is silent;
   the existing intent flow is unaffected.

2. handleComposeGoogleDoc (after create-artifact succeeds):
   Looks up chain_id from chainsByIntent[composerSourceIntentId];
   if present, POST /api/intent-chains/[chain_id]/complete-step with
   { artifact_id, title }. The server-side advancer transitions the
   chain from compose-brief → submit-to-marketa (the RPC step), which
   calls /api/marketa/propose, which emits proposal_drafted, which
   advances the chain to review-proposal (user-facing pill).
   Best-effort — chain advance failure never blocks the artifact UX.

services/intentChains/dispatcher.ts:
- DispatchInput.template_id is now optional. When omitted with an
  initiating_nbe_id present, the dispatcher resolves the first
  template whose triggered_by_nbe array includes the NBE id.
- DispatchError still surfaces 'template_not_found' if neither path
  resolves a template.

app/api/intent-chains/dispatch/route.ts:
- Body validator updated: either template_id OR initiating_nbe_id is
  required (was: template_id required).
- Error code: template_id_or_initiating_nbe_id_required

Net result for the marketa.ask-partner-proposal worked example:
- User clicks the CTA "Ask Marketa for a partner proposal"
- IntentQube created (existing) + chain dispatched (new)
- Composer opens, user writes brief
- Brief artifact created (existing) + chain advances to
  submit-to-marketa step (new)
- Marketa.propose endpoint hits, emits proposal_drafted (new)
- Listener hook advances chain to review-proposal (new); pill
  materializes via intent_chain_step_user_pending event
- User reviews + confirms (commit 8 pill UI)
- Chain advances to send-to-partner → 3-day delay → follow-up
- Every transition emits DVN-receipt-eligible orchestration_events

The pill UI for review-proposal lands in commit 8.

## Files Changed

| Change | File |
|--------|------|
| Modified | `app/api/intent-chains/dispatch/route.ts` |
| Modified | `app/triad/components/codex/tabs/AigentMeWelcomeSplitTab.tsx` |
| Modified | `services/intentChains/dispatcher.ts` |

## Stats

 3 files changed, 87 insertions(+), 7 deletions(-)
