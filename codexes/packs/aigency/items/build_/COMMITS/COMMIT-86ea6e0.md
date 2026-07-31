# Commit Brief: `86ea6e0` — add ccip-read ens operator runbook

| Field | Value |
|-------|-------|
| SHA | [`86ea6e0`](https://github.com/iQube-Protocol/AigentZBeta/commit/86ea6e021553f4f057befdf6519df25ecda37528) |
| Author | Claude |
| Date | 2026-06-14T01:42:34Z |
| Branch | dev (direct push) |
| Type | `feat` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
add ccip-read ens operator runbook

consolidates the deploy + verification path for the self-hosted
ccip-read ens resolver into a single doc so the operator doesn't
have to scroll chat history:

- prereqs (polity.eth on sepolia, sepolia ETH, faucet links)
- step 1: generate polity issuer key + set in amplify
- step 2: verify signing roundtrip via /api/ens/ccip-read/health
  BEFORE spending gas on the contract deploy
- step 3: deploy script invocation
- step 4: set deployed resolver on polity.eth via sepolia.app.ens.domains
- step 5: mint test subname + verify resolution via viem
- judges' view: what they will see + which public verifier endpoints
  are available
- troubleshooting table mapping symptoms to fixes
- architecture notes: single polity issuer key signs all three trust
  primitives (agentkit attestations, provekit proofs, ccip-read ens)
```

## Body

consolidates the deploy + verification path for the self-hosted
ccip-read ens resolver into a single doc so the operator doesn't
have to scroll chat history:

- prereqs (polity.eth on sepolia, sepolia ETH, faucet links)
- step 1: generate polity issuer key + set in amplify
- step 2: verify signing roundtrip via /api/ens/ccip-read/health
  BEFORE spending gas on the contract deploy
- step 3: deploy script invocation
- step 4: set deployed resolver on polity.eth via sepolia.app.ens.domains
- step 5: mint test subname + verify resolution via viem
- judges' view: what they will see + which public verifier endpoints
  are available
- troubleshooting table mapping symptoms to fixes
- architecture notes: single polity issuer key signs all three trust
  primitives (agentkit attestations, provekit proofs, ccip-read ens)

## Files Changed

| Change | File |
|--------|------|
| Added | `codexes/packs/agentiq/updates/2026-06-13_ccip-read-ens-operator-runbook.md` |

## Stats

 1 file changed, 177 insertions(+)
