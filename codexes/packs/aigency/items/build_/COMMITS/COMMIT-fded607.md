# Commit Brief: `fded607` — fix: add getOwnedAssetIds enumeration fallback to userOwnsAsset + deploy trigger

| Field | Value |
|-------|-------|
| SHA | [`fded607`](https://github.com/iQube-Protocol/AigentZBeta/commit/fded6075707a21c8c69aaadb8a5b17356f490712) |
| Author | Claude |
| Date | 2026-05-05T00:44:47Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
fix: add getOwnedAssetIds enumeration fallback to userOwnsAsset + deploy trigger

Previous fix only covered legacy episode-N format. This adds a final fallback
that calls getOwnedAssetIds — the same full-enumeration path that populates the
OWNED badge and /api/codex/owned. If the badge says owned, this gate now agrees
regardless of what entitlement format is in the DB (direct masterId, SKU id,
legacy format, bundle grant, or any other shape).

Fallback is wrapped in try/catch so a DB failure doesn't block the route.
Diagnostic console.log at every decision branch already in place from previous
commit so production Amplify logs show exactly which path fires.
```

## Body

Previous fix only covered legacy episode-N format. This adds a final fallback
that calls getOwnedAssetIds — the same full-enumeration path that populates the
OWNED badge and /api/codex/owned. If the badge says owned, this gate now agrees
regardless of what entitlement format is in the DB (direct masterId, SKU id,
legacy format, bundle grant, or any other shape).

Fallback is wrapped in try/catch so a DB failure doesn't block the route.
Diagnostic console.log at every decision branch already in place from previous
commit so production Amplify logs show exactly which path fires.

## Files Changed

| Change | File |
|--------|------|
| Modified | `.amplify-deploy` |
| Modified | `services/rewards/assetOwnership.ts` |

## Stats

 2 files changed, 29 insertions(+), 18 deletions(-)
