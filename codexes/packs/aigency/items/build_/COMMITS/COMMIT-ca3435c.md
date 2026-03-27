# Commit Brief: `ca3435c` — route marketa campaign deploy and sequence dispatch through pipeline orchestrator

| Field | Value |
|-------|-------|
| SHA | [`ca3435c`](https://github.com/iQube-Protocol/AigentZBeta/commit/ca3435c1fda9670f5ed4b68c3da9815d7604e02f) |
| Author | Claude |
| Date | 2026-03-26T00:34:58Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
route marketa campaign deploy and sequence dispatch through pipeline orchestrator

Adds pipeline run tracking (initiatedVia: "marketa") for both:
- campaigns/deploy: deploy.runtime.started → deploy.runtime.completed
- sequence/dispatch: deploy.distribution.started → deploy.distribution.completed per item

Pipeline failures are non-blocking — Marketa operations continue if Supabase is unavailable.
Pipeline run ID surfaced in campaigns/deploy response for traceability.

https://claude.ai/code/session_01VcE6pnjSeAtYvhau1Q6GVM
```

## Files Changed

_File details not available in backfill — see commit link above._
