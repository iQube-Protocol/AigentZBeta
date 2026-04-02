# Commit Brief: `a226de1` — restore legacy experience qube fetch and video artifact fixes

| Field | Value |
|-------|-------|
| SHA | [`a226de1`](https://github.com/iQube-Protocol/AigentZBeta/commit/a226de17d850cf531ac49bd77bda5691c4ef2170) |
| Author | Claude |
| Date | 2026-03-25T00:02:57Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
restore legacy experience qube fetch and video artifact fixes

- fetchExperiences: re-add DEFAULT_TENANT legacy fetch so pre-wallet
  experiences are merged when tenantId differs from the default
- fetchExperiences: replace limit=50 only-if-empty fallback with always-run
  limit=100 broad fetch that merges orphaned records regardless of tenant
- selectPreviewCandidate: extend static-preview guard to runtime_thin_client
  so inspector shows image (not blank) when a video asset is present
- resolveExperienceDeploymentArtifact: expose videoArtifact field (best video
  candidate independent of preferredAssetId)
- asset_link publishUrl: use videoArtifact.url when available so Discord
  asset_link deploys point to the video, not the display image

Both original commits (3be8c08, b575dad) were reverted by ee9555c/b69563e
and never re-applied.

https://claude.ai/code/session_017i9fiEGA3zMjxFonVYZCQT
```

## Files Changed

_File details not available in backfill — see commit link above._
