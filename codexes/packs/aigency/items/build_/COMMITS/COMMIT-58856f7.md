# Commit Brief: `58856f7` — Add Aigent Know1 as a third registrable Horizen agent (config + card + health)

| Field | Value |
|-------|-------|
| SHA | [`58856f7`](https://github.com/iQube-Protocol/AigentZBeta/commit/58856f7ac7c0c117b7765e0ec9ddeab0d392ebac) |
| Author | Claude |
| Date | 2026-08-10T15:14:46Z |
| Branch | dev (direct push) |
| Type | `feat` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Add Aigent Know1 as a third registrable Horizen agent (config + card + health)

Horizen Pilot — Know1 Recording Readiness Pass, part 1 (preflight prep).
Adds kn0w1 to services/horizen/registrableAgents.ts purely as configuration
(runtimeAgentId aigent-kn0w1, aigentQubeId aigentqube-kn0w1, fioHandle
kn0w1@aigent — all sourced from existing repo records, never invented).
displayName is "Aigent Know1" (no zero) per explicit operator instruction
for TTS pronunciation, scoped only to this journey's own narration/UI.

Serves /api/agents/kn0w1/agent-card.json and /api/agents/kn0w1/health
mirroring MoneyPenny/Nakamoto's existing pattern exactly — grounded in
Know1's real personas.ts system prompt and his existing aigentqube-kn0w1
registry_assets description, never copying financial/trading language.
States an explicit FS authority boundary (knowledge/context only, execution
delegated to MoneyPenny) and reports Verifiable P&L as explicitly
not_applicable rather than a stuck pending state.

Upgrades (additively, via UPDATE ... metadata || jsonb_build_object, never a
duplicate INSERT) Know1's EXISTING AigentQube row with metadata.runtime,
metadata.external_registry_bindings (pending, no fabricated tokenId), and
the new knyt_financial_context capability/metadata block.

This is preflight-only: no journey action performed, no Horizen registration
submitted. tests/registrable-agent-runtime-surface.test.ts and the existing
Agent-N genericity suite both pass unmodified with Know1 added.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01VKSCjcikJZkkibzBctiun7
```

## Body

Horizen Pilot — Know1 Recording Readiness Pass, part 1 (preflight prep).
Adds kn0w1 to services/horizen/registrableAgents.ts purely as configuration
(runtimeAgentId aigent-kn0w1, aigentQubeId aigentqube-kn0w1, fioHandle
kn0w1@aigent — all sourced from existing repo records, never invented).
displayName is "Aigent Know1" (no zero) per explicit operator instruction
for TTS pronunciation, scoped only to this journey's own narration/UI.

Serves /api/agents/kn0w1/agent-card.json and /api/agents/kn0w1/health
mirroring MoneyPenny/Nakamoto's existing pattern exactly — grounded in
Know1's real personas.ts system prompt and his existing aigentqube-kn0w1
registry_assets description, never copying financial/trading language.
States an explicit FS authority boundary (knowledge/context only, execution
delegated to MoneyPenny) and reports Verifiable P&L as explicitly
not_applicable rather than a stuck pending state.

Upgrades (additively, via UPDATE ... metadata || jsonb_build_object, never a
duplicate INSERT) Know1's EXISTING AigentQube row with metadata.runtime,
metadata.external_registry_bindings (pending, no fabricated tokenId), and
the new knyt_financial_context capability/metadata block.

This is preflight-only: no journey action performed, no Horizen registration
submitted. tests/registrable-agent-runtime-surface.test.ts and the existing
Agent-N genericity suite both pass unmodified with Know1 added.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01VKSCjcikJZkkibzBctiun7

## Files Changed

| Change | File |
|--------|------|
| Modified | `.amplify-deploy` |
| Added | `app/api/agents/kn0w1/agent-card.json/route.ts` |
| Added | `app/api/agents/kn0w1/health/route.ts` |
| Modified | `services/horizen/registrableAgents.ts` |
| Added | `supabase/migrations/20260810010000_kn0w1_horizen_admission_fields.sql` |
| Added | `tests/know1-registrable-agent.test.ts` |

## Stats

 6 files changed, 615 insertions(+), 1 deletion(-)
