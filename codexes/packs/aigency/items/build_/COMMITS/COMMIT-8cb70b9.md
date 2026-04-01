# Commit Brief: `8cb70b9` — add pipeline control plane schema migration

| Field | Value |
|-------|-------|
| SHA | [`8cb70b9`](https://github.com/iQube-Protocol/AigentZBeta/commit/8cb70b98bdf3b65c34b7c84a87bac3c9dcf37435) |
| Author | Claude |
| Date | 2026-03-26T00:04:56Z |
| Branch | dev (direct push) |
| Type | `feat` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
add pipeline control plane schema migration

Adds pipeline_runs and pipeline_run_events tables. pipeline_runs tracks
one row per invocation with full stage_history JSONB and identity_envelope.
pipeline_run_events is an append-only event log per run.

https://claude.ai/code/session_01VcE6pnjSeAtYvhau1Q6GVM
```

## Files Changed

_File details not available in backfill — see commit link above._
