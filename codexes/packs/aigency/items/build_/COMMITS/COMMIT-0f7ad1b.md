# Commit Brief: `0f7ad1b` — feat: handle close_codex MENU_ACTION from shell floating quick actions

| Field | Value |
|-------|-------|
| SHA | [`0f7ad1b`](https://github.com/iQube-Protocol/AigentZBeta/commit/0f7ad1bebd2296c8c4a93047619d723c33b2d411) |
| Author | Kn0w-1 |
| Date | 2026-03-02T15:14:59Z |
| Branch | dev (direct push) |
| Type | `feat` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
feat: handle close_codex MENU_ACTION from shell floating quick actions

When the shell sends MENU_ACTION with action_id 'close_codex',
the runtime now dismisses all codex overlay panels (variant=panel,
id !== capsule-panel) and clears selected capsule state.

This supports the upcoming Close Codex button in the shell's
floating quick actions bar.
```

## Files Changed

_File details not available in backfill — see commit link above._
