# Commit Brief: `f354c8b` — Fix CDE tool-viewport hang: timebox every external probe (canister/DVN/GitHub/Linear)

| Field | Value |
|-------|-------|
| SHA | [`f354c8b`](https://github.com/iQube-Protocol/AigentZBeta/commit/f354c8b9bec0d741581549018a0049ef263eca91) |
| Author | Claude |
| Date | 2026-07-08T09:20:31Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Fix CDE tool-viewport hang: timebox every external probe (canister/DVN/GitHub/Linear)

Operator report: the Dev Command Center right-pane tool viewports (Terminal,
DevTools, GitHub, Linear) hang and are unusable. Root cause: every external
probe in the dev-command-center routes was a bare await with NO deadline —
getCanisterHealth() and getDVNStatus() (IC canister calls to ic0.app), the
GitHub API fetch, and the Linear API fetch. A slow or unreachable canister/host
left the await pending until the Lambda's own timeout, so the viewport (which
auto-fetches on mount) spun forever. A diagnostics surface must DEGRADE
HONESTLY, never hang.

Fix — timebox at the composition boundary the CDE owns (the probe
implementations in the protected ops/receipts layer are untouched):
- diagnostics.ts: a withTimeout() racer (6s) wraps getCanisterHealth,
  getDVNStatus, and the receipt read; on timeout OR rejection each resolves to
  an honest "probe timed out — unavailable" fallback (never hangs, never throws).
- github.ts + linear route: AbortController deadline (8s) on the fetch; an abort
  surfaces "… timed out — unavailable" instead of hanging.
- terminal `dvn` command routes through the timeboxed getDvnTelemetry.

Now every viewport returns promptly with data or an honest degraded state.

Co-Authored-By: Claude <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Y98FMjkM8zUDsYqJikzsMB
```

## Body

Operator report: the Dev Command Center right-pane tool viewports (Terminal,
DevTools, GitHub, Linear) hang and are unusable. Root cause: every external
probe in the dev-command-center routes was a bare await with NO deadline —
getCanisterHealth() and getDVNStatus() (IC canister calls to ic0.app), the
GitHub API fetch, and the Linear API fetch. A slow or unreachable canister/host
left the await pending until the Lambda's own timeout, so the viewport (which
auto-fetches on mount) spun forever. A diagnostics surface must DEGRADE
HONESTLY, never hang.

Fix — timebox at the composition boundary the CDE owns (the probe
implementations in the protected ops/receipts layer are untouched):
- diagnostics.ts: a withTimeout() racer (6s) wraps getCanisterHealth,
  getDVNStatus, and the receipt read; on timeout OR rejection each resolves to
  an honest "probe timed out — unavailable" fallback (never hangs, never throws).
- github.ts + linear route: AbortController deadline (8s) on the fetch; an abort
  surfaces "… timed out — unavailable" instead of hanging.
- terminal `dvn` command routes through the timeboxed getDvnTelemetry.

Now every viewport returns promptly with data or an honest degraded state.

Co-Authored-By: Claude <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Y98FMjkM8zUDsYqJikzsMB

## Files Changed

| Change | File |
|--------|------|
| Modified | `app/api/dev-command-center/_lib/diagnostics.ts` |
| Modified | `app/api/dev-command-center/_lib/github.ts` |
| Modified | `app/api/dev-command-center/linear/route.ts` |
| Modified | `app/api/dev-command-center/terminal/route.ts` |

## Stats

 4 files changed, 86 insertions(+), 8 deletions(-)
