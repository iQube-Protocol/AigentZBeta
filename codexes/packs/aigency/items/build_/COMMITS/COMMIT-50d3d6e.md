# Commit Brief: `50d3d6e` — Add operator-assisted custodial artifact registration for RAX exchanges

| Field | Value |
|-------|-------|
| SHA | [`50d3d6e`](https://github.com/iQube-Protocol/AigentZBeta/commit/50d3d6e32ea39e349fe1ea18f0e587ae1361772c) |
| Author | Claude |
| Date | 2026-08-28T12:21:36Z |
| Branch | dev (direct push) |
| Type | `feat` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Add operator-assisted custodial artifact registration for RAX exchanges

Adds two new primitives to services/research/reciprocalExchange.ts —
registerArtifactOperatorAssisted() and confirmOperatorAssistedArtifact() —
so an operator can, under explicit out-of-band principal authorization,
custodially register an artifact on a bound principal's behalf when that
principal cannot themselves reach a deposit surface. The artifact carries
pending_principal_attestation=true until the bound principal confirms it
themselves; declareFreeze/signInstrument now refuse a pending artifact for
every caller, including the registering operator. depositArtifact,
inviteCounterparty and joinExchange are untouched (zero lines changed).

Adds ensureBoundaryResearchExchangeMembershipOperatorAssisted() to
services/journey/boundaryResearchExchangeAdmission.ts — a thin wrapper
requiring irl-cartridge admin scope (via the existing isCartridgeAdmin
predicate) around the unchanged ensureBoundaryResearchExchangeMembership(),
which still performs the real Passport + research-lab-grant verification.

Migration 20260930120000 adds the new exchange_artifacts columns, extends
origin_channel with 'operator-assisted', and rebuilds the activity_receipts
action_type CHECK constraint for two new receipt types. UNAPPLIED — see
report for the exact SQL and operator instructions.

Fixes a regression introduced by the isCartridgeAdmin import: three
pre-existing threshold test files (constitutional-navigator, gateway,
mcp-constitutional-rituals) transitively hit a module-evaluation-time
Supabase client construction; mocked per this codebase's own established
precedent for the same failure class.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01NQfGRfi4TgkQbnzUxbMKG9
```

## Body

Adds two new primitives to services/research/reciprocalExchange.ts —
registerArtifactOperatorAssisted() and confirmOperatorAssistedArtifact() —
so an operator can, under explicit out-of-band principal authorization,
custodially register an artifact on a bound principal's behalf when that
principal cannot themselves reach a deposit surface. The artifact carries
pending_principal_attestation=true until the bound principal confirms it
themselves; declareFreeze/signInstrument now refuse a pending artifact for
every caller, including the registering operator. depositArtifact,
inviteCounterparty and joinExchange are untouched (zero lines changed).

Adds ensureBoundaryResearchExchangeMembershipOperatorAssisted() to
services/journey/boundaryResearchExchangeAdmission.ts — a thin wrapper
requiring irl-cartridge admin scope (via the existing isCartridgeAdmin
predicate) around the unchanged ensureBoundaryResearchExchangeMembership(),
which still performs the real Passport + research-lab-grant verification.

Migration 20260930120000 adds the new exchange_artifacts columns, extends
origin_channel with 'operator-assisted', and rebuilds the activity_receipts
action_type CHECK constraint for two new receipt types. UNAPPLIED — see
report for the exact SQL and operator instructions.

Fixes a regression introduced by the isCartridgeAdmin import: three
pre-existing threshold test files (constitutional-navigator, gateway,
mcp-constitutional-rituals) transitively hit a module-evaluation-time
Supabase client construction; mocked per this codebase's own established
precedent for the same failure class.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01NQfGRfi4TgkQbnzUxbMKG9

## Files Changed

| Change | File |
|--------|------|
| Modified | `services/journey/boundaryResearchExchangeAdmission.ts` |
| Modified | `services/receipts/activityReceiptService.ts` |
| Modified | `services/research/reciprocalExchange.ts` |
| Added | `supabase/migrations/20260930120000_exchange_operator_assisted_registration.sql` |
| Modified | `tests/boundary-research-exchange-admission.test.ts` |
| Modified | `tests/reciprocal-exchange.test.ts` |
| Modified | `tests/threshold-constitutional-navigator.test.ts` |
| Modified | `tests/threshold-gateway.test.ts` |
| Modified | `tests/threshold-mcp-constitutional-rituals.test.ts` |
| Modified | `types/reciprocalExchange.ts` |

## Stats

 10 files changed, 1273 insertions(+), 2 deletions(-)
