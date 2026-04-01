# Commit Brief: `b88d020` — restore runtime shell in embed preview while preserving editor panel

| Field | Value |
|-------|-------|
| SHA | [`b88d020`](https://github.com/iQube-Protocol/AigentZBeta/commit/b88d020a7e9d9d979a777fb3446d5a599311544c) |
| Author | Claude |
| Date | 2026-03-21T01:19:09Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
restore runtime shell in embed preview while preserving editor panel

Reverts the embedMode + queryPreviewDisplayCapsule bypass path that
was rendering experience content without the CodexCopilotLayer shell.

Now renders the experience chip and runtimeEditorPanel (article
customization UI) in a compact header above the shell, and restores
runtimeSurface (CodexCopilotLayer with runtime menu) as the main body.
The experience content panel is launched into the shell's message stream
via the existing launchCapsule auto-launch effect.

Also adds an update-in-place effect so that when runtimeExperienceOverrides
changes the article draft on the same capsule id, the already-launched
message panel refreshes without a full re-launch.

https://claude.ai/code/session_01VcE6pnjSeAtYvhau1Q6GVM
```

## Files Changed

_File details not available in backfill — see commit link above._
