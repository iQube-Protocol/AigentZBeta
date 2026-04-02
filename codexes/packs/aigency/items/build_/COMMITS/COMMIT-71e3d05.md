# Commit Brief: `71e3d05` — Fix video Runtime Preview regression and add proxy-route thumbnail extraction

| Field | Value |
|-------|-------|
| SHA | [`71e3d05`](https://github.com/iQube-Protocol/AigentZBeta/commit/71e3d05cd9f30f723cc02a386c44741b5e0b11b3) |
| Author | Claude |
| Date | 2026-03-22T06:40:45Z |
| Branch | dev (direct push) |
| Type | `feat` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Fix video Runtime Preview regression and add proxy-route thumbnail extraction

Runtime Preview:
- Revert experienceVideo filter — the iframe must receive the proxy URL so the
  /metame/runtime page renders via SkillVideoPlayer (not a static card view).
- Replace misleading "generating" spinner with a labelled "Reload Preview"
  button. When the user returns from the Launcher after the video completes,
  clicking Reload bumps previewNonce so the iframe reloads with a fresh
  browser context; the proxy then redirects to the Supabase URL and plays.

Thumbnail extraction:
- Also extract and persist the thumbnail inside the proxy route
  (/api/skills/video/[id]) immediately after the full video buffer is
  downloaded. This is a fire-and-forget second path that doesn't depend
  on Range request support or the status-route timing. The status route
  still attempts extraction first on completion; the proxy route catches
  any cases where the status-route extraction failed.
```

## Files Changed

_File details not available in backfill — see commit link above._
