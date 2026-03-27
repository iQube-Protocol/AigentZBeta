# Commit Brief: `82a1d88` — Gate collapsed sidebar items by openSections to fix links and state sync

| Field | Value |
|-------|-------|
| SHA | [`82a1d88`](https://github.com/iQube-Protocol/AigentZBeta/commit/82a1d883587e5518c2706c49f13c3be7a4dca826) |
| Author | Claude |
| Date | 2026-03-24T08:25:08Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Gate collapsed sidebar items by openSections to fix links and state sync

The collapsed icon view was rendering items for ALL sections regardless
of openSections state. This caused a layout shift on hover: mouse-enter
fires handleHoverStart which sets collapsed=false, switching from the
collapsed view (all sections expanded) to the expanded view (only
openSections sections expanded). Items that existed in collapsed view
but not expanded view disappeared mid-hover, causing the user's click
to land on empty space or a shifted element rather than the intended link.

Fixing the collapsed view to only show items for sections in openSections
makes both states identical in structure (same sections, same items) —
hover-expand merely adds labels without changing which items are present,
eliminating the layout shift and restoring reliable link clicks.

https://claude.ai/code/session_01VcE6pnjSeAtYvhau1Q6GVM
```

## Files Changed

_File details not available in backfill — see commit link above._
