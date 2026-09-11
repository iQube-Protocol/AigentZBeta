# Commit Brief: `33fed9b` — add confirm-artifact MCP tool and thread agent identity onto exchange receipts

| Field | Value |
|-------|-------|
| SHA | [`33fed9b`](https://github.com/iQube-Protocol/AigentZBeta/commit/33fed9bb6b2b42a13a9d66f39ac8a534304973bd) |
| Author | Claude |
| Date | 2026-08-28T13:07:20Z |
| Branch | dev (direct push) |
| Type | `feat` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
add confirm-artifact MCP tool and thread agent identity onto exchange receipts

Adds confirm_operator_assisted_artifact as a Threshold MCP tool, wiring
confirmOperatorAssistedArtifact() (services/research/reciprocalExchange.ts)
through mcpConstitutionalActs.ts/gateway.ts/route.ts on the exact pattern
deposit_exchange_artifact already uses — explicit declarationConfirmed
consent, T0<->T2 principal resolution, no parallel logic. This was the one
genuinely missing MCP-completable stage from the audit of all 8 constitutional
act stages (delegation, deposit, fingerprint, freeze, freeze-attestation,
instrument presentation, signing, final readback) against
services/threshold/mcpConstitutionalActs.ts and app/api/threshold/mcp/route.ts.

Threads a third identity — a T2-safe delegated-agent reference (ScopedSession
.agentAlias, e.g. 'companion_xyz') — onto MCP-originated exchange receipts via
the existing agentsInvoked field, so principal (personaId), delegated agent
(agentsInvoked), and channel (origin_channel on the domain evidence row) are
three distinct, never-conflated signals. Adds an optional agentRef param to
depositArtifact/declareFreeze/signInstrument/confirmOperatorAssistedArtifact,
undefined (agentsInvoked:[]) for every existing native-ui caller.

get_exchange_state now also returns the canonical freezeDeclarationText and
exchangeInstrumentClauses (types/reciprocalExchange.ts's own constants) so an
agent always has the real text to present before asking a principal to freeze
or sign — closing the "informed consent to sign something never shown" gap.

Recomputes the depositArtifact structural-canary hash in
tests/reciprocal-exchange.test.ts (deliberate, additive-only change: the
receipt call gained agentsInvoked wiring) and adds
tests/journey-spine-channel-convergence.test.ts, which proves — by executing
the real service functions against a shared in-memory fake table, never by
asserting mocked call shapes — that an MCP-path write (freeze, sign,
delegation) is immediately readable through a different path (getExchangeView,
listMyExchanges, ianJourneyState.ts's fetchIanAuthoritativePlatformState), and
the reverse (a native-path write is immediately visible through the MCP read
tools), confirming Journey Spine convergence held structurally already and
closing the one real gap (confirm-artifact) that did not exist yet.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01NQfGRfi4TgkQbnzUxbMKG9
```

## Body

Adds confirm_operator_assisted_artifact as a Threshold MCP tool, wiring
confirmOperatorAssistedArtifact() (services/research/reciprocalExchange.ts)
through mcpConstitutionalActs.ts/gateway.ts/route.ts on the exact pattern
deposit_exchange_artifact already uses — explicit declarationConfirmed
consent, T0<->T2 principal resolution, no parallel logic. This was the one
genuinely missing MCP-completable stage from the audit of all 8 constitutional
act stages (delegation, deposit, fingerprint, freeze, freeze-attestation,
instrument presentation, signing, final readback) against
services/threshold/mcpConstitutionalActs.ts and app/api/threshold/mcp/route.ts.

Threads a third identity — a T2-safe delegated-agent reference (ScopedSession
.agentAlias, e.g. 'companion_xyz') — onto MCP-originated exchange receipts via
the existing agentsInvoked field, so principal (personaId), delegated agent
(agentsInvoked), and channel (origin_channel on the domain evidence row) are
three distinct, never-conflated signals. Adds an optional agentRef param to
depositArtifact/declareFreeze/signInstrument/confirmOperatorAssistedArtifact,
undefined (agentsInvoked:[]) for every existing native-ui caller.

get_exchange_state now also returns the canonical freezeDeclarationText and
exchangeInstrumentClauses (types/reciprocalExchange.ts's own constants) so an
agent always has the real text to present before asking a principal to freeze
or sign — closing the "informed consent to sign something never shown" gap.

Recomputes the depositArtifact structural-canary hash in
tests/reciprocal-exchange.test.ts (deliberate, additive-only change: the
receipt call gained agentsInvoked wiring) and adds
tests/journey-spine-channel-convergence.test.ts, which proves — by executing
the real service functions against a shared in-memory fake table, never by
asserting mocked call shapes — that an MCP-path write (freeze, sign,
delegation) is immediately readable through a different path (getExchangeView,
listMyExchanges, ianJourneyState.ts's fetchIanAuthoritativePlatformState), and
the reverse (a native-path write is immediately visible through the MCP read
tools), confirming Journey Spine convergence held structurally already and
closing the one real gap (confirm-artifact) that did not exist yet.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01NQfGRfi4TgkQbnzUxbMKG9

## Files Changed

| Change | File |
|--------|------|
| Modified | `app/api/threshold/mcp/route.ts` |
| Modified | `services/research/reciprocalExchange.ts` |
| Modified | `services/threshold/gateway.ts` |
| Modified | `services/threshold/mcpConstitutionalActs.ts` |
| Added | `tests/journey-spine-channel-convergence.test.ts` |
| Modified | `tests/reciprocal-exchange.test.ts` |

## Stats

 6 files changed, 837 insertions(+), 11 deletions(-)
