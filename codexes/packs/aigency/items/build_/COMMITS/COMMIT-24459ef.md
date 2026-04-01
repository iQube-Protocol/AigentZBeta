# Commit Brief: `24459ef` — fix runtime preview layout: chip inside shell, shell at full height

| Field | Value |
|-------|-------|
| SHA | [`24459ef`](https://github.com/iQube-Protocol/AigentZBeta/commit/24459ef3e11b79cefe98371556ff2604638bc910) |
| Author | Claude |
| Date | 2026-03-21T02:00:22Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
fix runtime preview layout: chip inside shell, shell at full height

Three layout issues fixed:

1. Experience chip was rendered in a shrink-0 header above the shell,
   stealing vertical space. Now injected as the first message in
   CodexCopilotLayer's scrollable stream via the auto-launch effect
   (prepended before the full experience panel message).

2. Shell (CodexCopilotLayer) now gets full available height in embed
   preview mode. The admin editor panel (runtimeEditorPanel) is only
   rendered above the shell when runtimeAdminMode is active; it is null
   in normal usage so there is no height loss.

3. Scrolling within the shell viewport was broken because the chip
   header compressed the shell. With the shell at full height, the
   message area's absolute-positioned scroll container gets the correct
   top/bottom bounds and scrolls properly.

Also moved renderRuntimeExperienceChip useCallback to before the
auto-launch effect to satisfy TypeScript const temporal dead zone rules.

https://claude.ai/code/session_01VcE6pnjSeAtYvhau1Q6GVM
```

## Files Changed

_File details not available in backfill — see commit link above._
