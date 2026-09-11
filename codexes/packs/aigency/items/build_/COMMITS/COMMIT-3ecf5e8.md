# Commit Brief: `3ecf5e8` — Lower carousel cap to 7 — last pre-FS stage visible by default is Choose

| Field | Value |
|-------|-------|
| SHA | [`3ecf5e8`](https://github.com/iQube-Protocol/AigentZBeta/commit/3ecf5e858dc44a6cad2b2e31408596e474cebe9e) |
| Author | Claude |
| Date | 2026-09-01T12:04:53Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Lower carousel cap to 7 — last pre-FS stage visible by default is Choose

KNYTS/CI's ambient pre-FS spine is exactly seven stages
(home/view/orient/passport/[remix|personify]/stand/choose). At the
previous cap of 8, the default resting carousel view bled one stage past
Choose into fs-discover (the FS branch's own first stage) whenever it had
already been reached, before the visitor had necessarily meant to look
that far ahead. MAX_VISIBLE_SPINE_STAGES now matches the ambient spine
exactly, so Choose is always the last stage visible without scrolling.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01S5Y1pnDdW3LyguwPdfJjXy
```

## Body

KNYTS/CI's ambient pre-FS spine is exactly seven stages
(home/view/orient/passport/[remix|personify]/stand/choose). At the
previous cap of 8, the default resting carousel view bled one stage past
Choose into fs-discover (the FS branch's own first stage) whenever it had
already been reached, before the visitor had necessarily meant to look
that far ahead. MAX_VISIBLE_SPINE_STAGES now matches the ambient spine
exactly, so Choose is always the last stage visible without scrolling.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01S5Y1pnDdW3LyguwPdfJjXy

## Files Changed

| Change | File |
|--------|------|
| Modified | `components/journey/JourneyRunSurface.tsx` |
| Modified | `tests/journey-carousel-capacity.test.ts` |

## Stats

 2 files changed, 26 insertions(+), 15 deletions(-)
