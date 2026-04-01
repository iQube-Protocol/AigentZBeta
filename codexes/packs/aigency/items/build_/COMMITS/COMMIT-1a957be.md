# Commit Brief: `1a957be` — add QubeTalk CLI and hooks for Claude Code agents

| Field | Value |
|-------|-------|
| SHA | [`1a957be`](https://github.com/iQube-Protocol/AigentZBeta/commit/1a957be7fc3bc8ca0c5807ebf1f0d37c3bf3d09a) |
| Author | Claude |
| Date | 2026-03-24T17:01:12Z |
| Branch | dev (direct push) |
| Type | `feat` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
add QubeTalk CLI and hooks for Claude Code agents

- scripts/qubetalk-claude.sh: send/history CLI using service role key
  (REST primary) with anon key Edge Function fallback; loads keys from
  .env.local automatically
- .claude/settings.json: SessionStart + Stop hooks auto-announce to
  metame-runtime-thinclient channel on every Claude Code session
- CLAUDE.md: QubeTalk usage guide so all agents know the protocol

https://claude.ai/code/session_01VcE6pnjSeAtYvhau1Q6GVM
```

## Files Changed

_File details not available in backfill — see commit link above._
