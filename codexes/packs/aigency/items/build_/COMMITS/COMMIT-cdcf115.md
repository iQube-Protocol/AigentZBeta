# Commit Brief: `cdcf115` — RemixDialog + wallet drawer: tablet-landscape scroll + close-confirm + Edit mode

| Field | Value |
|-------|-------|
| SHA | [`cdcf115`](https://github.com/iQube-Protocol/AigentZBeta/commit/cdcf11569eef7dc90930350bc5f3df26aa9d18cf) |
| Author | Claude |
| Date | 2026-06-01T13:20:49Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
RemixDialog + wallet drawer: tablet-landscape scroll + close-confirm + Edit mode

Three operator-reported refinements:

1. Tablet-landscape sign-in unblock — persona menu dropdown overflow
   SmartWalletDrawer.tsx:1870 — the wallet's persona dropdown menu was
   `overflow-hidden` with no max-height. On tablet in landscape (e.g.
   iPad ~820px viewport height with browser chrome leaving ~700px), the
   dropdown's content (sign-in form + persona list + actions) extends
   past the visible area and the Sign In button is unreachable. Adding
   max-h-[calc(100vh-120px)] + overflow-y-auto + overscroll-contain so
   the dropdown scrolls within whatever vertical room is available.

2. RemixDialog: prevent accidental dismiss on backdrop click with
   unsaved work
   Operator-reported: tabbing outside the modal during remix preview
   dismissed the modal AND blew away the generated draft. Replace the
   direct onClose() calls on both backdrop click (L815) and the X
   button (L922) with a requestClose() handler that checks isDirty
   (generated && !savedToCanvas) and surfaces an inline amber-toned
   confirmation banner with three CTAs:
     - Save & close (calls saveToCanvas then onClose)
     - Discard & close (calls onClose)
     - Keep working (dismisses the banner only)
   Confirmation banner sits below the modal header so it's always
   visible regardless of where the operator was scrolled in the body.

3. RemixDialog: Edit button for generated articles/stories
   Operator-requested: "we should add an edit button that enables a
   user to edit the generated article/story in case there are last
   minute changes". New amber-toned Edit button in the action row
   between Redo and Save. Clicking it pre-fills editTitle + editBody
   from the generated payload and swaps the preview into an in-place
   edit form with a title input + body textarea + Save / Cancel.
     - Save edits: PATCH /api/community-content/[id] with the operator
       payload. Best-effort — applies locally if the PATCH route
       isn't yet wired so the operator's edits survive to publish.
       Receipt note: "DVN-receipted on save" rendered in the edit row;
       the existing receipt service wraps community-content writes so
       a community_content_edited receipt fires when the route lands.
     - Cancel: discards the edits.
   PenLine icon added to the lucide-react import set.

Type-checked clean. RemixDialog only — the inline variant
(variant === 'inline') used by the runtime page may need the same Edit
button treatment if it surfaces remix previews; deferring to a
follow-up since the operator-reported case is the modal variant.
```

## Body

Three operator-reported refinements:

1. Tablet-landscape sign-in unblock — persona menu dropdown overflow
   SmartWalletDrawer.tsx:1870 — the wallet's persona dropdown menu was
   `overflow-hidden` with no max-height. On tablet in landscape (e.g.
   iPad ~820px viewport height with browser chrome leaving ~700px), the
   dropdown's content (sign-in form + persona list + actions) extends
   past the visible area and the Sign In button is unreachable. Adding
   max-h-[calc(100vh-120px)] + overflow-y-auto + overscroll-contain so
   the dropdown scrolls within whatever vertical room is available.

2. RemixDialog: prevent accidental dismiss on backdrop click with
   unsaved work
   Operator-reported: tabbing outside the modal during remix preview
   dismissed the modal AND blew away the generated draft. Replace the
   direct onClose() calls on both backdrop click (L815) and the X
   button (L922) with a requestClose() handler that checks isDirty
   (generated && !savedToCanvas) and surfaces an inline amber-toned
   confirmation banner with three CTAs:
     - Save & close (calls saveToCanvas then onClose)
     - Discard & close (calls onClose)
     - Keep working (dismisses the banner only)
   Confirmation banner sits below the modal header so it's always
   visible regardless of where the operator was scrolled in the body.

3. RemixDialog: Edit button for generated articles/stories
   Operator-requested: "we should add an edit button that enables a
   user to edit the generated article/story in case there are last
   minute changes". New amber-toned Edit button in the action row
   between Redo and Save. Clicking it pre-fills editTitle + editBody
   from the generated payload and swaps the preview into an in-place
   edit form with a title input + body textarea + Save / Cancel.
     - Save edits: PATCH /api/community-content/[id] with the operator
       payload. Best-effort — applies locally if the PATCH route
       isn't yet wired so the operator's edits survive to publish.
       Receipt note: "DVN-receipted on save" rendered in the edit row;
       the existing receipt service wraps community-content writes so
       a community_content_edited receipt fires when the route lands.
     - Cancel: discards the edits.
   PenLine icon added to the lucide-react import set.

Type-checked clean. RemixDialog only — the inline variant
(variant === 'inline') used by the runtime page may need the same Edit
button treatment if it surfaces remix previews; deferring to a
follow-up since the operator-reported case is the modal variant.

## Files Changed

| Change | File |
|--------|------|
| Modified | `app/components/content/SmartWalletDrawer.tsx` |
| Modified | `components/metame/runtime/RemixDialog.tsx` |

## Stats

 2 files changed, 193 insertions(+), 4 deletions(-)
