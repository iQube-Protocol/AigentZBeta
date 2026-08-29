# Commit Brief: `d133b9b` — Fix duplicate operator-assisted RAX implementations and broken registration route

| Field | Value |
|-------|-------|
| SHA | [`d133b9b`](https://github.com/iQube-Protocol/AigentZBeta/commit/d133b9bd6e7f37964e08b6260b4913cf482a990d) |
| Author | Claude |
| Date | 2026-08-29T02:37:47Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Fix duplicate operator-assisted RAX implementations and broken registration route

reciprocalExchange.ts and mcpConstitutionalActs.ts each shipped two full,
functionally-divergent implementations of registerArtifactOperatorAssisted /
confirmOperatorAssistedArtifact(ViaMcp) — a real TypeScript "duplicate
function implementation" error masked in production by next.config.js's
ignoreBuildErrors:true. JS declaration semantics let the later (and less
safe) definition win at runtime: it never verified the bound principal was
actually the exchange's counterparty before attributing a Party B artifact
to them, and its confirm path wrote a nonexistent exchange_artifacts.updated_at
column. gateway.ts's real MCP dispatcher still called the earlier signature,
so the live confirm_operator_assisted_artifact tool always failed with
"artifactId is required."

Removed both duplicate blocks, keeping the earlier implementation — the one
actually gateway-wired and covered by tests/reciprocal-exchange.test.ts's 52
existing tests — which already enforces bound-principal-must-equal-Party-B
via resolveMembership as a hard invariant.

Also:
- Exposed the existing, previously uncalled
  ensureBoundaryResearchExchangeMembershipOperatorAssisted via a new
  admin-gated route (app/api/admin/exchanges/operator-assisted-admission),
  adding no new admission logic.
- Fixed register-counterparty-artifact/route.ts: replaced queries against
  nonexistent passports/capability_grants tables (real names:
  polity_passport_records/access_grants) with reliance on the canonical
  service's own membership check, and replaced a nonexistent
  getCallerIdentityContext(req, admin) call with the real
  getActivePersona + isCartridgeAdmin('irl-cartridge') pattern.
- Removed tests/operator-assisted-registration-and-confirmation.test.ts:
  imported @jest/globals (not installed under this vitest project) and has
  never once passed; it also ran unmocked against live Ian production data
  with unseeded fixture variables.
- Added tests/reciprocal-exchange-implementation-singularity.test.ts and
  tsconfig.constitutional.json: structural + scoped-tsc regression coverage
  so a second competing implementation of a constitutional act fails the
  build again, independent of ignoreBuildErrors.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01NQfGRfi4TgkQbnzUxbMKG9
```

## Body

reciprocalExchange.ts and mcpConstitutionalActs.ts each shipped two full,
functionally-divergent implementations of registerArtifactOperatorAssisted /
confirmOperatorAssistedArtifact(ViaMcp) — a real TypeScript "duplicate
function implementation" error masked in production by next.config.js's
ignoreBuildErrors:true. JS declaration semantics let the later (and less
safe) definition win at runtime: it never verified the bound principal was
actually the exchange's counterparty before attributing a Party B artifact
to them, and its confirm path wrote a nonexistent exchange_artifacts.updated_at
column. gateway.ts's real MCP dispatcher still called the earlier signature,
so the live confirm_operator_assisted_artifact tool always failed with
"artifactId is required."

Removed both duplicate blocks, keeping the earlier implementation — the one
actually gateway-wired and covered by tests/reciprocal-exchange.test.ts's 52
existing tests — which already enforces bound-principal-must-equal-Party-B
via resolveMembership as a hard invariant.

Also:
- Exposed the existing, previously uncalled
  ensureBoundaryResearchExchangeMembershipOperatorAssisted via a new
  admin-gated route (app/api/admin/exchanges/operator-assisted-admission),
  adding no new admission logic.
- Fixed register-counterparty-artifact/route.ts: replaced queries against
  nonexistent passports/capability_grants tables (real names:
  polity_passport_records/access_grants) with reliance on the canonical
  service's own membership check, and replaced a nonexistent
  getCallerIdentityContext(req, admin) call with the real
  getActivePersona + isCartridgeAdmin('irl-cartridge') pattern.
- Removed tests/operator-assisted-registration-and-confirmation.test.ts:
  imported @jest/globals (not installed under this vitest project) and has
  never once passed; it also ran unmocked against live Ian production data
  with unseeded fixture variables.
- Added tests/reciprocal-exchange-implementation-singularity.test.ts and
  tsconfig.constitutional.json: structural + scoped-tsc regression coverage
  so a second competing implementation of a constitutional act fails the
  build again, independent of ignoreBuildErrors.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01NQfGRfi4TgkQbnzUxbMKG9

## Files Changed

| Change | File |
|--------|------|
| Modified | `app/api/admin/exchanges/[exchangeId]/register-counterparty-artifact/route.ts` |
| Added | `app/api/admin/exchanges/operator-assisted-admission/route.ts` |
| Modified | `services/research/reciprocalExchange.ts` |
| Modified | `services/threshold/mcpConstitutionalActs.ts` |
| Deleted | `tests/operator-assisted-registration-and-confirmation.test.ts` |
| Added | `tests/reciprocal-exchange-implementation-singularity.test.ts` |
| Added | `tsconfig.constitutional.json` |

## Stats

 7 files changed, 263 insertions(+), 670 deletions(-)
