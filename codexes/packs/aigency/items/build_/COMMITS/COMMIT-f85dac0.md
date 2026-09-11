# Commit Brief: `f85dac0` — NBE Act → Queued badge after queue + clickable artifact links in receipts

| Field | Value |
|-------|-------|
| SHA | [`f85dac0`](https://github.com/iQube-Protocol/AigentZBeta/commit/f85dac003523777dbd373787160f4c7ce039045c) |
| Author | Claude |
| Date | 2026-05-26T00:42:07Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
NBE Act → Queued badge after queue + clickable artifact links in receipts

Two small UX bugs, one fix each.

1) Act button stuck on the move-forward hero NBA

Clicking Act fires handleNbeAct, which queues the action server-side
and adds it to queuedIntents state. The handler then short-circuits
on subsequent clicks. But the button stays visually enabled, so the
operator clicks again, nothing visible happens, and they have to
remount the tab before the button looks "fresh" again.

NextBestActionCard gains an optional `queued` prop. When true, the
Act button is replaced with a non-clickable emerald "Queued" badge
(Check icon) so the operator gets explicit feedback that their click
landed and the intent is awaiting review / execution. DecisionBoard
and WelcomeRightPane both pass `queued={!!queuedIntents[topAction.id]}`
on the hero render. Alternates already filter out of the list once
queued, so no change there. BriefCard / VentureCockpit also render
NBE cards with Act buttons — those surfaces share the same stale-Act
exposure and can adopt this prop later when the same regression hits;
the move-forward hero is the user-reported surface today.

2) Artifact reference in activity receipt was a non-clickable badge

Receipts emitted by /api/assistant/create-artifact store entries like
`google-doc:1WFqTS7HTBB4wb7cSQ_nUDyj8JAbErNqKpzrCY6Htk20` in
activity_receipts.artifacts_created. ActivityReceiptCard rendered
each entry as a plain chip — the operator could see WHAT was created
but had no way to open the live artifact, so the receipts surface
was a dead end for any compose flow that didn't surface an
ArtifactCard (anything fired from the bottom-strip compose menu,
which produces a receipt without a card).

Replaces the generic ReceiptLine for the Artifacts row with a
dedicated ArtifactsReceiptLine that parses each entry as
`<type>:<id>` and, when the type is one of:
  google-doc / google-sheet / google-slides / slide-outline /
  gmail-draft / calendar-block
AND the id looks like a real Drive/Gmail/Calendar id (>=15 chars,
[\w-]+ — guards against the title fallback when the connector
didn't return a real id), renders a clickable "Open in Drive /
Gmail / Calendar" button that opens the artifact in a new tab.
Entries with no recognised type, or with id that looks like a title
fallback, still render as plain chips.

Net effect: every compose flow now has a path back to the live
artifact, whether the operator landed on a fresh ArtifactCard
(right-panel template) or a historical receipt row (ledger).
```

## Body

Two small UX bugs, one fix each.

1) Act button stuck on the move-forward hero NBA

Clicking Act fires handleNbeAct, which queues the action server-side
and adds it to queuedIntents state. The handler then short-circuits
on subsequent clicks. But the button stays visually enabled, so the
operator clicks again, nothing visible happens, and they have to
remount the tab before the button looks "fresh" again.

NextBestActionCard gains an optional `queued` prop. When true, the
Act button is replaced with a non-clickable emerald "Queued" badge
(Check icon) so the operator gets explicit feedback that their click
landed and the intent is awaiting review / execution. DecisionBoard
and WelcomeRightPane both pass `queued={!!queuedIntents[topAction.id]}`
on the hero render. Alternates already filter out of the list once
queued, so no change there. BriefCard / VentureCockpit also render
NBE cards with Act buttons — those surfaces share the same stale-Act
exposure and can adopt this prop later when the same regression hits;
the move-forward hero is the user-reported surface today.

2) Artifact reference in activity receipt was a non-clickable badge

Receipts emitted by /api/assistant/create-artifact store entries like
`google-doc:1WFqTS7HTBB4wb7cSQ_nUDyj8JAbErNqKpzrCY6Htk20` in
activity_receipts.artifacts_created. ActivityReceiptCard rendered
each entry as a plain chip — the operator could see WHAT was created
but had no way to open the live artifact, so the receipts surface
was a dead end for any compose flow that didn't surface an
ArtifactCard (anything fired from the bottom-strip compose menu,
which produces a receipt without a card).

Replaces the generic ReceiptLine for the Artifacts row with a
dedicated ArtifactsReceiptLine that parses each entry as
`<type>:<id>` and, when the type is one of:
  google-doc / google-sheet / google-slides / slide-outline /
  gmail-draft / calendar-block
AND the id looks like a real Drive/Gmail/Calendar id (>=15 chars,
[\w-]+ — guards against the title fallback when the connector
didn't return a real id), renders a clickable "Open in Drive /
Gmail / Calendar" button that opens the artifact in a new tab.
Entries with no recognised type, or with id that looks like a title
fallback, still render as plain chips.

Net effect: every compose flow now has a path back to the live
artifact, whether the operator landed on a fresh ArtifactCard
(right-panel template) or a historical receipt row (ledger).

## Files Changed

| Change | File |
|--------|------|
| Modified | `components/metame/cards/ActivityReceiptCard.tsx` |
| Modified | `components/metame/cards/NextBestActionCard.tsx` |
| Modified | `components/metame/welcome/WelcomeRightPane.tsx` |
| Modified | `components/metame/welcome/layouts/DecisionBoardLayout.tsx` |

## Stats

 4 files changed, 119 insertions(+), 2 deletions(-)
