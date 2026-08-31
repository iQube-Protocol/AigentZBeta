# Commit Brief: `c08f312` — Fix MCP exchange-write gate to accept canonical exchange authority, not only IRL-service scope

| Field | Value |
|-------|-------|
| SHA | [`c08f312`](https://github.com/iQube-Protocol/AigentZBeta/commit/c08f31279af555959b16bdadfc25b175d087d969) |
| Author | Claude |
| Date | 2026-08-30T15:59:05Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Fix MCP exchange-write gate to accept canonical exchange authority, not only IRL-service scope

Root cause: gateway.ts gated deposit/confirm/freeze/sign on
hasScope(session, 'research.exchange.write') alone — a scope minted only
by a separate, generic incremental OAuth 'enter the irl service' crossing
(serviceRegistry.ts, gatewaySession.ts applyUpgrade), designed for a
principal entering IRL for the first time (PRD-THR-001 SS9.3). It had no
path to reflect a principal who already holds real Reciprocal Artifact
Exchange participation + delegation established through the native/bridge
journey. The bridge route has no equivalent session-scope concept at
all, so this was a live channel-inequivalence defect: a fully established
exchange participant was refused on MCP with a demand to redo a redundant
human ceremony that the bridge never required.

Adds resolveExchangeWriteAuthority (mcpConstitutionalActs.ts) as the one
canonical resolver both the gateway gate and every write function now
share — re-deriving write authority from real exchange membership
(resolveMcpPrincipal + resolveActiveExchangeId) when the session lacks
research.exchange.write. Fails closed exactly as those functions already
did: an unresolvable principal or a principal with no bound exchange is
still refused. establish_delegation is untouched (it grants new authority
to a third-party agent, not authority over an existing exchange) and
keeps its own delegation.grant-only gate. Sessions that already hold
research.exchange.write take the unchanged fast path with no extra DB
probe.
```

## Body

Root cause: gateway.ts gated deposit/confirm/freeze/sign on
hasScope(session, 'research.exchange.write') alone — a scope minted only
by a separate, generic incremental OAuth 'enter the irl service' crossing
(serviceRegistry.ts, gatewaySession.ts applyUpgrade), designed for a
principal entering IRL for the first time (PRD-THR-001 SS9.3). It had no
path to reflect a principal who already holds real Reciprocal Artifact
Exchange participation + delegation established through the native/bridge
journey. The bridge route has no equivalent session-scope concept at
all, so this was a live channel-inequivalence defect: a fully established
exchange participant was refused on MCP with a demand to redo a redundant
human ceremony that the bridge never required.

Adds resolveExchangeWriteAuthority (mcpConstitutionalActs.ts) as the one
canonical resolver both the gateway gate and every write function now
share — re-deriving write authority from real exchange membership
(resolveMcpPrincipal + resolveActiveExchangeId) when the session lacks
research.exchange.write. Fails closed exactly as those functions already
did: an unresolvable principal or a principal with no bound exchange is
still refused. establish_delegation is untouched (it grants new authority
to a third-party agent, not authority over an existing exchange) and
keeps its own delegation.grant-only gate. Sessions that already hold
research.exchange.write take the unchanged fast path with no extra DB
probe.

## Files Changed

| Change | File |
|--------|------|
| Modified | `.amplify-deploy` |
| Modified | `app/api/threshold/mcp/route.ts` |
| Modified | `services/threshold/gateway.ts` |
| Modified | `services/threshold/mcpConstitutionalActs.ts` |
| Modified | `tests/threshold-mcp-constitutional-rituals.test.ts` |

## Stats

 5 files changed, 266 insertions(+), 32 deletions(-)
