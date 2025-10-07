# Solana Integration Plan for QCT Cross-Chain Trading

## Overview

Integrate Solana into the iQube Protocol using ICP's SOL RPC canister, similar to how we integrated EVM chains.

## Official SOL RPC Canister

**Canister ID**: `tghme-zyaaa-aaaar-qarca-cai`
- Runs on fiduciary subnet
- Controlled by Network Nervous System (NNS)
- No API keys needed
- Queries multiple providers (Helius, Alchemy, Ankr, dRPC, PublicNode)
- Built-in consensus mechanism

## Supported Methods

Key methods for QCT Cross-Chain Trading:

1. **`getAccountInfo`** - Get account data (for checking balances, token accounts)
2. **`getBalance`** - Get SOL balance
3. **`getBlock`** - Get block data
4. **`getSignaturesForAddress`** - Get transaction signatures for an address
5. **`getSignatureStatuses`** - Check transaction status
6. **`getSlot`** - Get current slot (block height)

## Implementation Steps

### 1. Add SOL RPC Canister to dfx.json

```json
{
  "canisters": {
    "evm_rpc": {
      "type": "pull",
      "id": "7hfb6-caaaa-aaaar-qadga-cai"
    },
    "sol_rpc": {
      "type": "pull",
      "id": "tghme-zyaaa-aaaar-qarca-cai"
    }
  }
}
```

### 2. Create Solana RPC IDL

Create `services/ops/idl/sol_rpc.ts` with TypeScript definitions for:
- `getAccountInfo`
- `getBalance`
- `getSignatureStatuses`
- `getSlot`

### 3. Update Solana Endpoint

Update `/app/api/ops/solana/testnet/route.ts` to use SOL RPC canister instead of direct HTTP calls.

### 4. Create QCT Solana Trading Endpoints

New endpoints needed:
- `/api/qct/solana/check-balance` - Check SOL/SPL token balance
- `/api/qct/solana/submit-transaction` - Submit signed transaction
- `/api/qct/solana/transaction-status` - Check transaction status
- `/api/qct/solana/account-info` - Get account information

### 5. Integration with Existing QCT System

Connect to existing QCT Cross-Chain Trading card:
- Add Solana as a supported chain
- Implement token swap logic
- Add transaction signing via IC threshold signatures

## Architecture

```
QCT Frontend
    ↓
Next.js API (/api/qct/solana/*)
    ↓
SOL RPC Canister (tghme-zyaaa-aaaar-qarca-cai)
    ↓
HTTPS Outcalls to multiple Solana RPC providers
    ↓
Solana Blockchain
```

## Benefits

- ✅ No single point of failure (multiple providers)
- ✅ No API key management
- ✅ Built-in consensus mechanism
- ✅ Pay in cycles
- ✅ Threshold Ed25519 signatures for transaction signing

## Next Steps

1. Download official SOL RPC Candid interface
2. Create TypeScript IDL
3. Update Solana testnet endpoint
4. Create QCT Solana trading endpoints
5. Test locally
6. Deploy to production

## References

- [ICP Solana Integration](https://internetcomputer.org/docs/building-apps/chain-fusion/solana/overview)
- [SOL RPC Canister GitHub](https://github.com/dfinity/sol-rpc-canister)
- [Solana RPC HTTP Methods](https://solana.com/de/docs/rpc/http)
