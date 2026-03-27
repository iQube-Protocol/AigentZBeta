# Commit Brief: `e621d27` — add WorkflowEngineBinding phase 1: schema, store, make adapter, bindings and invoke API

| Field | Value |
|-------|-------|
| SHA | [`e621d27`](https://github.com/iQube-Protocol/AigentZBeta/commit/e621d276e10817677f29c4971cfb36c1d136947a) |
| Author | Claude |
| Date | 2026-03-26T00:35:14Z |
| Branch | dev (direct push) |
| Type | `feat` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
add WorkflowEngineBinding phase 1: schema, store, make adapter, bindings and invoke API

- migration: workflow_engine_bindings table (unique per workflow+engine, JSONB backendIds,
  credentialPolicy, healthState, validationStatus)
- bindingTypes.ts: WorkflowEngineBinding type + WorkflowEngineAdapter contract interface
- bindingStore.ts: Supabase-backed CRUD (listBindings, createBinding, updateBinding,
  deleteBinding, countBindingRows)
- adapters/makeAdapter.ts: Make.com adapter (validate, invoke, getStatus, healthCheck,
  normalizeOutput) — reads scenarioId from backendIds, token from credentialPolicy or
  MAKE_API_TOKEN env var
- GET/POST /api/workflows/:id/bindings — list and create bindings
- POST /api/workflows/:id/invoke — invoke via adapter (defaults to first binding)

https://claude.ai/code/session_01VcE6pnjSeAtYvhau1Q6GVM
```

## Files Changed

_File details not available in backfill — see commit link above._
