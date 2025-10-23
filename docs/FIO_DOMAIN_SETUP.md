# FIO Domain Setup Guide

## The Problem

**Error:** `FIO Domain not registered`

**Cause:** You're trying to register a FIO handle with a domain that doesn't exist on the blockchain.

Example: `test29@knyt` fails because `@knyt` domain is not registered.

---

## Solution 1: Use Existing Testnet Domains

### Valid FIO Testnet Domains:
- `@fiotestnet` (public, free)
- `@dapixdev` (public, free)
- `@edge` (public, free)

### Example Valid Handles:
```
alice@fiotestnet
bob@dapixdev
charlie@edge
test29@fiotestnet  ← Use this instead of test29@knyt
```

---

## Solution 2: Register Your Own Domain

### Cost:
- **Testnet:** Free (use faucet)
- **Mainnet:** ~800 FIO tokens (~$800 USD)

### Steps to Register `@knyt` Domain:

#### 1. Get FIO Tokens
```bash
# Testnet: Use faucet
https://faucet.fioprotocol.io/?publickey=FIO7Jpu6RnKt6URTaQfXfdzZBFtoXdbXuQMiVPVyrM913ES6wzFvo

# Wait 1-2 minutes for tokens
```

#### 2. Register Domain via FIO SDK
```typescript
// services/identity/fioService.ts

async registerDomain(domain: string): Promise<string> {
  if (!this.sdk) {
    throw new Error('FIO SDK not initialized');
  }

  try {
    // Get domain registration fee
    const fee = await this.sdk.getFee('register_fio_domain');
    
    // Register domain
    const result = await this.sdk.registerFioDomain(
      domain,  // e.g., 'knyt'
      fee.fee
    );

    console.log('Domain registered:', result);
    return result.transaction_id;
  } catch (error: any) {
    console.error('Domain registration error:', error);
    throw error;
  }
}
```

#### 3. Call Registration
```typescript
// One-time setup
const fioService = getFIOService();
await fioService.initialize({
  endpoint: 'https://testnet.fioprotocol.io/v1/',
  chainId: 'b20901380af44ef59c5918439a1f9a41d83669020319a80574b804a5f95cbd7e',
  privateKey: process.env.FIO_SYSTEM_PRIVATE_KEY!,
  publicKey: process.env.FIO_SYSTEM_PUBLIC_KEY!
});

// Register domain
const txId = await fioService.registerDomain('knyt');
console.log('Domain registered with tx:', txId);
```

#### 4. Wait for Confirmation
- Testnet: ~30 seconds
- Mainnet: ~30 seconds

#### 5. Verify Domain
```bash
curl -X POST https://testnet.fioprotocol.io/v1/chain/avail_check \
  -d '{"fio_name":"knyt"}'

# Should return: {"is_registered": 1}
```

---

## Quick Fix: Update Handle Input

### Current:
```typescript
// User enters: test29@knyt
// Error: Domain not registered
```

### Fixed:
```typescript
// User enters: test29@fiotestnet
// Success: Domain exists!
```

---

## Implementation: Add Domain Validation

### Update FIOHandleInput Component:

```typescript
// components/identity/FIOHandleInput.tsx

const VALID_TESTNET_DOMAINS = ['fiotestnet', 'dapixdev', 'edge'];

const validateHandle = (handle: string) => {
  const parts = handle.split('@');
  if (parts.length !== 2) {
    return { valid: false, error: 'Handle must be username@domain' };
  }
  
  const [username, domain] = parts;
  
  // Check if domain is valid for testnet
  if (!VALID_TESTNET_DOMAINS.includes(domain)) {
    return {
      valid: false,
      error: `Domain @${domain} not registered. Use @fiotestnet, @dapixdev, or @edge`
    };
  }
  
  return { valid: true };
};
```

---

## Recommended Approach

### For Testing (Now):
**Use existing testnet domains:**
- `alice@fiotestnet`
- `bob@dapixdev`
- `charlie@edge`

### For Production (Later):
**Register your own domain:**
1. Register `@knyt` domain on mainnet
2. Pay ~800 FIO tokens
3. Users can register `username@knyt`

---

## Environment Variables

### Current Setup:
```bash
# .env.local
FIO_SYSTEM_PRIVATE_KEY=5KKQyWkP8hh97VYu8fJnxYXYXThDpibj9saMQP9TV6DxwnwzB18
FIO_SYSTEM_PUBLIC_KEY=FIO7Jpu6RnKt6URTaQfXfdzZBFtoXdbXuQMiVPVyrM913ES6wzFvo
FIO_API_ENDPOINT=https://testnet.fioprotocol.io/v1/
FIO_CHAIN_ID=b20901380af44ef59c5918439a1f9a41d83669020319a80574b804a5f95cbd7e
```

### Add Domain:
```bash
# If you want to use @knyt
FIO_CUSTOM_DOMAIN=knyt
```

---

## Summary

| Issue | Cause | Solution |
|-------|-------|----------|
| `FIO Domain not registered` | `@knyt` doesn't exist | Use `@fiotestnet` instead |
| Want custom domain | Need to register | Register `@knyt` on blockchain |
| Testing quickly | Don't want to register | Use existing testnet domains |

**Quick Fix:** Change `test29@knyt` → `test29@fiotestnet` ✅
