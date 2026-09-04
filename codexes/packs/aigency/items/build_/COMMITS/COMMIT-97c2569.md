# Commit Brief: `97c2569` — Fix Generate Report button permanently disabled in AigentMe brief flow

| Field | Value |
|-------|-------|
| SHA | [`97c2569`](https://github.com/iQube-Protocol/AigentZBeta/commit/97c25691a9bd7f525b8a1d15b48689b764414e18) |
| Author | Claude |
| Date | 2026-09-04T17:52:12Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Fix Generate Report button permanently disabled in AigentMe brief flow

onUpdateBriefSpec hand-rolled its own briefSpec merge instead of reusing
the canonical updateBriefSpec/updateBriefCompleteness functions from
deliberationSeam, so isComplete was never recomputed after the operator
filled in brief fields — Generate Report stayed disabled at its initial
false regardless of input.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01S5Y1pnDdW3LyguwPdfJjXy
```

## Body

onUpdateBriefSpec hand-rolled its own briefSpec merge instead of reusing
the canonical updateBriefSpec/updateBriefCompleteness functions from
deliberationSeam, so isComplete was never recomputed after the operator
filled in brief fields — Generate Report stayed disabled at its initial
false regardless of input.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01S5Y1pnDdW3LyguwPdfJjXy

## Files Changed

| Change | File |
|--------|------|
| Modified | `app/triad/components/codex/tabs/AigentMeWelcomeSplitTab.tsx` |

## Stats

 1 file changed, 12 insertions(+), 5 deletions(-)
