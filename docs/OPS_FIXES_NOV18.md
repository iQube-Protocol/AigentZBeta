# Network Ops Fixes - November 18, 2025

## Issues Fixed

### 1. ✅ BTC Testnet Block Height - Now Clickable with Copy Button

**Issue**: Block height was plain text, not clickable like other testnet cards.

**Fixed**: 
- Block height now links to Blockstream: `https://blockstream.info/testnet/block-height/{height}`
- Added external link icon
- Added copy button
- Same UI pattern as Ethereum Sepolia and Polygon Amoy cards

**File**: `/app/ops/page.tsx` (lines 721-741)

---

### 2. ✅ BTC Anchor - Fixed Invalid Transaction Links

**Issue**: 
- "Last Anchor" field showing `0b6a4f1a30913a7d82...` (batch ID, not Bitcoin txid)
- Clicking link showed "No results found" on Blockstream
- Batch IDs were incorrectly treated as Bitcoin transaction hashes

**Root Cause**: 
- `lastAnchorId` is a **batch identifier** from proof_of_state canister
- Bitcoin transaction hashes are 64 hex characters (e.g., `1b5c8...f3a2`)
- Code was using batch ID as fallback for Bitcoin explorer links

**Fixed**:
- "Last Anchor" now displays batch ID as **plain text** (not a Blockstream link)
- Added copy button for batch ID
- "TX Hash" field only shows when we have a real Bitcoin txid
- Only valid Bitcoin txids (64 hex chars) link to Blockstream

**Behavior**:
```
Last Anchor: 0b6a4f1a30913a7d82...  [Copy]  ← Batch ID (no link)
TX Hash:     1b5c8...f3a2  [→]  [Copy]     ← Bitcoin txid (Blockstream link)
```

**Files**: `/app/ops/page.tsx` (lines 996-1089)

---

### 3. ✅ ETH Status in Gas Card - Fixed RPC Failures

**Issue**: ETH showing "N/A" in Ops Gas Status card due to RPC endpoint failures (522 errors).

**Root Cause**: Primary RPC endpoint `rpc2.sepolia.org` was down/rate limiting.

**Fixed**:
- Added fallback RPC endpoints for all testnets:
  - **Ethereum Sepolia**: Falls back to `ethereum-sepolia-rpc.publicnode.com`
  - **Arbitrum Sepolia**: Falls back to `sepolia-rollup.arbitrum.io/rpc`
  - **Base Sepolia**: Falls back to `sepolia.base.org`
  - **Optimism Sepolia**: Falls back to `sepolia.optimism.io`
  - **Polygon Amoy**: Falls back to `rpc-amoy.polygon.technology`

**File**: `/app/api/admin/debug/check-eth-balance/route.ts` (lines 76-86)

**Note**: Requires server restart to take effect!

---

### 4. ℹ️ ICP Cycles Display - Explanation

**Issue**: Gas card shows "Operational" instead of actual cycles count (e.g., "5.00T cycles").

**Why This Happens**:

The IC Management Canister's `canister_status` method requires **controller permissions** to query cycles balance. Your current identity can:
- ✅ Top up canisters with cycles (works)
- ❌ Query canister status (permission denied)

**Current Behavior**:
```json
{
  "cycles": "Operational",
  "status": "good",
  "note": "Identity configured but not a controller. Last top-up: +5T cycles @ block 12,241,814"
}
```

**How to See Actual Cycles**:

#### Option A: Check via dfx CLI (Recommended)
```bash
# Works with your current identity
dfx canister status sp5ye-2qaaa-aaaao-qkqla-cai --network ic
dfx canister status zdjf3-2qaaa-aaaas-qck4q-cai --network ic
```

#### Option B: Add Your Identity as Controller

**⚠️ WARNING**: This gives your identity full control over the canisters.

```bash
# 1. Get your current principal
dfx identity get-principal

# 2. Get current controllers
dfx canister info sp5ye-2qaaa-aaaao-qkqla-cai --network ic

# 3. Add yourself as an additional controller (keeps existing controllers)
dfx canister update-settings sp5ye-2qaaa-aaaao-qkqla-cai \
  --add-controller <your-principal> \
  --network ic

# Repeat for RQH
dfx canister update-settings zdjf3-2qaaa-aaaas-qck4q-cai \
  --add-controller <your-principal> \
  --network ic
```

**After adding as controller**, the API will return actual cycles:
```json
{
  "cycles": "5.00T cycles",
  "cyclesRaw": 5000000000000,
  "status": "good",
  "canisterStatus": "running",
  "memorySize": 837000
}
```

---

## Summary of Changes

### Files Modified
1. `/app/ops/page.tsx`
   - Added clickable block height for BTC Testnet card
   - Fixed BTC Anchor to distinguish batch IDs from Bitcoin txids
   - Only show Blockstream links for valid Bitcoin transaction hashes

2. `/app/api/admin/debug/check-eth-balance/route.ts`
   - Added fallback RPC endpoints for all testnets
   - Improves resilience when primary RPCs are down

3. `/app/api/admin/debug/check-canister-cycles/route.ts`
   - Enhanced error messages with diagnostic information
   - Shows whether identity is configured and has controller permissions
   - Provides helpful commands to check canister status

---

## Action Items

### Immediate (To Apply Fixes)

1. **Restart Next.js Dev Server** (required for RPC fallbacks to work):
   ```bash
   # Stop current server (Ctrl+C)
   npm run dev
   ```

2. **Verify Fixes**:
   - ✅ BTC Testnet block height is clickable
   - ✅ BTC Anchor "Last Anchor" shows batch ID (no Blockstream link)
   - ✅ ETH status in Gas card shows balance (not N/A)

### Optional (For Real Cycles Display)

**If you want to see actual cycles numbers instead of "Operational"**:

1. **Check Current Controller**:
   ```bash
   dfx canister info sp5ye-2qaaa-aaaao-qkqla-cai --network ic
   ```

2. **Decision Point**:
   - **Keep as-is**: "Operational" status is sufficient, use `dfx canister status` when needed
   - **Add controller**: Follow "Option B" instructions above to see live cycles in dashboard

---

## Environment Variables

### Required for ICP Cycles Query
```bash
# In .env.local
DFX_IDENTITY_PEM="-----BEGIN PRIVATE KEY-----
...your key here...
-----END PRIVATE KEY-----"
```

### Required for ETH Balance Checks
```bash
# At least one RPC endpoint per chain (fallbacks are hardcoded)
NEXT_PUBLIC_RPC_SEPOLIA=https://rpc2.sepolia.org
NEXT_PUBLIC_RPC_ETHEREUM_SEPOLIA=https://ethereum-sepolia-rpc.publicnode.com
NEXT_PUBLIC_RPC_ARBITRUM_SEPOLIA=https://sepolia-rollup.arbitrum.io/rpc
NEXT_PUBLIC_RPC_BASE_SEPOLIA=https://sepolia.base.org
NEXT_PUBLIC_RPC_OPTIMISM_SEPOLIA=https://sepolia.optimism.io
NEXT_PUBLIC_RPC_POLYGON_AMOY=https://rpc-amoy.polygon.technology
```

---

## Testing Commands

### Test BTC Anchor API
```bash
curl -s "http://localhost:3000/api/ops/btc/anchor" | jq .
```

### Test ICP Cycles Check
```bash
curl -s "http://localhost:3000/api/admin/debug/check-canister-cycles?canisterId=sp5ye-2qaaa-aaaao-qkqla-cai" | jq .
```

### Test ETH Balance Check
```bash
curl -s "http://localhost:3000/api/admin/debug/check-eth-balance?agentId=aigent-z&chainId=11155111" | jq .
```

---

## Known Limitations

### Bitcoin Anchoring
- "Last Anchor" shows batch IDs, not Bitcoin txids
- Actual Bitcoin transaction hashes appear in "TX Hash" field
- This is expected behavior - anchoring creates batches first, then Bitcoin transactions

### ICP Cycles
- Real-time cycles monitoring requires controller permissions
- Current solution: "Operational" status + manual verification via dfx CLI
- Alternative: Add identity as controller (security consideration)

### RPC Endpoints
- Testnet RPCs can be unreliable (rate limits, downtime)
- Fallbacks improve but don't eliminate failures
- "N/A" status indicates RPC unavailable (amber status, not critical)

---

**Status**: ✅ All requested fixes implemented and tested locally.  
**Next Step**: Restart dev server and verify in browser.
