# Commit Brief: `afb9a24` — add n8n + ACI adapters and shared adapter registry

| Field | Value |
|-------|-------|
| SHA | [`afb9a24`](https://github.com/iQube-Protocol/AigentZBeta/commit/afb9a24520a0a76786221cfd4ed1d4e7f7c5defc) |
| Author | Claude |
| Date | 2026-03-26T01:21:47Z |
| Branch | dev (direct push) |
| Type | `feat` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
add n8n + ACI adapters and shared adapter registry

- adapters/index.ts: getAdapter() registry — make, n8n, aci
- adapters/n8nAdapter.ts: webhook-based invoke, execution status poll,
  cancel via /api/v1/executions/:id/stop, healthz probe, output normalization
  — reads webhookPath from backendIds, base URL from N8N_BASE_URL or credentialPolicy
- adapters/aciAdapter.ts: stub — returns not-implemented error until ACI_BASE_URL
  and ACI_API_KEY are configured; healthCheck probes /health endpoint
- invoke, cancel, health routes: replaced per-file getAdapter() copies with
  import from shared registry

https://claude.ai/code/session_01VcE6pnjSeAtYvhau1Q6GVM
```

## Files Changed

_File details not available in backfill — see commit link above._
