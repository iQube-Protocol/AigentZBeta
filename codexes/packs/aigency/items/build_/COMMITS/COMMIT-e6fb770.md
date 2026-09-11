# Commit Brief: `e6fb770` — Restructure DevTools into tabs (Environment & Canisters · Telemetry · DVN Pipeline · Escalation Log)

| Field | Value |
|-------|-------|
| SHA | [`e6fb770`](https://github.com/iQube-Protocol/AigentZBeta/commit/e6fb77026a4cceb460194dfd12e96490e05889d7) |
| Author | Claude |
| Date | 2026-07-08T14:42:17Z |
| Branch | dev (direct push) |
| Type | `refactor` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Restructure DevTools into tabs (Environment & Canisters · Telemetry · DVN Pipeline · Escalation Log)

Operator request: network details required scrolling to the bottom of the
DevTools capsule. The four instrument groups now sit behind a tab bar at the top
— no scrolling to reach DVN/telemetry state. Failure indicators: a rose dot
flags the Telemetry + DVN Pipeline tabs when the DVN canister is unreachable, and
the DVN Pipeline + Escalation tabs when dvn_failed receipts exist, so a problem is
visible from the tab bar without opening each tab.

Co-Authored-By: Claude <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Y98FMjkM8zUDsYqJikzsMB
```

## Body

Operator request: network details required scrolling to the bottom of the
DevTools capsule. The four instrument groups now sit behind a tab bar at the top
— no scrolling to reach DVN/telemetry state. Failure indicators: a rose dot
flags the Telemetry + DVN Pipeline tabs when the DVN canister is unreachable, and
the DVN Pipeline + Escalation tabs when dvn_failed receipts exist, so a problem is
visible from the tab bar without opening each tab.

Co-Authored-By: Claude <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Y98FMjkM8zUDsYqJikzsMB

## Files Changed

| Change | File |
|--------|------|
| Modified | `components/devcommandcenter/layouts/DevToolsLayout.tsx` |

## Stats

 1 file changed, 48 insertions(+)
