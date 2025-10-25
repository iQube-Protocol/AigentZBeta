# Register FIO Domains on Testnet

## Quick Start

### 1. Get Testnet Tokens

Your system account needs ~2,400 FIO tokens (800 FIO per domain × 3 domains)

**Get tokens from faucet:**
```
https://faucet.fioprotocol.io/?publickey=FIO7Jpu6RnKt6URTaQfXfdzZBFtoXdbXuQMiVPVyrM913ES6wzFvo
```

**Check balance:**
```bash
curl -s -X POST https://testnet.fioprotocol.io/v1/chain/get_fio_balance \
  -d '{"fio_public_key":"FIO7Jpu6RnKt6URTaQfXfdzZBFtoXdbXuQMiVPVyrM913ES6wzFvo"}' \
  -H "Content-Type: application/json"
```

### 2. Run Registration Script

```bash
npx tsx scripts/register-fio-domains.ts
```

### 3. Wait for Confirmation

Wait ~30 seconds for blockchain confirmation

### 4. Verify Domains

Check on testnet explorer:
- https://fio-test.bloks.io/account/knyt
- https://fio-test.bloks.io/account/aigent
- https://fio-test.bloks.io/account/qripto

### 5. Update Domain List

After successful registration, update the valid domains list:

**File:** `components/identity/FIOHandleInput.tsx`

```typescript
// Valid FIO testnet domains
const VALID_TESTNET_DOMAINS = [
  'fiotestnet', 
  'dapixdev', 
  'edge', 
  'aigent',
  'knyt',      // ← Add this
  'qripto'     // ← Add this
];
```

---

## What the Script Does

1. **Checks domain availability** - Verifies domains aren't already registered
2. **Gets registration fee** - Queries current fee (~800 FIO per domain)
3. **Registers domains** - Submits transactions to blockchain
4. **Provides transaction IDs** - For verification on explorer

---

## Costs

| Item | Cost (Testnet) | Cost (Mainnet) |
|------|----------------|----------------|
| Domain registration | ~800 FIO | ~800 FIO (~$800) |
| Total for 3 domains | ~2,400 FIO | ~2,400 FIO (~$2,400) |

**Note:** Testnet FIO tokens are free from faucet!

---

## Troubleshooting

### "Insufficient balance"

**Solution:** Get more tokens from faucet
```
https://faucet.fioprotocol.io/?publickey=YOUR_PUBLIC_KEY
```

### "Domain already registered"

**Check who owns it:**
```bash
curl -X POST https://testnet.fioprotocol.io/v1/chain/avail_check \
  -d '{"fio_name":"knyt"}'
```

**If you own it:** Skip to step 5 (update domain list)

### "Transaction failed"

**Check account balance:**
```bash
curl -s -X POST https://testnet.fioprotocol.io/v1/chain/get_fio_balance \
  -d '{"fio_public_key":"YOUR_PUBLIC_KEY"}'
```

**Check testnet status:**
```bash
curl -s https://testnet.fioprotocol.io/v1/chain/get_info
```

---

## After Registration

### Update Valid Domains

```typescript
// components/identity/FIOHandleInput.tsx
const VALID_TESTNET_DOMAINS = [
  'fiotestnet',
  'dapixdev',
  'edge',
  'aigent',
  'knyt',      // ✅ Now available
  'qripto'     // ✅ Now available
];
```

### Test Handle Registration

Try creating a persona with:
- `alice@knyt`
- `bob@aigent`
- `charlie@qripto`

---

## Production (Mainnet)

### When ready for production:

1. **Get mainnet FIO tokens** (~$2,400 worth)
2. **Update endpoints** in `.env`:
   ```bash
   FIO_API_ENDPOINT=https://fio.greymass.com/v1/
   FIO_CHAIN_ID=21dcae42c0182200e93f954a074011f9048a7624c6fe81d3c9541a614a88bd1c
   ```
3. **Run script** with mainnet config
4. **Update app** to use mainnet

---

## Domain Management

### Check domain info:
```bash
curl -X POST https://testnet.fioprotocol.io/v1/chain/get_fio_domains \
  -d '{"fio_public_key":"YOUR_PUBLIC_KEY"}'
```

### Renew domain (annually):
```typescript
await sdk.renewFioDomain(domain, fee);
```

### Transfer domain:
```typescript
await sdk.transferFioDomain(domain, newOwnerKey, fee);
```

---

## Summary

**Before:**
- ❌ Only @fiotestnet, @dapixdev, @edge available
- ❌ Generic domain names

**After:**
- ✅ @knyt, @aigent, @qripto available
- ✅ Custom branded domains
- ✅ Professional handles (alice@knyt)

**Cost:** Free on testnet (faucet tokens)
**Time:** ~5 minutes + 30 seconds confirmation
**Benefit:** Custom branded FIO handles! 🎉
