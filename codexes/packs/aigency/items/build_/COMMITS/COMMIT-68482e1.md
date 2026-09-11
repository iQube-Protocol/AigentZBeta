# Commit Brief: `68482e1` — artifact card + receipt: surface attachment count for diagnostics

| Field | Value |
|-------|-------|
| SHA | [`68482e1`](https://github.com/iQube-Protocol/AigentZBeta/commit/68482e1723de235ac7822337d469de7a3e5b3fa0) |
| Author | Claude |
| Date | 2026-05-29T05:57:30Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
artifact card + receipt: surface attachment count for diagnostics

The "email sent but no attachment" symptom is hard to diagnose because
the operator never sees a count of attached uploads — the picker can
silently render empty (wrong-persona fetch, fetch race, stale state)
and the operator submits thinking they attached, but
attachmentUploadIds was [] in the request body and the email shipped
without an Attachments part.

Two diagnostic surfaces added:

1. ArtifactCard chip — when data.actionInput.attachmentUploadIds is a
   non-empty array, render a "{N} attached" pill next to the status
   pill (Draft / Ready for review / Sent etc.). Operator can confirm
   pre-Send that their selection registered, and post-Send that the
   sent draft included the attachments.

2. /api/assistant/create-artifact receipt summary — both the
   gmail-draft and marketa-email branches now include "(N attachments)"
   in the artifact_created receipt summary when attachmentUploadIds is
   non-empty. Lets the operator audit historical receipts to see
   whether a given send actually carried attachments.

No behavioural change to the connector pipelines — purely visibility.
```

## Body

The "email sent but no attachment" symptom is hard to diagnose because
the operator never sees a count of attached uploads — the picker can
silently render empty (wrong-persona fetch, fetch race, stale state)
and the operator submits thinking they attached, but
attachmentUploadIds was [] in the request body and the email shipped
without an Attachments part.

Two diagnostic surfaces added:

1. ArtifactCard chip — when data.actionInput.attachmentUploadIds is a
   non-empty array, render a "{N} attached" pill next to the status
   pill (Draft / Ready for review / Sent etc.). Operator can confirm
   pre-Send that their selection registered, and post-Send that the
   sent draft included the attachments.

2. /api/assistant/create-artifact receipt summary — both the
   gmail-draft and marketa-email branches now include "(N attachments)"
   in the artifact_created receipt summary when attachmentUploadIds is
   non-empty. Lets the operator audit historical receipts to see
   whether a given send actually carried attachments.

No behavioural change to the connector pipelines — purely visibility.

## Files Changed

| Change | File |
|--------|------|
| Modified | `app/api/assistant/create-artifact/route.ts` |
| Modified | `components/metame/cards/ArtifactCard.tsx` |

## Stats

 2 files changed, 33 insertions(+), 2 deletions(-)
