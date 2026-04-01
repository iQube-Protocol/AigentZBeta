# Commit Brief: `ade65e6` — launch experience into runtime shell instead of standalone article viewer

| Field | Value |
|-------|-------|
| SHA | [`ade65e6`](https://github.com/iQube-Protocol/AigentZBeta/commit/ade65e622ba9c9f99f3dc439c6eae232c4e7c999) |
| Author | Claude |
| Date | 2026-03-20T07:12:20Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
launch experience into runtime shell instead of standalone article viewer

launchExperience() was navigating to /studio/composer/experience/[id]
which renders ExperienceLiquidRenderer - just standalone articles with
no chat interface. Build the same runtime URL as the preview does and
push to /metame/runtime so the experience opens inside the full shell
with the chat layer active.

https://claude.ai/code/session_01VcE6pnjSeAtYvhau1Q6GVM
```

## Files Changed

_File details not available in backfill — see commit link above._
