# EVM RPC Canister Implementation Plan

## Current Status
- **Fallback solution deployed**: Production shows 7 chains using simulated data
- **Root cause identified**: Next.js making direct RPC calls (blocked in production)

## Proper Architecture

### Current (Broken):
```
Next.js → Direct HTTP → RPC Providers ❌
```

### Correct:
```
Next.js → EVM RPC Canister → HTTPS Outcalls → RPC Providers ✅
```

## Implementation Steps

### 1. Setup (Already Done)
- ✅ Created `dfx.json` with official EVM RPC canister
- Canister ID: `7hfb6-caaaa-aaaar-qadga-cai`

### 2. Update Chain Endpoints (TODO)

Replace direct RPC calls in these files:
- `/app/api/ops/ethereum/sepolia/route.ts`
- `/app/api/ops/polygon/amoy/route.ts`
- `/app/api/ops/optimism/sepolia/route.ts`
- `/app/api/ops/arbitrum/sepolia/route.ts`
- `/app/api/ops/base/sepolia/route.ts`

### 3. Example Implementation

```typescript
// Instead of fetch to RPC provider:
const evm = await getAnonymousActor('7hfb6-caaaa-aaaar-qadga-cai', evmRpcIdl);
const result = await evm.eth_getBlockByNumber({
  chain: { EthSepolia: null },
  rpcServices: { EthSepolia: [{ Alchemy: null }] },
  blockTag: { Latest: null }
});
```

### 4. Benefits
- ✅ No blocked HTTPS calls
- ✅ Built-in consensus and retry
- ✅ No API key management
- ✅ Works in production

## Next Session
1. Download official EVM RPC Candid interface
2. Update all 5 chain endpoints
3. Test locally with dfx
4. Deploy to production
