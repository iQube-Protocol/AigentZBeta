# Commit Brief: `6e1f210` — remove all auto-grant logic. Activations are simple toggles: no row=off, row+null=on, row+timestamp=off

| Field | Value |
|-------|-------|
| SHA | [`6e1f210`](https://github.com/iQube-Protocol/AigentZBeta/commit/6e1f210a03bcaa30d19e0628390afec8d1855bb7) |
| Author | Claude |
| Date | 2026-05-21T21:49:36Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
remove all auto-grant logic. Activations are simple toggles: no row=off, row+null=on, row+timestamp=off
```

## Files Changed

| Change | File |
|--------|------|
| Modified | `.amplify-deploy` |
| Modified | `data/activation-catalog.ts` |
| Modified | `services/activations/spineActivations.ts` |

## Stats

 3 files changed, 13 insertions(+), 78 deletions(-)
