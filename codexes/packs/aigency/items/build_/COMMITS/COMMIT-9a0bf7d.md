# Commit Brief: `9a0bf7d` — add Workflows tab to Composer Studio analysis panel

| Field | Value |
|-------|-------|
| SHA | [`9a0bf7d`](https://github.com/iQube-Protocol/AigentZBeta/commit/9a0bf7dc8e52f22dcb830ec8cee602c8d1d07a59) |
| Author | Claude |
| Date | 2026-03-26T01:21:53Z |
| Branch | dev (direct push) |
| Type | `feat` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
add Workflows tab to Composer Studio analysis panel

Adds a 5th tab to the analysis panel (grid-cols-5). On first activation,
fetches GET /api/workflows?tenant_id=... and renders each WorkflowDefinition
with name, status badge, adapter pill, and an Invoke button. Invoke calls
POST /api/workflows/:id/invoke with the active persona envelope and shows
inline loading/done/error state per workflow. Refresh button reloads the list.

https://claude.ai/code/session_01VcE6pnjSeAtYvhau1Q6GVM
```

## Files Changed

_File details not available in backfill — see commit link above._
