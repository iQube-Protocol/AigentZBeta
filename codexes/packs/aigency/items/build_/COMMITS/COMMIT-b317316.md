# Commit Brief: `b317316` — reinstate persona-uploads frontend wiring (lost in stable-build revert)

| Field | Value |
|-------|-------|
| SHA | [`b317316`](https://github.com/iQube-Protocol/AigentZBeta/commit/b3173162713c3a93dee28e0a283019da3a06d310) |
| Author | Claude |
| Date | 2026-05-28T15:21:08Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
reinstate persona-uploads frontend wiring (lost in stable-build revert)

Backend (services/uploads/*, app/api/uploads/*) and the compose-modal
attachment pickers were preserved through the revert; only the surface
wiring that activates them was missing.

AigentMeWelcomeSplitTab: re-import UploadDrawer + uploadDrawerOpen
state, mount the drawer at the tab root, pass onUploadOpen to the
ComposeQuickActionsStrip, and re-add `attachmentUploadIds?: string[]`
to the Gmail + Marketa compose-handler input types.

ComposeQuickActionsStrip: re-add the Upload icon button between the
six compose chips and the Wallet button (Upload to the left of Wallet),
plus the onUploadOpen prop.

SmartTriadCopilotLayer: re-import UploadAttachmentPicker + Paperclip,
add attachedUploadIds + attachmentsPickerOpen state, clear attachments
on send, ride attachedUploadIds through the /api/codex/chat POST body,
thread props down to FloatingCopilot, render the picker bar below the
input (only when open or with selections), and add the paperclip toggle
to the right side of the model-selector row with a count badge.

No backend changes — the upload service, indexer, API routes, and
adapters from cf77ceb3/6841d32d/72a4a040/0644d4e8/49eaa9c6/c8da20cd
already survived the revert.
```

## Body

Backend (services/uploads/*, app/api/uploads/*) and the compose-modal
attachment pickers were preserved through the revert; only the surface
wiring that activates them was missing.

AigentMeWelcomeSplitTab: re-import UploadDrawer + uploadDrawerOpen
state, mount the drawer at the tab root, pass onUploadOpen to the
ComposeQuickActionsStrip, and re-add `attachmentUploadIds?: string[]`
to the Gmail + Marketa compose-handler input types.

ComposeQuickActionsStrip: re-add the Upload icon button between the
six compose chips and the Wallet button (Upload to the left of Wallet),
plus the onUploadOpen prop.

SmartTriadCopilotLayer: re-import UploadAttachmentPicker + Paperclip,
add attachedUploadIds + attachmentsPickerOpen state, clear attachments
on send, ride attachedUploadIds through the /api/codex/chat POST body,
thread props down to FloatingCopilot, render the picker bar below the
input (only when open or with selections), and add the paperclip toggle
to the right side of the model-selector row with a count badge.

No backend changes — the upload service, indexer, API routes, and
adapters from cf77ceb3/6841d32d/72a4a040/0644d4e8/49eaa9c6/c8da20cd
already survived the revert.

## Files Changed

| Change | File |
|--------|------|
| Modified | `app/triad/components/codex/tabs/AigentMeWelcomeSplitTab.tsx` |
| Modified | `components/metame/copilot/ComposeQuickActionsStrip.tsx` |
| Modified | `components/smarttriad/copilot/SmartTriadCopilotLayer.tsx` |

## Stats

 3 files changed, 128 insertions(+), 18 deletions(-)
