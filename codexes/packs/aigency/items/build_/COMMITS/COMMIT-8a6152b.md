# Commit Brief: `8a6152b` — Fix flat sponsorship-capacity cap: admins/platform agents are unbounded, tiers honored

| Field | Value |
|-------|-------|
| SHA | [`8a6152b`](https://github.com/iQube-Protocol/AigentZBeta/commit/8a6152b425462c96c7454c6da3e4a24d50e1aa2d) |
| Author | Claude |
| Date | 2026-09-05T05:16:18Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Fix flat sponsorship-capacity cap: admins/platform agents are unbounded, tiers honored

Replaces a hardcoded 3-agent sponsorship cap with a canonical resolver
(services/access/personaCapacity.ts) that: treats an authenticated
administrator as unbounded outright (not merely overridden past an exhausted
cap), extends the same unbounded treatment to platform-authenticated
provisioning (Factor/Aegis-style, gated by a validated platform credential
like CRON_TRIGGER_TOKEN, never a client claim), honors each sponsor's real
tier ladder (3/10/28/35/50/unlimited) instead of a flat 3, represents
"unlimited" as an explicit state rather than a magic 9999, and never reports
negative remaining capacity (a legacy over-capacity account reports
remaining:0 + overCapacity:true instead).

Removes the same flat arithmetic that used to be hand-copied across
sponsorPolityAgent.ts, the Homecoming stand-up route's GET preflight, and the
sponsored-agents capacity display — all three now call the one resolver.
Updates the two UI consumers (SmartWalletDrawer, PassportRegistryTab) that
would otherwise have misrendered an unbounded admin as "0 remaining —
exhausted".

callerIsAdmin/isPlatformAuthority are plain booleans every call site resolves
server-side via getActivePersona().cartridgeFlags.isAdmin — never a request
body, header, or JWT claim; pinned by source-level canaries at every real
call site. No raw SQL bypass and no Factor/Aegis-specific special case was
used — the fix is the canonical resolver itself.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01S5Y1pnDdW3LyguwPdfJjXy
```

## Body

Replaces a hardcoded 3-agent sponsorship cap with a canonical resolver
(services/access/personaCapacity.ts) that: treats an authenticated
administrator as unbounded outright (not merely overridden past an exhausted
cap), extends the same unbounded treatment to platform-authenticated
provisioning (Factor/Aegis-style, gated by a validated platform credential
like CRON_TRIGGER_TOKEN, never a client claim), honors each sponsor's real
tier ladder (3/10/28/35/50/unlimited) instead of a flat 3, represents
"unlimited" as an explicit state rather than a magic 9999, and never reports
negative remaining capacity (a legacy over-capacity account reports
remaining:0 + overCapacity:true instead).

Removes the same flat arithmetic that used to be hand-copied across
sponsorPolityAgent.ts, the Homecoming stand-up route's GET preflight, and the
sponsored-agents capacity display — all three now call the one resolver.
Updates the two UI consumers (SmartWalletDrawer, PassportRegistryTab) that
would otherwise have misrendered an unbounded admin as "0 remaining —
exhausted".

callerIsAdmin/isPlatformAuthority are plain booleans every call site resolves
server-side via getActivePersona().cartridgeFlags.isAdmin — never a request
body, header, or JWT claim; pinned by source-level canaries at every real
call site. No raw SQL bypass and no Factor/Aegis-specific special case was
used — the fix is the canonical resolver itself.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01S5Y1pnDdW3LyguwPdfJjXy

## Files Changed

| Change | File |
|--------|------|
| Modified | `app/api/homecoming/agent/stand-up/route.ts` |
| Modified | `app/api/persona/sponsored-agents/route.ts` |
| Modified | `app/components/content/SmartWalletDrawer.tsx` |
| Modified | `app/triad/components/codex/tabs/PassportRegistryTab.tsx` |
| Modified | `codexes/packs/agentiq/collections.json` |
| Added | `codexes/packs/agentiq/updates/2026-09-05_factor-aegis-capacity-remediation.md` |
| Added | `services/access/personaCapacity.ts` |
| Modified | `services/agents/sponsorPolityAgent.ts` |
| Modified | `services/billing/personaPlan.ts` |
| Added | `tests/persona-capacity.test.ts` |
| Modified | `tests/sponsorship-admin-override.test.ts` |

## Stats

 11 files changed, 711 insertions(+), 144 deletions(-)
