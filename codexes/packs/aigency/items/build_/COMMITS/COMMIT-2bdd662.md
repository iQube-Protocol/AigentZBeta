# Commit Brief: `2bdd662` — add runtime observability — WorkflowRun tracking, runs API, cancel, health

| Field | Value |
|-------|-------|
| SHA | [`2bdd662`](https://github.com/iQube-Protocol/AigentZBeta/commit/2bdd6627ebe3fe65c2e26e2038cadefd52d74a0c) |
| Author | Claude |
| Date | 2026-03-26T01:21:38Z |
| Branch | dev (direct push) |
| Type | `feat` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
add runtime observability — WorkflowRun tracking, runs API, cancel, health

- migration: add execution_id column to workflow_runs for adapter handle
- workflowRunStore.ts: createWorkflowRun, updateWorkflowRun, getWorkflowRun,
  listWorkflowRuns, appendRunEvent, listRunEvents
- invoke route: creates WorkflowRun before adapter call, updates status/output
  on result, returns runId in response
- GET /api/workflows/:id/runs — list runs (most recent first, limit param)
- GET /api/workflows/:id/runs/:runId — run detail + trace events
- POST /api/workflows/:id/runs/:runId/cancel — cancel via adapter if executionId present
- GET /api/workflows/:id/bindings/:bindingId/health — probe adapter, persist health state

https://claude.ai/code/session_01VcE6pnjSeAtYvhau1Q6GVM
```

## Files Changed

_File details not available in backfill — see commit link above._
