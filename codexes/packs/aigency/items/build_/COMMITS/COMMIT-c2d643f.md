# Commit Brief: `c2d643f` — add workflow run polling, history, manifest display, QubeTalk invoke lane, env var health flags

| Field | Value |
|-------|-------|
| SHA | [`c2d643f`](https://github.com/iQube-Protocol/AigentZBeta/commit/c2d643f364254a153594eda9054d387450d54401) |
| Author | Claude |
| Date | 2026-03-26T02:10:27Z |
| Branch | dev (direct push) |
| Type | `feat` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
add workflow run polling, history, manifest display, QubeTalk invoke lane, env var health flags

- Track L: poll GET /api/workflows/:id/runs/:runId every 15s after invoke, show status chip
- Track M: collapsible recent-runs table per workflow card (last 5 runs)
- Track N: lazy-fetch input manifest fields when invoke section expands
- Track O: POST /api/qubetalk/invoke — resolves workflow, initiates PipelineRun (initiatedVia qubetalk), invokes adapter, posts result back to channel
- Track P: GET /api/workflows/health now includes envVars presence flags for all adapter + authority env vars

https://claude.ai/code/session_01VcE6pnjSeAtYvhau1Q6GVM
```

## Files Changed

_File details not available in backfill — see commit link above._
