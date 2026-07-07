# Commit Brief: `e48b314` — Extend CDE DevTools with server-side telemetry + escalation log, and grow the Terminal's read-only diagnostics

| Field | Value |
|-------|-------|
| SHA | [`e48b314`](https://github.com/iQube-Protocol/AigentZBeta/commit/e48b31418091e70fe2fd217fb28405695e120b5c) |
| Author | Claude |
| Date | 2026-07-07T17:34:06Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Extend CDE DevTools with server-side telemetry + escalation log, and grow the Terminal's read-only diagnostics

Adds the two server-side observation surfaces a browser's F12 cannot reach,
without rebuilding browser DevTools and without any arbitrary-eval console.

- Platform telemetry (the server↔canister↔DVN "Network" view): recent DVN
  submission status + timing composed from the existing getDVNStatus() ops
  probe, canister health, receipt pipeline counts by state, plus a best-effort
  per-instance request ring buffer (services/devCommandCenter/requestTelemetry.ts,
  cap 100) honestly labeled "this compute instance only — resets on cold start"
  (Lambda has no shared memory across instances).
- Escalation / platform log stream: dvn_failed receipts surfaced read-only,
  newest first, each with the honest retry-route pointer. Sourced from DURABLE
  DB records (the receipt read path), not a raw server log tail — a CloudWatch
  tail is deferred (AWS SDK is not a dependency; no-new-deps holds) and named as
  a follow-on.
- Four new read-only Terminal commands appended to the whitelist grammar
  (dvn [status|pending|failed], logs [n], net [n], experiments) — each
  argument-validated, refused-by-default if malformed, and observed via DCIR.
  The Terminal stays a strict whitelist: no eval, no child_process, no dynamic
  dispatch. Composed from ops/dvn, the receipt pipeline, the request buffer, and
  listResearchObjects — no forked probe logic.
- requestTelemetry wired at the return points of 5 representative routes
  (dev-command-center devtools/sessions/terminal + ops/dvn/pending +
  ops/canisters/health) as one-line best-effort calls. Entries store only
  method + path template + status + latency; query strings/tokens/T0 identifiers
  are structurally inexpressible and defensively stripped.
- CFS-020 charter: appended the "CDE DevTools scope decision (2026-07-07)"
  recording the deliberate non-rebuild of browser DevTools, the server-side
  visibility mandate, the no-eval boundary (CFS-016 D1), the deferred CloudWatch
  tail, and the best-effort per-instance telemetry limit.
- Canary (tests/dcc-tools.test.ts): new commands parse; malformed/injection
  forms still refused with CONSTITUTIONAL_REFUSAL; requestTelemetry is a bounded
  ring storing only T2-safe fields; recentServerCalls is newest-first bounded
  by n. 103 checks pass.

Co-Authored-By: Claude <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Y98FMjkM8zUDsYqJikzsMB
```

## Body

Adds the two server-side observation surfaces a browser's F12 cannot reach,
without rebuilding browser DevTools and without any arbitrary-eval console.

- Platform telemetry (the server↔canister↔DVN "Network" view): recent DVN
  submission status + timing composed from the existing getDVNStatus() ops
  probe, canister health, receipt pipeline counts by state, plus a best-effort
  per-instance request ring buffer (services/devCommandCenter/requestTelemetry.ts,
  cap 100) honestly labeled "this compute instance only — resets on cold start"
  (Lambda has no shared memory across instances).
- Escalation / platform log stream: dvn_failed receipts surfaced read-only,
  newest first, each with the honest retry-route pointer. Sourced from DURABLE
  DB records (the receipt read path), not a raw server log tail — a CloudWatch
  tail is deferred (AWS SDK is not a dependency; no-new-deps holds) and named as
  a follow-on.
- Four new read-only Terminal commands appended to the whitelist grammar
  (dvn [status|pending|failed], logs [n], net [n], experiments) — each
  argument-validated, refused-by-default if malformed, and observed via DCIR.
  The Terminal stays a strict whitelist: no eval, no child_process, no dynamic
  dispatch. Composed from ops/dvn, the receipt pipeline, the request buffer, and
  listResearchObjects — no forked probe logic.
- requestTelemetry wired at the return points of 5 representative routes
  (dev-command-center devtools/sessions/terminal + ops/dvn/pending +
  ops/canisters/health) as one-line best-effort calls. Entries store only
  method + path template + status + latency; query strings/tokens/T0 identifiers
  are structurally inexpressible and defensively stripped.
- CFS-020 charter: appended the "CDE DevTools scope decision (2026-07-07)"
  recording the deliberate non-rebuild of browser DevTools, the server-side
  visibility mandate, the no-eval boundary (CFS-016 D1), the deferred CloudWatch
  tail, and the best-effort per-instance telemetry limit.
- Canary (tests/dcc-tools.test.ts): new commands parse; malformed/injection
  forms still refused with CONSTITUTIONAL_REFUSAL; requestTelemetry is a bounded
  ring storing only T2-safe fields; recentServerCalls is newest-first bounded
  by n. 103 checks pass.

Co-Authored-By: Claude <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Y98FMjkM8zUDsYqJikzsMB

## Files Changed

| Change | File |
|--------|------|
| Modified | `app/api/dev-command-center/_lib/diagnostics.ts` |
| Modified | `app/api/dev-command-center/devtools/route.ts` |
| Modified | `app/api/dev-command-center/sessions/route.ts` |
| Modified | `app/api/dev-command-center/terminal/route.ts` |
| Modified | `app/api/ops/canisters/health/route.ts` |
| Modified | `app/api/ops/dvn/pending/route.ts` |
| Modified | `codexes/packs/ccrl/foundation/CFS-020_dcir-charter.md` |
| Modified | `components/devcommandcenter/layouts/DevToolsLayout.tsx` |
| Added | `services/devCommandCenter/requestTelemetry.ts` |
| Modified | `services/devCommandCenter/terminalCommands.ts` |
| Modified | `tests/dcc-tools.test.ts` |

## Stats

 11 files changed, 542 insertions(+), 7 deletions(-)
