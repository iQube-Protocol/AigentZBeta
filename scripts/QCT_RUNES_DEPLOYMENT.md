# QCT Runes Token Deployment Guide

## Overview

This guide explains how to deploy **QriptoCENT (QCT)** as a Bitcoin Runes token on Bitcoin Testnet.

---

## Token Specification

| Property | Value |
|----------|-------|
| **Name** | QRIPTOCENT |
| **Symbol** | Q¢ |
| **Decimals** | 8 (matches Bitcoin) |
| **Total Supply** | 1,000,000,000 QCT (1 billion) |
| **Premine** | 400,000,000 QCT (40%) |
| **Public Mints** | 21,000 mints |
| **Amount per Mint** | 47,619 QCT |
| **Turbo** | Enabled (immediate minting) |

---

## Prerequisites

### 1. Bitcoin Testnet BTC

You need testnet BTC for:
- **Deployment transaction fees**: ~10,000 sats
- **UTXO for etching**: Minimum 20,000 sats recommended

**Get testnet BTC from faucets:**
- https://testnet-faucet.mempool.co/
- https://bitcoinfaucet.uo1.net/
- https://coinfaucet.eu/en/btc-testnet/

### 2. Bitcoin Wallet Private Key

Generate a new Bitcoin testnet private key (WIF format) or use an existing one.

**⚠️ SECURITY WARNING:**
- **NEVER** use a mainnet private key
- **NEVER** commit private keys to git
- Use environment variables only

---

## Deployment Steps

### Step 1: Set Environment Variable

```bash
export BTC_DEPLOYER_KEY="your_testnet_private_key_WIF_format"
```

Example WIF format: `cVt4o7BGAig1UXywgGSmARhxMdzP5qvQsxKkSsc1XEkw3tDTQFpy`

### Step 2: Fund the Deployment Address

Run the script to get the deployment address:

```bash
npm run deploy:qct-runes
```

The script will output:
```
📍 Deployment Address: tb1q...
⚠️  Send testnet BTC to this address and wait for 6 confirmations
```

**Send at least 20,000 sats to this address.**

### Step 3: Wait for Confirmations

**Important:** Wait for **6 confirmations** before the script continues.

You can check confirmations at:
- https://mempool.space/testnet/address/[your_address]

### Step 4: Complete Deployment

Once the UTXO has 6+ confirmations, the script will automatically:
1. Create the etching transaction
2. Sign the transaction
3. Broadcast to Bitcoin Testnet
4. Display the transaction ID

### Step 5: Get Rune ID

After the etching transaction confirms, the Rune ID will be assigned.

**Rune ID Format:** `<block_height>:<tx_index>`

Example: `2586233:1009`

You can find it on:
- https://mempool.space/testnet/tx/[your_txid]
- Runes explorers (when available for testnet)

---

## Post-Deployment

### Update Application Configuration

1. **Save Rune ID** to environment variables:

```bash
# .env.local
NEXT_PUBLIC_QCT_RUNE_ID=2586233:1009
QCT_RUNE_NAME=QUANTUM•CROSS•CHAIN•TOKEN
```

2. **Update QCT Trading API** (`app/api/qct/trading/route.ts`):

Replace line 125:
```typescript
runesId: 'QCT_RUNES_ID' // TODO: Replace with actual Runes ID
```

With:
```typescript
runesId: process.env.NEXT_PUBLIC_QCT_RUNE_ID || '2586233:1009'
```

3. **Update Runes Balance Checker** (`services/runes/qct.ts` - to be created)

---

## Verification

### Check Deployment Success

1. **Transaction Confirmed:**
   - https://mempool.space/testnet/tx/[txid]

2. **Rune Created:**
   - Look for "Rune Etched" in transaction details
   - Rune ID should be visible

3. **Premine Received:**
   - Check your address for 400M QCT
   - Use Runes balance checker

### Test Minting

Once deployed, anyone can mint QCT:

```typescript
import { Runestone, RuneId } from 'runelib';

const runeId = new RuneId(2586233, 1009); // Your Rune ID
const mintstone = new Runestone(
  [],
  none(),
  some(runeId),
  some(1) // Mint 1 unit (47,619 QCT)
);
```

---

## Troubleshooting

### Error: "BTC_DEPLOYER_KEY environment variable not set"

**Solution:** Set the environment variable:
```bash
export BTC_DEPLOYER_KEY="your_wif_key"
```

### Error: "No UTXO found"

**Solution:** 
1. Send testnet BTC to the deployment address
2. Wait for at least 1 confirmation
3. Script will auto-retry every 10 seconds

### Error: "Broadcast failed: insufficient fee"

**Solution:** 
1. Increase fee in script (line 229)
2. Ensure UTXO has enough value

### Error: "Transaction too large"

**Solution:**
- Rune name too long (max 28 characters)
- Our name "QUANTUM•CROSS•CHAIN•TOKEN" = 26 chars ✅

---

## Distribution Plan

### Premined Tokens (400M QCT - 40%)

| Allocation | Amount | Purpose |
|------------|--------|---------|
| **Liquidity Pools** | 200M QCT | DEX liquidity on EVM chains |
| **Bridge Reserves** | 100M QCT | Cross-chain bridge liquidity |
| **Treasury** | 70M QCT | Development & operations |
| **Team/Advisors** | 30M QCT | 4-year vesting |

### Public Minting (600M QCT - 60%)

- **21,000 mints** available
- **47,619 QCT** per mint
- **Anyone can mint** (first-come, first-served)
- **No time restrictions** (turbo enabled)

---

## Next Steps After Deployment

1. ✅ **Deploy QCT Runes** (this guide)
2. ⏭️ **Create Runes Transfer Utilities**
3. ⏭️ **Deploy QCT ERC20 on EVM chains**
4. ⏭️ **Deploy QCT SPL on Solana**
5. ⏭️ **Build Bridge Contracts**
6. ⏭️ **Integrate with QCT Trading Card**

---

## Resources

- **Runes Protocol Spec:** https://docs.ordinals.com/runes/specification.html
- **runelib Documentation:** https://github.com/sCrypt-Inc/runelib
- **Bitcoin Testnet Explorer:** https://mempool.space/testnet
- **Testnet Faucets:** See Prerequisites section

---

## Support

For issues or questions:
1. Check troubleshooting section
2. Review runelib documentation
3. Test on Bitcoin Testnet first
4. Never use mainnet for testing

---

**🎉 Ready to deploy QCT Runes!**

Run: `npm run deploy:qct-runes`
