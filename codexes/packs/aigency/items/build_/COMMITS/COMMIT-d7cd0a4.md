# Commit Brief: `d7cd0a4` — Fix video bundle: preserve article draft and add Sora thumbnail generation

| Field | Value |
|-------|-------|
| SHA | [`d7cd0a4`](https://github.com/iQube-Protocol/AigentZBeta/commit/d7cd0a4f058cbd33c8916d9213f5f2b7e6fe8f15) |
| Author | Claude |
| Date | 2026-03-22T05:26:29Z |
| Branch | dev (direct push) |
| Type | `feat` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Fix video bundle: preserve article draft and add Sora thumbnail generation

- handleComplete: save article_draft before video generation refresh and restore
  it afterward, mirroring the same pattern the image bundle block already uses.
  Previously the server refresh silently overwrote the in-memory article draft,
  so article content was never written to the editing experience.
- Sora status route: extract a JPEG thumbnail from the first 4 MB of the video
  content when the job completes, matching the Venice status route behaviour.
  SkillVideoPlayer then persists thumbnail_url as a companion portrait asset.
```

## Files Changed

_File details not available in backfill — see commit link above._
