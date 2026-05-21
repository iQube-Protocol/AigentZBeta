# Commit Brief: `0e8264f` — activation toggle: dedicated rarity='activation' + partial unique index + atomic UPSERT/UPDATE

| Field | Value |
|-------|-------|
| SHA | [`0e8264f`](https://github.com/iQube-Protocol/AigentZBeta/commit/0e8264f66ad3d431630fdfe45d871349cde8b9e7) |
| Author | Claude |
| Date | 2026-05-21T22:30:59Z |
| Branch | dev (direct push) |
| Type | `chore` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
activation toggle: dedicated rarity='activation' + partial unique index + atomic UPSERT/UPDATE
```

## Files Changed

| Change | File |
|--------|------|
| Modified | `.amplify-deploy` |
| Modified | `services/activations/spineActivations.ts` |
| Added | `supabase/migrations/20260524020000_activation_toggle_unique_index.sql` |

## Stats

 3 files changed, 240 insertions(+), 102 deletions(-)
