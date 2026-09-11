# Commit Brief: `1b181d3` — add Google Calendar read ingest (past -> log, upcoming -> prepare)

| Field | Value |
|-------|-------|
| SHA | [`1b181d3`](https://github.com/iQube-Protocol/AigentZBeta/commit/1b181d3e28d356d87a4ec1d3031f99b646600dd0) |
| Author | Claude |
| Date | 2026-06-24T23:24:58Z |
| Branch | dev (direct push) |
| Type | `feat` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
add Google Calendar read ingest (past -> log, upcoming -> prepare)

Phase 2 of the actions/standing-docs workstream. Read-only, read-on-demand —
no new OAuth consent (calendar.events already grants read) and nothing is
stored unless the operator turns an event into a signal.

- google.calendar.list-events read connector (no side effect, no approval).
- GET /api/assistant/calendar-events returns past + upcoming events directly
  via the connector (NOT the generic execute route, which would spam an
  artifact_created receipt on every read). 409 when calendar isn't connected.
- Work Log panel shows "Recent meetings — log what you did" (one-click Log ->
  standing signal) and "Coming up — prepare". Section stays hidden when
  calendar isn't connected.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_011WbEHMJb5S4TDxmbbCFBJA
```

## Body

Phase 2 of the actions/standing-docs workstream. Read-only, read-on-demand —
no new OAuth consent (calendar.events already grants read) and nothing is
stored unless the operator turns an event into a signal.

- google.calendar.list-events read connector (no side effect, no approval).
- GET /api/assistant/calendar-events returns past + upcoming events directly
  via the connector (NOT the generic execute route, which would spam an
  artifact_created receipt on every read). 409 when calendar isn't connected.
- Work Log panel shows "Recent meetings — log what you did" (one-click Log ->
  standing signal) and "Coming up — prepare". Section stays hidden when
  calendar isn't connected.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_011WbEHMJb5S4TDxmbbCFBJA

## Files Changed

| Change | File |
|--------|------|
| Added | `app/api/assistant/calendar-events/route.ts` |
| Modified | `components/metame/standing/StandingSignalsPanel.tsx` |
| Modified | `services/google/connectors.ts` |

## Stats

 3 files changed, 267 insertions(+), 2 deletions(-)
