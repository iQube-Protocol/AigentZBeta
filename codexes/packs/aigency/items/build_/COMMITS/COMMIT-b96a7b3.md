# Commit Brief: `b96a7b3` — Rebuild Consequence Fork trident as one absolutely-positioned box, not stacked rows

| Field | Value |
|-------|-------|
| SHA | [`b96a7b3`](https://github.com/iQube-Protocol/AigentZBeta/commit/b96a7b31877fcd1ee0d8b1d4ae3a895789f96464) |
| Author | Claude |
| Date | 2026-08-09T04:22:05Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Rebuild Consequence Fork trident as one absolutely-positioned box, not stacked rows

The fork was already anchored inside stripRef, but its three prongs still
flowed via flex-column (a vertical stack), which visually read as a second
panel even though it was structurally a sibling of the spine nodes. Replaced
it with one fixed relative box (h-[72px] w-[170px]) containing an
absolutely-positioned trunk, junction dot, and three independently-ticked
rows — Ratify top, Ingest center (continuing the spine's own line through
the junction), Stand bottom. Dropped the "Consequence Fork" section heading;
the geometry now communicates the fork on its own.

Replaced the stale assertion that required the fork to render AFTER the
strip's closing tag (which protected the old detached-block layout) with
canaries asserting the fork's testid sits inside stripRef, before it closes,
with no reintroduction of the flex-column stack or section heading.
```

## Body

The fork was already anchored inside stripRef, but its three prongs still
flowed via flex-column (a vertical stack), which visually read as a second
panel even though it was structurally a sibling of the spine nodes. Replaced
it with one fixed relative box (h-[72px] w-[170px]) containing an
absolutely-positioned trunk, junction dot, and three independently-ticked
rows — Ratify top, Ingest center (continuing the spine's own line through
the junction), Stand bottom. Dropped the "Consequence Fork" section heading;
the geometry now communicates the fork on its own.

Replaced the stale assertion that required the fork to render AFTER the
strip's closing tag (which protected the old detached-block layout) with
canaries asserting the fork's testid sits inside stripRef, before it closes,
with no reintroduction of the flex-column stack or section heading.

## Files Changed

| Change | File |
|--------|------|
| Modified | `components/journey/JourneyRunSurface.tsx` |
| Modified | `tests/journey-orient-stage.test.ts` |

## Stats

 2 files changed, 172 insertions(+), 102 deletions(-)
