# Commit Brief: `161728b` — keep consumer task/reward furniture visible when experience has no tasks

| Field | Value |
|-------|-------|
| SHA | [`161728b`](https://github.com/iQube-Protocol/AigentZBeta/commit/161728bb9013cb9058f6dd56afe7f5fc028a8b1b) |
| Author | Claude |
| Date | 2026-06-19T01:02:56Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
keep consumer task/reward furniture visible when experience has no tasks

RuntimeConsumerTaskRunner returned null on empty nextActions, hiding the
entire task + reward/cost block inline (the reward badges live inside the
same component). Consumers saw nothing — no tasks, no rewards furniture,
no affordance. Align with the canonical CompositionBundleBrief consumer
surface: always render the reward/cost badges and an explicit 'No tasks
for this experience yet.' instead of going blank.
```

## Body

RuntimeConsumerTaskRunner returned null on empty nextActions, hiding the
entire task + reward/cost block inline (the reward badges live inside the
same component). Consumers saw nothing — no tasks, no rewards furniture,
no affordance. Align with the canonical CompositionBundleBrief consumer
surface: always render the reward/cost badges and an explicit 'No tasks
for this experience yet.' instead of going blank.

## Files Changed

| Change | File |
|--------|------|
| Modified | `.amplify-deploy` |
| Modified | `components/metame/runtime/RuntimeConsumerTaskRunner.tsx` |

## Stats

 2 files changed, 49 insertions(+), 29 deletions(-)
