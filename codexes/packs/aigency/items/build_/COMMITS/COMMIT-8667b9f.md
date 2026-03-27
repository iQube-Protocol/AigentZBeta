# Commit Brief: `8667b9f` — Route video_article_bundle experiences to skill packet builder

| Field | Value |
|-------|-------|
| SHA | [`8667b9f`](https://github.com/iQube-Protocol/AigentZBeta/commit/8667b9f6dfe69686af92b9485dbe0ab7215a17e4) |
| Author | Claude |
| Date | 2026-03-20T21:46:40Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Route video_article_bundle experiences to skill packet builder

isSkillBacked now checks metadata.composition_bundle.presetId so video
bundle experiences are never misrouted to buildImagePacket, even when
Copilot seeds image_generation prompts into session data

https://claude.ai/code/session_01VcE6pnjSeAtYvhau1Q6GVM
```

## Files Changed

_File details not available in backfill — see commit link above._
