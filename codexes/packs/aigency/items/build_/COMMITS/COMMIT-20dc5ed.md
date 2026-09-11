# Commit Brief: `20dc5ed` — Close MoneyPenny's Ratify runtime-endpoint descriptor gap generically

| Field | Value |
|-------|-------|
| SHA | [`20dc5ed`](https://github.com/iQube-Protocol/AigentZBeta/commit/20dc5ed3152c15db454ca3d079b9544fe4cb5e3b) |
| Author | Claude |
| Date | 2026-08-09T00:46:01Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Close MoneyPenny's Ratify runtime-endpoint descriptor gap generically

services/registry/runtimeDescriptor.ts and services/horizen/pulseEndpoint.ts
were already fully generic — neither hardcodes an agent. The actual gap was
silent: RegistrableAgentConfig had no field forcing a newly-added agent to
also get a runtime surface, so MoneyPenny's registry_assets row never got a
metadata.runtime, and Pulse/Ratify's P&L resolution honestly returned null
for her while Nakamoto's resolved fine.

Added her real health route (app/api/agents/moneypenny/health, mirroring
Nakamoto's exactly) and the paired migration pointing runtime.endpoint at her
actual chat runtime (app/api/moneypenny/chat) and runtime.health at the new
route. Added runtimeHealthPath as a REQUIRED field on RegistrableAgentConfig,
with a canary (tests/registrable-agent-runtime-surface.test.ts) that fails
the build if any registrable agent omits it or names a route that doesn't
exist on disk — so the next agent can't silently skip this the way MoneyPenny
did.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01VKSCjcikJZkkibzBctiun7
```

## Body

services/registry/runtimeDescriptor.ts and services/horizen/pulseEndpoint.ts
were already fully generic — neither hardcodes an agent. The actual gap was
silent: RegistrableAgentConfig had no field forcing a newly-added agent to
also get a runtime surface, so MoneyPenny's registry_assets row never got a
metadata.runtime, and Pulse/Ratify's P&L resolution honestly returned null
for her while Nakamoto's resolved fine.

Added her real health route (app/api/agents/moneypenny/health, mirroring
Nakamoto's exactly) and the paired migration pointing runtime.endpoint at her
actual chat runtime (app/api/moneypenny/chat) and runtime.health at the new
route. Added runtimeHealthPath as a REQUIRED field on RegistrableAgentConfig,
with a canary (tests/registrable-agent-runtime-surface.test.ts) that fails
the build if any registrable agent omits it or names a route that doesn't
exist on disk — so the next agent can't silently skip this the way MoneyPenny
did.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01VKSCjcikJZkkibzBctiun7

## Files Changed

| Change | File |
|--------|------|
| Added | `app/api/agents/moneypenny/health/route.ts` |
| Modified | `services/horizen/registrableAgents.ts` |
| Added | `supabase/migrations/20260930002300_moneypenny_runtime_endpoint.sql` |
| Added | `tests/registrable-agent-runtime-surface.test.ts` |
| Modified | `tests/registration-standing-seed-award.test.ts` |

## Stats

 5 files changed, 180 insertions(+)
