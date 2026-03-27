# Commit Brief: `7ce2bc7` — isolate image generation from video flows in auto-gen and fallback button

| Field | Value |
|-------|-------|
| SHA | [`7ce2bc7`](https://github.com/iQube-Protocol/AigentZBeta/commit/7ce2bc7bacd49ff7298ed998e4767e236e115761) |
| Author | Claude |
| Date | 2026-03-20T20:22:44Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
isolate image generation from video flows in auto-gen and fallback button

ComposerStudio: add isVideoBundle and hasVideoPrompt guards so the
hasImagePrompts secondary trigger never fires for video bundle or
video-prompt sessions — image auto-generation now only runs for
image_article_bundle or standalone image experiences

MetaMeRuntimeClient: add hasVideoContent guard on the Generate Images
fallback button so it never appears for video experiences even when
image_generation prompts are present in the session data

https://claude.ai/code/session_01VcE6pnjSeAtYvhau1Q6GVM
```

## Files Changed

_File details not available in backfill — see commit link above._
