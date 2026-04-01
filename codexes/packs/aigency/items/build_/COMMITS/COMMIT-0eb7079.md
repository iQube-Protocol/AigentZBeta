# Commit Brief: `0eb7079` — Add refresh callbacks to update stats and reputation after actions

| Field | Value |
|-------|-------|
| SHA | [`0eb7079`](https://github.com/iQube-Protocol/AigentZBeta/commit/0eb70791a448f9c1ac38c88c41f403e848079c8c) |
| Author | Kn0w-1 |
| Date | 2025-11-30T09:27:24Z |
| Branch | dev (direct push) |
| Type | `feat` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Add refresh callbacks to update stats and reputation after actions

- TasksPage now refreshes stats and reputation after claim/submit/review
- TaskList calls onTaskClaimed after successful claim
- MyTasks calls onSubmit after successful submission
- TaskReview calls onReviewComplete after approve/reject
- ReputationDisplay re-renders with new key on refresh
```

## Files Changed

_File details not available in backfill — see commit link above._
