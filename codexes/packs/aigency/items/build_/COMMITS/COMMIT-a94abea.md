# Commit Brief: `a94abea` — fix toggle persistence — remove invalid columns from upsert + sync localStorage

| Field | Value |
|-------|-------|
| SHA | [`a94abea`](https://github.com/iQube-Protocol/AigentZBeta/commit/a94abea66a7d1e75ebfaddf95c342a5824c03986) |
| Author | Claude |
| Date | 2026-06-19T12:45:36Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
fix toggle persistence — remove invalid columns from upsert + sync localStorage

Root cause: the PUT to /api/runtime/settings/context included `active_codex`
and `timestamp` columns that don't exist in the orchestration_events table.
PostgreSQL rejected every upsert, the .catch(() => {}) swallowed the error,
so the row was never written. On reload, the GET returned 'knyt' (default
fallback) and overrode whatever localStorage had.

Fix: remove the two invalid columns from the upsert payload. Also sync
localStorage when the server GET returns a value on load, so both sources
stay consistent.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01LPt5L6vMfR6x9uqnNLmTzt
```

## Body

Root cause: the PUT to /api/runtime/settings/context included `active_codex`
and `timestamp` columns that don't exist in the orchestration_events table.
PostgreSQL rejected every upsert, the .catch(() => {}) swallowed the error,
so the row was never written. On reload, the GET returned 'knyt' (default
fallback) and overrode whatever localStorage had.

Fix: remove the two invalid columns from the upsert payload. Also sync
localStorage when the server GET returns a value on load, so both sources
stay consistent.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01LPt5L6vMfR6x9uqnNLmTzt

## Files Changed

| Change | File |
|--------|------|
| Modified | `app/api/runtime/settings/context/route.ts` |
| Modified | `components/metame/MetaMeRuntimeClient.tsx` |

## Stats

 2 files changed, 1 insertion(+), 2 deletions(-)
