# Commit Brief: `0f5069e` — fix video 413: upload to Supabase on first access and redirect instead of proxying large body

| Field | Value |
|-------|-------|
| SHA | [`0f5069e`](https://github.com/iQube-Protocol/AigentZBeta/commit/0f5069e5d1f9c4940be1750931617d68d2527e7e) |
| Author | Claude |
| Date | 2026-03-22T04:02:58Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
fix video 413: upload to Supabase on first access and redirect instead of proxying large body

- OpenAI/Sora videos exceed CloudFront's response size limit when streamed
  through Lambda, causing 413 errors on all playback attempts
- Proxy now downloads from OpenAI, uploads to Supabase storage, and returns
  a 302 redirect to the Supabase CDN URL; browser fetches video directly
- Caches by videoId path so subsequent requests redirect immediately
- Set maxDuration = 60 to give Lambda enough time for download + upload
- Also fix stale closure in runProviderDispatchSimulation: resolve deployment
  artifact from latestExperience (freshly fetched) rather than the stale
  resolvedInspectorDeploymentArtifact useMemo, so Discord thumbnails reflect
  the most recently generated assets

https://claude.ai/code/session_01VcE6pnjSeAtYvhau1Q6GVM
```

## Files Changed

_File details not available in backfill — see commit link above._
