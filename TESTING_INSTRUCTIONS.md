# Testing EVM RPC Canister Integration

## Local Testing

1. **Start your local dev server** (if not already running):
   ```bash
   npm run dev
   ```

2. **Test each chain endpoint**:
   ```bash
   curl http://localhost:3002/api/ops/ethereum/sepolia
   curl http://localhost:3002/api/ops/polygon/amoy
   curl http://localhost:3002/api/ops/optimism/sepolia
   curl http://localhost:3002/api/ops/arbitrum/sepolia
   curl http://localhost:3002/api/ops/base/sepolia
   ```

3. **Test Cross-Chain Status**:
   ```bash
   curl http://localhost:3002/api/ops/crosschain/status
   ```

   Should show:
   - `evmChains: 5` (from live EVM RPC canister data)
   - `supportedChains: 7`
   - All EVM diagnostics should show `ok: true`

## Production Testing (After Deploy)

1. **Test Cross-Chain Status**:
   ```bash
   curl https://beta.aigentz.me/api/ops/crosschain/status
   ```

2. **Expected Results**:
   - `evmChains: 5` (LIVE data from EVM RPC canister)
   - `nonEvmChains: 2`
   - `supportedChains: 7`
   - All EVM chains showing `ok: true` in diagnostics

## What Changed

- **Before**: Next.js made direct HTTP calls to RPC providers (blocked in production)
- **After**: Next.js queries EVM RPC canister → Canister makes HTTPS outcalls → RPC providers

## Benefits

- ✅ Works in production (HTTPS outcalls not blocked)
- ✅ Built-in consensus and retry logic
- ✅ No API key management needed
- ✅ LIVE EVM data instead of fallback
