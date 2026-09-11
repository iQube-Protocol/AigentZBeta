# Commit Brief: `bb9ec06` — Seed Factor's runtime endpoint; add invoke routes for Factor + Aegis

| Field | Value |
|-------|-------|
| SHA | [`bb9ec06`](https://github.com/iQube-Protocol/AigentZBeta/commit/bb9ec069e7db602d6d00e74d80f0110bd082a3d5) |
| Author | Claude |
| Date | 2026-09-05T06:04:54Z |
| Branch | dev (direct push) |
| Type | `feat` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Seed Factor's runtime endpoint; add invoke routes for Factor + Aegis

Adds app/api/agents/factor/invoke/route.ts and .../aegis/invoke/route.ts,
mirroring app/api/agents/nakamoto/invoke/route.ts exactly: each delegates to
the existing ask-agent/specialistRouter execution path (specialistId pinned,
never a second "ask Factor"/"ask Aegis" implementation). Factor and Aegis
were already registered specialists in services/agents/specialistRouter.ts;
these routes give them the same governed invoke surface every other
registrable agent has.

Seeds registry_assets.metadata.runtime for aigentqube-factor (applied live)
pointing at the new invoke + existing health routes, mirroring the
Nakamoto/MoneyPenny runtime-endpoint migrations exactly. Verified live: the
Agent Card now projects the runtime block, and the Horizen preflight's
"Runtime endpoint descriptor" check moved from BLOCKED to ALREADY_COMPLETE.
Aegis is deliberately NOT seeded into registry_assets — it is not a Horizen
pilot-journey participant.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01S5Y1pnDdW3LyguwPdfJjXy
```

## Body

Adds app/api/agents/factor/invoke/route.ts and .../aegis/invoke/route.ts,
mirroring app/api/agents/nakamoto/invoke/route.ts exactly: each delegates to
the existing ask-agent/specialistRouter execution path (specialistId pinned,
never a second "ask Factor"/"ask Aegis" implementation). Factor and Aegis
were already registered specialists in services/agents/specialistRouter.ts;
these routes give them the same governed invoke surface every other
registrable agent has.

Seeds registry_assets.metadata.runtime for aigentqube-factor (applied live)
pointing at the new invoke + existing health routes, mirroring the
Nakamoto/MoneyPenny runtime-endpoint migrations exactly. Verified live: the
Agent Card now projects the runtime block, and the Horizen preflight's
"Runtime endpoint descriptor" check moved from BLOCKED to ALREADY_COMPLETE.
Aegis is deliberately NOT seeded into registry_assets — it is not a Horizen
pilot-journey participant.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01S5Y1pnDdW3LyguwPdfJjXy

## Files Changed

| Change | File |
|--------|------|
| Added | `app/api/agents/aegis/invoke/route.ts` |
| Added | `app/api/agents/factor/invoke/route.ts` |
| Added | `supabase/migrations/20260905040000_factor_runtime_endpoint.sql` |
| Added | `tests/agents-factor-aegis-invoke-routes.test.ts` |

## Stats

 4 files changed, 245 insertions(+)
