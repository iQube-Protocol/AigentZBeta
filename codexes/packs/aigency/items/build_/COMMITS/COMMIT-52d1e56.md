# Commit Brief: `52d1e56` — Fix tokenId fallback when Horizen reread succeeds without one

| Field | Value |
|-------|-------|
| SHA | [`52d1e56`](https://github.com/iQube-Protocol/AigentZBeta/commit/52d1e56fe85f5ed718103d37efff857f16767769) |
| Author | Claude |
| Date | 2026-08-09T06:24:43Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Fix tokenId fallback when Horizen reread succeeds without one

checkAgentRegistrationStatus only fell back to the receipt-decoded,
ownerOf-verified onChain.agentId when Horizen's registry reread failed
outright. A reread that SUCCEEDS but returns no tokenId/agentId/id
field fell through to the happy path with tokenId=null, silently
discarding a chain-verified mint. This is exactly what MoneyPenny's
live reconciliation hit: confirmationSource 'on-chain-receipt' with
tokenId reported unknown.

tokenId now resolves from Horizen's reread first, falling back to the
receipt-decoded agentId whenever the reread doesn't supply one -
regardless of whether the reread failed outright or merely omitted
the field. Never fabricated from transaction position or any
heuristic; still refuses REGISTRY_REREAD_FAILED when neither source
resolves a tokenId.
```

## Body

checkAgentRegistrationStatus only fell back to the receipt-decoded,
ownerOf-verified onChain.agentId when Horizen's registry reread failed
outright. A reread that SUCCEEDS but returns no tokenId/agentId/id
field fell through to the happy path with tokenId=null, silently
discarding a chain-verified mint. This is exactly what MoneyPenny's
live reconciliation hit: confirmationSource 'on-chain-receipt' with
tokenId reported unknown.

tokenId now resolves from Horizen's reread first, falling back to the
receipt-decoded agentId whenever the reread doesn't supply one -
regardless of whether the reread failed outright or merely omitted
the field. Never fabricated from transaction position or any
heuristic; still refuses REGISTRY_REREAD_FAILED when neither source
resolves a tokenId.

## Files Changed

| Change | File |
|--------|------|
| Modified | `services/horizen/registrationClient.ts` |
| Modified | `tests/horizen-registration-client.test.ts` |
| Modified | `tests/register-ceremony.test.ts` |

## Stats

 3 files changed, 213 insertions(+), 56 deletions(-)
