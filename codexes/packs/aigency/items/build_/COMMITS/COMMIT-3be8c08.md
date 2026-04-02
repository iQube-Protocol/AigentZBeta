# Commit Brief: `3be8c08` — fix inspector thumbnail, asset_link video dispatch, and experiences tab legacy fetch

| Field | Value |
|-------|-------|
| SHA | [`3be8c08`](https://github.com/iQube-Protocol/AigentZBeta/commit/3be8c0813079e50e520f9063a96709fbeca7a9ef) |
| Author | Claude |
| Date | 2026-03-24T20:20:27Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
fix inspector thumbnail, asset_link video dispatch, and experiences tab legacy fetch

- selectPreviewCandidate: extend image-preference guard to runtime_thin_client
  so the inspector shows the experience image (not blank) when an image asset
  exists alongside a proxy-URL video

- resolveExperienceDeploymentArtifact: expose videoArtifact (best video
  candidate independent of preferredAssetId) for use by dispatch layer

- asset_link publishUrl: when a video exists, use the video URL as the primary
  dispatch link rather than the preferred display image; image remains the
  thumbnailUrl so Discord still renders it as the embed thumbnail

- fetchExperiences: when the resolved tenantId differs from DEFAULT_TENANT,
  also fetch DEFAULT_TENANT experiences and merge (dedup) so experiences
  created before wallet identity resolution are not lost from the tab

https://claude.ai/code/session_017i9fiEGA3zMjxFonVYZCQT
```

## Files Changed

_File details not available in backfill — see commit link above._
