# Commit Brief: `c082ef3` — Compact Journey evidence checklist into the stage description row

| Field | Value |
|-------|-------|
| SHA | [`c082ef3`](https://github.com/iQube-Protocol/AigentZBeta/commit/c082ef3911fab1ea2384e3525acfb70124c86437) |
| Author | Claude |
| Date | 2026-08-09T07:18:13Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Compact Journey evidence checklist into the stage description row

The evidence checklist was a <details> disclosure in normal document
flow below the stage description - opening it pushed the stage
stepper and viewport down the page. Stage description and the
evidence trigger now share one row (description flex-1 min-w-0,
trigger shrink-0); opening evidence shows an anchored popover instead
of displacing content, closing on stage change, outside click, or
Escape. Evidence entries render as a horizontally-scrollable chip row
instead of a tall vertical list. Same server-derived
evidencePresent/evidenceMissing/receiptRefs - no second resolver.
```

## Body

The evidence checklist was a <details> disclosure in normal document
flow below the stage description - opening it pushed the stage
stepper and viewport down the page. Stage description and the
evidence trigger now share one row (description flex-1 min-w-0,
trigger shrink-0); opening evidence shows an anchored popover instead
of displacing content, closing on stage change, outside click, or
Escape. Evidence entries render as a horizontally-scrollable chip row
instead of a tall vertical list. Same server-derived
evidencePresent/evidenceMissing/receiptRefs - no second resolver.

## Files Changed

| Change | File |
|--------|------|
| Modified | `components/journey/JourneyRunSurface.tsx` |
| Modified | `tests/journey-orient-stage.test.ts` |

## Stats

 2 files changed, 174 insertions(+), 56 deletions(-)
