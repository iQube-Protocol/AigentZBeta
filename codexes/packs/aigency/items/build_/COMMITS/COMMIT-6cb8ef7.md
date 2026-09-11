# Commit Brief: `6cb8ef7` — Cap the Journey stage carousel at 8 visible stages, not viewport width

| Field | Value |
|-------|-------|
| SHA | [`6cb8ef7`](https://github.com/iQube-Protocol/AigentZBeta/commit/6cb8ef7e5c77dc73abf0913704952b41455a3046) |
| Author | Claude |
| Date | 2026-09-01T11:18:13Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Cap the Journey stage carousel at 8 visible stages, not viewport width

The strip's overflow-x-auto was purely content-width-driven: flex-1
connectors stretch to fill any viewport, so a journey whose stage count
fits a wide desktop screen never actually overflowed. The AEE-XP-001
Financial Sovereignty branch made this visible — KNYTS/CI reach twelve
stages, which fit uncompressed on desktop, so the carousel never engaged
and all twelve rendered compressed into one strip instead of scrolling.

Split the strip into an outer overflow-x-auto scroll container and an
inner flex content row; past MAX_VISIBLE_SPINE_STAGES (8, reusing the
density the carousel was originally introduced for), the inner row gets a
minWidth proportional to visibleStageUnitCount/8, forcing real overflow
regardless of viewport width. Below the cap, minWidth is unset and
short journeys render exactly as before. No virtualization — every stage
stays mounted in the same rail, so arrow/swipe navigation and the active
stage's scrollIntoView keep working unchanged.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01S5Y1pnDdW3LyguwPdfJjXy
```

## Body

The strip's overflow-x-auto was purely content-width-driven: flex-1
connectors stretch to fill any viewport, so a journey whose stage count
fits a wide desktop screen never actually overflowed. The AEE-XP-001
Financial Sovereignty branch made this visible — KNYTS/CI reach twelve
stages, which fit uncompressed on desktop, so the carousel never engaged
and all twelve rendered compressed into one strip instead of scrolling.

Split the strip into an outer overflow-x-auto scroll container and an
inner flex content row; past MAX_VISIBLE_SPINE_STAGES (8, reusing the
density the carousel was originally introduced for), the inner row gets a
minWidth proportional to visibleStageUnitCount/8, forcing real overflow
regardless of viewport width. Below the cap, minWidth is unset and
short journeys render exactly as before. No virtualization — every stage
stays mounted in the same rail, so arrow/swipe navigation and the active
stage's scrollIntoView keep working unchanged.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01S5Y1pnDdW3LyguwPdfJjXy

## Files Changed

| Change | File |
|--------|------|
| Modified | `components/journey/JourneyRunSurface.tsx` |
| Added | `tests/journey-carousel-capacity.test.ts` |

## Stats

 2 files changed, 126 insertions(+), 1 deletion(-)
