# Proof-of-State Canister — Mainnet Deployment Backlog

**Date:** 2026-06-24
**Status:** Backlog
**Priority:** Medium — BTC anchor TX hash visible in ops page once complete

---

## Context

The `proof_of_state` canister is responsible for batching DVN receipts and anchoring them to Bitcoin testnet via ordinal transactions. It is the final link in the DVN pipeline:

```
delegation → activity_receipt → DVN canister (cross_chain_service) → proof_of_state → BTC testnet TX
```

During the 2026-06-24 DVN pipeline audit, the following was discovered:

- `proof_of_state` is **not registered in `dfx.json`** — cannot be deployed via `dfx deploy`
- Both candidate canister IDs (`n2hhv-aaaaa-aaaas-qccza-cai` from `canister_ids.json`, `umunu-kh777-77774-qaaca-cai` from Amplify) return `"Not Found"` on the IC mainnet API
- `.dfx/ic/canister_ids.json` is empty — the canister was never deployed to mainnet IC
- The canister source code exists in the repo (`src/`) but the Rust build target and `dfx.json` registration are missing

The ops page BTC Anchor card was showing `mock_btc...` as the TX hash and linking to `blockstream.info/testnet/tx/unknown` (404). This has been fixed in code — the TX Hash field now only renders when the txid is a valid 64-char hex string.

---

## What Needs to Be Done

### 1. Register `proof_of_state` in `dfx.json`

Add the canister definition so `dfx deploy` can target it:

```json
"proof_of_state": {
  "type": "rust",
  "package": "proof_of_state",
  "candid": "src/proof_of_state/proof_of_state.did"
}
```

Confirm the package name matches `src/proof_of_state/Cargo.toml`.

### 2. Deploy to mainnet IC

```bash
export DFX_WARNING=-mainnet_plaintext_identity
dfx deploy proof_of_state --network ic
dfx canister --network ic id proof_of_state
```

### 3. Update `canister_ids.json`

Replace the stale `proof_of_state` entry with the real mainnet canister ID:

```json
"proof_of_state": {
  "ic": "<new-canister-id>"
}
```

### 4. Set Amplify env var

```
PROOF_OF_STATE_CANISTER_ID=<new-canister-id>
```

Trigger a redeploy after saving.

### 5. Verify in ops page

After deploy + redeploy:
- BTC Anchor card should show a real `lastAnchorId` (batch root hash)
- TX Hash should show a real 64-char hex txid linking to `blockstream.info/testnet/tx/<txid>`
- `dvnPending` and `posPending` counts should be in sync

---

## Related Env Vars Already Set (2026-06-24)

These three are confirmed live on mainnet and set in Amplify:

| Var | Canister ID |
|---|---|
| `CROSS_CHAIN_SERVICE_CANISTER_ID` | `sp5ye-2qaaa-aaaao-qkqla-cai` |
| `RQH_CANISTER_ID` | `zdjf3-2qaaa-aaaas-qck4q-cai` |
| `REWARD_HUB_CANISTER_ID` | `lvo2w-jqaaa-aaaas-qc2wa-cai` |

---

## Related Code Changes (2026-06-24 session)

- `services/dvn/activityReceiptDvnPipeline.ts` — added `agent_delegated`, `agent_delegation_revoked` to `ANCHORABLE_ACTION_TYPES`
- `services/receipts/activityReceiptService.ts` — added both to `ActivityActionType` union
- `app/api/codex/chat/agentiq-os/delegation/route.ts` — wired `createActivityReceipt` + `enqueueActivityReceiptAnchor` into delegation grant and revoke handlers
- `app/(shell)/ops/page.tsx` — BTC TX Hash link now guarded by 64-char hex validation; mock txids show `—` instead of broken link
