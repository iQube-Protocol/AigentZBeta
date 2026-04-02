# Commit Brief: `0bbd97a` — fix video preview: save thumbnail from polling, pass proxy URL when complete, fix badge

| Field | Value |
|-------|-------|
| SHA | [`0bbd97a`](https://github.com/iQube-Protocol/AigentZBeta/commit/0bbd97a80e274e3688736662f3e05c7674f10ae0) |
| Author | Claude |
| Date | 2026-03-22T19:54:02Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
fix video preview: save thumbnail from polling, pass proxy URL when complete, fix badge

- ComposerStudio polling: when status returns ready+thumbnail_url, persist the
  thumbnail directly to generated_assets as portrait image — removes dependency
  on SkillVideoPlayer running inside the preview iframe to save it
- ComposerStudio runtimePreviewSrc: pass proxy video URL as experienceVideo when
  confirmedCompleteGenerationId === currentVideoGenerationId (proxy route 302→Supabase
  CDN so browser can play it); add confirmedCompleteGenerationId/currentVideoGenerationId
  to deps so iframe reloads automatically when polling confirms completion
- ComposerStudio badge: show "Video generating" only when proxy video has no portrait
  thumbnail; show "Video ready" when both proxy video + portrait thumbnail exist
  (thumbnail is the completion signal from the polling effect)

https://claude.ai/code/session_01VcE6pnjSeAtYvhau1Q6GVM
```

## Files Changed

_File details not available in backfill — see commit link above._
