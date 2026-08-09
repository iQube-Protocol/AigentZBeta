# Commit Brief: `a016920` — Build the read-only Agent-N preflight check

| Field | Value |
|-------|-------|
| SHA | [`a016920`](https://github.com/iQube-Protocol/AigentZBeta/commit/a0169201da10a5d62acf524beda2d1ef2d8436a7) |
| Author | Claude |
| Date | 2026-08-09T01:17:29Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Build the read-only Agent-N preflight check

GET /api/journey/moneypenny-horizen/preflight?agentSlug=<slug> — the
operator's go/no-go check before recording an Agent-N journey, composed
entirely from the canonical readers the journey state route already uses
(never a second resolution of the same question): identity/config
(runtimeAgentId, Agent Card, registry_assets row, runtime endpoint
descriptor), authority (persona, RootDID, principal wallet, agent key,
Passport, delegation), infrastructure (Supabase, DVN canister config,
CRON_TRIGGER_TOKEN, live reachability probes for Horizen's registry MCP and
Base Sepolia RPC), verification (Constitutional Agreement, Pulse, P&L
authorization/verification), and consequence (factory ingestion, Standing
seed).

Every line reports READY / ALREADY_COMPLETE / BLOCKED / DEGRADED /
NOT_REQUIRED with a named reason. Purely read-only — no signature,
broadcast, settle, or receipt write. Each check is isolated in its own
try/catch so one thrown dependency degrades only that line, never aborts the
report (Constitutional Execution Family — Exception Isolation).

Live reachability probes (Horizen MCP, Base Sepolia RPC) degrade rather than
block on failure — an unreachable network is an audit gap, not proof the
service is down, and this sandbox has no outbound network/credentials to
verify against live (CODE READY / LIVE VERIFICATION PENDING).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01VKSCjcikJZkkibzBctiun7
```

## Body

GET /api/journey/moneypenny-horizen/preflight?agentSlug=<slug> — the
operator's go/no-go check before recording an Agent-N journey, composed
entirely from the canonical readers the journey state route already uses
(never a second resolution of the same question): identity/config
(runtimeAgentId, Agent Card, registry_assets row, runtime endpoint
descriptor), authority (persona, RootDID, principal wallet, agent key,
Passport, delegation), infrastructure (Supabase, DVN canister config,
CRON_TRIGGER_TOKEN, live reachability probes for Horizen's registry MCP and
Base Sepolia RPC), verification (Constitutional Agreement, Pulse, P&L
authorization/verification), and consequence (factory ingestion, Standing
seed).

Every line reports READY / ALREADY_COMPLETE / BLOCKED / DEGRADED /
NOT_REQUIRED with a named reason. Purely read-only — no signature,
broadcast, settle, or receipt write. Each check is isolated in its own
try/catch so one thrown dependency degrades only that line, never aborts the
report (Constitutional Execution Family — Exception Isolation).

Live reachability probes (Horizen MCP, Base Sepolia RPC) degrade rather than
block on failure — an unreachable network is an audit gap, not proof the
service is down, and this sandbox has no outbound network/credentials to
verify against live (CODE READY / LIVE VERIFICATION PENDING).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01VKSCjcikJZkkibzBctiun7

## Files Changed

| Change | File |
|--------|------|
| Added | `app/api/journey/moneypenny-horizen/preflight/route.ts` |
| Added | `services/horizen/agentPreflight.ts` |
| Added | `tests/agent-preflight.test.ts` |

## Stats

 3 files changed, 465 insertions(+)
