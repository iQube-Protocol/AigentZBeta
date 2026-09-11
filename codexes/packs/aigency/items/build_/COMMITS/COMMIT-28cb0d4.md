# Commit Brief: `28cb0d4` — compose modals: thread personaId to UploadAttachmentPicker

| Field | Value |
|-------|-------|
| SHA | [`28cb0d4`](https://github.com/iQube-Protocol/AigentZBeta/commit/28cb0d4e0cb8309e40c6a56e128b109b1013f694) |
| Author | Claude |
| Date | 2026-05-28T16:49:46Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
compose modals: thread personaId to UploadAttachmentPicker

Root cause of the "email came through without the attachment" report:
ComposeGmailDraftModal and ComposeMarketaEmailModal mounted the
UploadAttachmentPicker without a personaId prop. The picker then fell
back to personaFetch's localStorage-based x-persona-id header for the
/api/uploads list fetch. When localStorage is unset or stale, the
fetch resolves against the spine's "first persona by created_at"
default — which can differ from the persona the operator actually owns
their uploads under. The picker rendered an empty or wrong-persona
list, the operator submitted thinking they had attached, and
attachmentUploadIds was silently empty in the create-artifact
connectorInput. Mailjet sent the email cleanly with no Attachments
field — receipt logged a successful send, no error to surface.

Fix:
- ComposeGmailDraftModal: add personaId?: string prop, forward to the
  inline UploadAttachmentPicker.
- ComposeMarketaEmailModal: same.
- ComposerLayout: destructure personaId from props (already arrives
  via RightPaneLayoutProps -> WelcomeRightPaneProps) and pass it down
  to both modals on their inline mount sites.

The picker's existing personaId-prop path (services/uploads list fetch
keyed by /api/uploads?status=ready&limit=50&personaId=<id>) now
resolves against the operator's chosen persona deterministically, so
the file they uploaded is the file the picker shows.
```

## Body

Root cause of the "email came through without the attachment" report:
ComposeGmailDraftModal and ComposeMarketaEmailModal mounted the
UploadAttachmentPicker without a personaId prop. The picker then fell
back to personaFetch's localStorage-based x-persona-id header for the
/api/uploads list fetch. When localStorage is unset or stale, the
fetch resolves against the spine's "first persona by created_at"
default — which can differ from the persona the operator actually owns
their uploads under. The picker rendered an empty or wrong-persona
list, the operator submitted thinking they had attached, and
attachmentUploadIds was silently empty in the create-artifact
connectorInput. Mailjet sent the email cleanly with no Attachments
field — receipt logged a successful send, no error to surface.

Fix:
- ComposeGmailDraftModal: add personaId?: string prop, forward to the
  inline UploadAttachmentPicker.
- ComposeMarketaEmailModal: same.
- ComposerLayout: destructure personaId from props (already arrives
  via RightPaneLayoutProps -> WelcomeRightPaneProps) and pass it down
  to both modals on their inline mount sites.

The picker's existing personaId-prop path (services/uploads list fetch
keyed by /api/uploads?status=ready&limit=50&personaId=<id>) now
resolves against the operator's chosen persona deterministically, so
the file they uploaded is the file the picker shows.

## Files Changed

| Change | File |
|--------|------|
| Modified | `components/metame/connections/ComposeGmailDraftModal.tsx` |
| Modified | `components/metame/connections/ComposeMarketaEmailModal.tsx` |
| Modified | `components/metame/welcome/layouts/ComposerLayout.tsx` |

## Stats

 3 files changed, 17 insertions(+), 1 deletion(-)
