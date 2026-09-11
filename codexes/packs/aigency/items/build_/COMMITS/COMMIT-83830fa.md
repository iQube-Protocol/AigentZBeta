# Commit Brief: `83830fa` — ArtifactCard: surface pop-out link for live artifacts + Enable-API CTA

| Field | Value |
|-------|-------|
| SHA | [`83830fa`](https://github.com/iQube-Protocol/AigentZBeta/commit/83830fa52d04df6df3b1ef08429e4309368bfca5) |
| Author | Claude |
| Date | 2026-05-24T20:50:48Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
ArtifactCard: surface pop-out link for live artifacts + Enable-API CTA

Two related fixes for the artifact completion card.

1) Pop-out link visibility

The link to view the live Google Doc / Sheet / Slides / Calendar
event / Gmail draft was previously gated to status ∈ {approved, sent,
published}. That rule existed for the right reason — approval-gated
Gmail drafts and Calendar invites shouldn't show an "Open" link
side-by-side with the "Send draft" button or operators click the
wrong one and the in-app approval never runs.

But for artifacts with no pending external send (e.g. a private
Google Doc created in the operator's own Drive, where there is no
share + no actionConnectorId), the resource is already live. The
draft-state gate was hiding a perfectly valid link.

Relaxes the gate: show the link when locationUrl exists AND either
the status is post-approval (existing path) OR there is no pending
action connector. The UX-trap rule still holds for the approval-
gated path via `data.actionConnectorId`. Also widens
`ArtifactCardData.destination` to include 'calendar' (the route
already emits this string) and adds a "View in Calendar" label.

2) Partial-success warning + Enable-API CTA

When the Google Docs body insert fails because the Docs API isn't
enabled on the project, the connector still creates the title-only
doc (Drive create succeeds) and returns a warning string like:

  Body insert failed (403): { "error": { "code": 403, "message":
  "Google Docs API has not been used in project 73021901849 before
  or it is disabled. Enable it by visiting
  https://console.developers.google.com/apis/api/...

The route was concatenating that warning into `message` as plain
muted text, so the operator saw the failure description but had no
clickable path to fix it — the Cloud Console URL was buried in a
truncated 200-char excerpt.

Splits warning into its own optional field on CreateArtifactSurface
+ ArtifactCardData. The card now renders it as an amber callout with
an AlertTriangle icon. When the warning text contains a Google Cloud
Console URL (https://console.{developers,cloud}.google.com/apis/api/
…), the URL is extracted and surfaced as a clickable "Enable API"
button so the operator can flip the switch in one click and re-run
the artifact. Non-Google-API URLs render as a generic "Open link"
CTA. Warnings with no URL render the text alone.

Net effect for the user's reported case: the title-only Google Doc
shows a "View in Drive" link AND an amber "Enable API →" button
pointing directly at the Cloud Console page for the disabled Docs
API. Click Enable, re-run, full doc lands.
```

## Body

Two related fixes for the artifact completion card.

1) Pop-out link visibility

The link to view the live Google Doc / Sheet / Slides / Calendar
event / Gmail draft was previously gated to status ∈ {approved, sent,
published}. That rule existed for the right reason — approval-gated
Gmail drafts and Calendar invites shouldn't show an "Open" link
side-by-side with the "Send draft" button or operators click the
wrong one and the in-app approval never runs.

But for artifacts with no pending external send (e.g. a private
Google Doc created in the operator's own Drive, where there is no
share + no actionConnectorId), the resource is already live. The
draft-state gate was hiding a perfectly valid link.

Relaxes the gate: show the link when locationUrl exists AND either
the status is post-approval (existing path) OR there is no pending
action connector. The UX-trap rule still holds for the approval-
gated path via `data.actionConnectorId`. Also widens
`ArtifactCardData.destination` to include 'calendar' (the route
already emits this string) and adds a "View in Calendar" label.

2) Partial-success warning + Enable-API CTA

When the Google Docs body insert fails because the Docs API isn't
enabled on the project, the connector still creates the title-only
doc (Drive create succeeds) and returns a warning string like:

  Body insert failed (403): { "error": { "code": 403, "message":
  "Google Docs API has not been used in project 73021901849 before
  or it is disabled. Enable it by visiting
  https://console.developers.google.com/apis/api/...

The route was concatenating that warning into `message` as plain
muted text, so the operator saw the failure description but had no
clickable path to fix it — the Cloud Console URL was buried in a
truncated 200-char excerpt.

Splits warning into its own optional field on CreateArtifactSurface
+ ArtifactCardData. The card now renders it as an amber callout with
an AlertTriangle icon. When the warning text contains a Google Cloud
Console URL (https://console.{developers,cloud}.google.com/apis/api/
…), the URL is extracted and surfaced as a clickable "Enable API"
button so the operator can flip the switch in one click and re-run
the artifact. Non-Google-API URLs render as a generic "Open link"
CTA. Warnings with no URL render the text alone.

Net effect for the user's reported case: the title-only Google Doc
shows a "View in Drive" link AND an amber "Enable API →" button
pointing directly at the Cloud Console page for the disabled Docs
API. Click Enable, re-run, full doc lands.

## Files Changed

| Change | File |
|--------|------|
| Modified | `app/api/assistant/create-artifact/route.ts` |
| Modified | `components/metame/cards/ArtifactCard.tsx` |

## Stats

 2 files changed, 97 insertions(+), 16 deletions(-)
