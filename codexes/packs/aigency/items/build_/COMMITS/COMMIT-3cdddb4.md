# Commit Brief: `3cdddb4` — ArtifactCard: copy-id button next to truncated receipt prefix

| Field | Value |
|-------|-------|
| SHA | [`3cdddb4`](https://github.com/iQube-Protocol/AigentZBeta/commit/3cdddb486f9b195582a61f5e526379bbc4dbafd0) |
| Author | Claude |
| Date | 2026-05-29T14:20:39Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
ArtifactCard: copy-id button next to truncated receipt prefix

Operator can now grab the full DVN receipt id from inside the
artifact chip (mounted by ExpandedNBEPill inside Brief / Move-forward
/ Venture / Specialists Capsules) without leaving the Capsule to hit
the Receipts ledger. New ReceiptIdChip helper renders the existing
"receipt: <8-char prefix>…" text followed by a small Clipboard button;
click writes the full receiptId via navigator.clipboard.writeText, and
the icon swaps to ClipboardCheck for ~1.5s as confirmation feedback.

Permission-denied / non-secure-context paths silently no-op so the
truncated id is still visible for manual copy if the clipboard API
isn't available.

Receipt-detail view rendered in-pill (full receipt expansion inside
the Capsule) is on the backlog per the operator — this change is the
safer interim that gets the copy affordance live without touching the
Pill lifecycle prop threading the recent CLAUDE.md aigentMe Capsule ↔
Layout Contract section calls out.
```

## Body

Operator can now grab the full DVN receipt id from inside the
artifact chip (mounted by ExpandedNBEPill inside Brief / Move-forward
/ Venture / Specialists Capsules) without leaving the Capsule to hit
the Receipts ledger. New ReceiptIdChip helper renders the existing
"receipt: <8-char prefix>…" text followed by a small Clipboard button;
click writes the full receiptId via navigator.clipboard.writeText, and
the icon swaps to ClipboardCheck for ~1.5s as confirmation feedback.

Permission-denied / non-secure-context paths silently no-op so the
truncated id is still visible for manual copy if the clipboard API
isn't available.

Receipt-detail view rendered in-pill (full receipt expansion inside
the Capsule) is on the backlog per the operator — this change is the
safer interim that gets the copy affordance live without touching the
Pill lifecycle prop threading the recent CLAUDE.md aigentMe Capsule ↔
Layout Contract section calls out.

## Files Changed

| Change | File |
|--------|------|
| Modified | `components/metame/cards/ArtifactCard.tsx` |

## Stats

 1 file changed, 45 insertions(+), 4 deletions(-)
