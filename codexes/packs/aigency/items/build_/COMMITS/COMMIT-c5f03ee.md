# Commit Brief: `c5f03ee` — add Google Tasks read ingest (completed -> log, pending -> to-dos)

| Field | Value |
|-------|-------|
| SHA | [`c5f03ee`](https://github.com/iQube-Protocol/AigentZBeta/commit/c5f03eeb43dbeeaba96f02a20bf916caa00b0909) |
| Author | Claude |
| Date | 2026-06-25T00:35:17Z |
| Branch | dev (direct push) |
| Type | `feat` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
add Google Tasks read ingest (completed -> log, pending -> to-dos)

Lowest-sensitivity source: the operator's own to-do list. Read-only,
read-on-demand — nothing stored unless a task is turned into a signal.

- New 'tasks' Google source + tasks.readonly scope (the one new consent).
- google.tasks.list read connector (default list, completed + pending).
- GET /api/assistant/google-tasks returns completed + pending directly via
  the connector (no receipt spam); 409 when Tasks isn't connected.
- Work Log panel: "Tasks you completed — log them" (one-click Log -> signal)
  and "To do (from Google Tasks)". Hidden until connected.
- GoogleConnectionsPanel gains a Tasks card so the operator can grant the
  read-only scope; render guards against any unknown source.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_011WbEHMJb5S4TDxmbbCFBJA
```

## Body

Lowest-sensitivity source: the operator's own to-do list. Read-only,
read-on-demand — nothing stored unless a task is turned into a signal.

- New 'tasks' Google source + tasks.readonly scope (the one new consent).
- google.tasks.list read connector (default list, completed + pending).
- GET /api/assistant/google-tasks returns completed + pending directly via
  the connector (no receipt spam); 409 when Tasks isn't connected.
- Work Log panel: "Tasks you completed — log them" (one-click Log -> signal)
  and "To do (from Google Tasks)". Hidden until connected.
- GoogleConnectionsPanel gains a Tasks card so the operator can grant the
  read-only scope; render guards against any unknown source.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_011WbEHMJb5S4TDxmbbCFBJA

## Files Changed

| Change | File |
|--------|------|
| Added | `app/api/assistant/google-tasks/route.ts` |
| Modified | `components/metame/connections/GoogleConnectionsPanel.tsx` |
| Modified | `components/metame/standing/StandingSignalsPanel.tsx` |
| Modified | `services/google/connectors.ts` |
| Modified | `services/google/oauth.ts` |

## Stats

 5 files changed, 238 insertions(+), 9 deletions(-)
