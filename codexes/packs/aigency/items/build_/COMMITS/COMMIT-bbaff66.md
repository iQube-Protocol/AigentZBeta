# Commit Brief: `bbaff66` — fix activation toggle: explicit SELECT→INSERT/UPDATE (PostgREST upsert can't target partial unique index)

| Field | Value |
|-------|-------|
| SHA | [`bbaff66`](https://github.com/iQube-Protocol/AigentZBeta/commit/bbaff669de9a0ff92090011f6632a5bd69379f8e) |
| Author | Claude |
| Date | 2026-05-21T22:45:45Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
fix activation toggle: explicit SELECT→INSERT/UPDATE (PostgREST upsert can't target partial unique index)
```

## Files Changed

| Change | File |
|--------|------|
| Modified | `.amplify-deploy` |
| Modified | `services/activations/spineActivations.ts` |

## Stats

 2 files changed, 74 insertions(+), 59 deletions(-)
