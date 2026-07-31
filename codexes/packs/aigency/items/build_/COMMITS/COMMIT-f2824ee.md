# Commit Brief: `f2824ee` — feat(chain): close execution loop — recommendations spawn child intents

| Field | Value |
|-------|-------|
| SHA | [`f2824ee`](https://github.com/iQube-Protocol/AigentZBeta/commit/f2824ee74ec0b07ea1bfedfd2f30afe6e76131db) |
| Author | Claude |
| Date | 2026-06-04T19:43:19Z |
| Branch | dev (direct push) |
| Type | `feat` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
feat(chain): close execution loop — recommendations spawn child intents

Operator-reported gap: the chain renders Marketa's plan as bullets
but nothing acts on those bullets. Each recommendation was dead
text. This closes the loop.

Mechanism:
- Every recommendation in a specialist response now carries a
  "Queue as next action" button.
- Click → POST /api/assistant/intent-queue-next → spawns a child
  IntentQube referencing the parent via parentIntentId in packed
  rationale (no migration; sentinel-encoded extras already
  accommodate it).
- Child intent shows up in Active Intents under its own row,
  status=in_progress, approvalRequired=true. Expanding it shows
  its own chain timeline with the parent linkage event.
- The parent intent's timeline picks up the spawn via an
  intent_queued activity_receipt with a "recommendation-spawn"
  context tag, so the operator can see in the parent's expand
  panel that the bullet was actioned.
- After spawn, the recommendation chip flips to "Queued"
  (emerald + check icon, button disabled) so the operator can't
  double-spawn.

Loop now closes: parent consultation → bullet recommendations →
each becomes a child intent → operator approves child →
ask-agent fires the actual specialist consultation on that
specific bullet → that consultation produces its own
recommendations → loop continues until the operator marks the
parent complete.

Surfaces wired:
- IntentChainPanel (workspace pill expand) — RecommendationItem
  inside the ReceiptRow's expanded response body
- ActivityReceiptCard (myLedger card expand) —
  RecommendationItemCard inside the specialist response block

Server side:
- intentQube.ts: PackedIntentExtras + IntentQubeRecord +
  IntentQubeCreateInput all carry parentIntentId. rowToRecord
  surfaces it; setIntentQubeStatus preserves it on updates.
- POST /api/assistant/intent-queue-next: spine-gated, owner-
  checks parent intent, validates specialist if supplied,
  inherits parent.targetAgents fallback, creates child + emits
  intent_queued receipt on parent + specialist_invoked event
  on child with parent_intent_id metadata.

T0 / privacy: persona_id never serialized. parent_intent_id
is an nbe_plans row id, not a T0 identifier — safe in metadata.

What this does NOT yet do (deliberate scope):
- Auto-dispatch the child consultation on spawn. The operator
  still has to click Approve on the child intent. This is by
  design — keeps the approval gate visible — but is the next
  obvious build if you want one-click execution end-to-end.
- Propagate prompt edits from the left chat into the right-
  pane CTA rationale. That's a separate state-management bug
  in AigentMeWelcomeSplitTab where the CTA fires the static
  catalog action, not the chat-edited text. Filed as backlog.
- Cross-specialist routing. Children inherit the parent's
  specialist target. Routing "Research Lamina 1" to Know1 vs
  "Draft campaign" to Marketa is a v1.1 follow-up.
```

## Body

Operator-reported gap: the chain renders Marketa's plan as bullets
but nothing acts on those bullets. Each recommendation was dead
text. This closes the loop.

Mechanism:
- Every recommendation in a specialist response now carries a
  "Queue as next action" button.
- Click → POST /api/assistant/intent-queue-next → spawns a child
  IntentQube referencing the parent via parentIntentId in packed
  rationale (no migration; sentinel-encoded extras already
  accommodate it).
- Child intent shows up in Active Intents under its own row,
  status=in_progress, approvalRequired=true. Expanding it shows
  its own chain timeline with the parent linkage event.
- The parent intent's timeline picks up the spawn via an
  intent_queued activity_receipt with a "recommendation-spawn"
  context tag, so the operator can see in the parent's expand
  panel that the bullet was actioned.
- After spawn, the recommendation chip flips to "Queued"
  (emerald + check icon, button disabled) so the operator can't
  double-spawn.

Loop now closes: parent consultation → bullet recommendations →
each becomes a child intent → operator approves child →
ask-agent fires the actual specialist consultation on that
specific bullet → that consultation produces its own
recommendations → loop continues until the operator marks the
parent complete.

Surfaces wired:
- IntentChainPanel (workspace pill expand) — RecommendationItem
  inside the ReceiptRow's expanded response body
- ActivityReceiptCard (myLedger card expand) —
  RecommendationItemCard inside the specialist response block

Server side:
- intentQube.ts: PackedIntentExtras + IntentQubeRecord +
  IntentQubeCreateInput all carry parentIntentId. rowToRecord
  surfaces it; setIntentQubeStatus preserves it on updates.
- POST /api/assistant/intent-queue-next: spine-gated, owner-
  checks parent intent, validates specialist if supplied,
  inherits parent.targetAgents fallback, creates child + emits
  intent_queued receipt on parent + specialist_invoked event
  on child with parent_intent_id metadata.

T0 / privacy: persona_id never serialized. parent_intent_id
is an nbe_plans row id, not a T0 identifier — safe in metadata.

What this does NOT yet do (deliberate scope):
- Auto-dispatch the child consultation on spawn. The operator
  still has to click Approve on the child intent. This is by
  design — keeps the approval gate visible — but is the next
  obvious build if you want one-click execution end-to-end.
- Propagate prompt edits from the left chat into the right-
  pane CTA rationale. That's a separate state-management bug
  in AigentMeWelcomeSplitTab where the CTA fires the static
  catalog action, not the chat-edited text. Filed as backlog.
- Cross-specialist routing. Children inherit the parent's
  specialist target. Routing "Research Lamina 1" to Know1 vs
  "Draft campaign" to Marketa is a v1.1 follow-up.

## Files Changed

| Change | File |
|--------|------|
| Added | `app/api/assistant/intent-queue-next/route.ts` |
| Modified | `components/metame/cards/ActivityReceiptCard.tsx` |
| Modified | `components/metame/workbench/IntentChainPanel.tsx` |
| Modified | `services/iqube/intentQube.ts` |

## Stats

 4 files changed, 463 insertions(+), 9 deletions(-)
