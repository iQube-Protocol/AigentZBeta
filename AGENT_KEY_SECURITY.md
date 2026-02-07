# Agent Key Security Architecture

## 🚨 Current Problem

**Agent private keys are hardcoded in application code**:
- Location: `app/data/agentConfig.ts`
- Exposed in Git repository
- Visible in client-side bundles
- Cannot be rotated easily
- Not encrypted

---

## ✅ Proper Architecture

### **Key Storage Hierarchy**

```
┌─────────────────────────────────────────────────────────┐
│ Level 1: Infrastructure Keys (Environment Variables)    │
│                                                          │
│ ✅ SUPABASE_URL                                          │
│ ✅ SUPABASE_ANON_KEY                                     │
│ ✅ SUPABASE_SERVICE_ROLE_KEY                             │
│ ✅ AGENT_KEY_ENCRYPTION_SECRET                           │
│                                                          │
│ Purpose: Connect to services                            │
│ Storage: .env.local / Amplify Env Vars                  │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│ Level 2: Agent Keys (Encrypted in Supabase)            │
│                                                          │
│ ✅ Agent EVM private keys (encrypted)                   │
│ ✅ Agent BTC private keys (encrypted)                   │
│ ✅ Agent Solana private keys (encrypted)                │
│                                                          │
│ Purpose: Agent wallet operations                        │
│ Storage: Supabase agent_keys table                      │
│ Access: Server-side only via AgentKeyService            │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│ Level 3: IC Canister Keys (Threshold ECDSA)            │
│                                                          │
│ ✅ BTC signer keys (never leave canister)              │
│ ✅ Cross-chain signing keys                             │
│                                                          │
│ Purpose: High-security operations                       │
│ Storage: IC canister secure memory                      │
│ Access: Via canister API only                           │
└─────────────────────────────────────────────────────────┘
```

---

## 📋 Migration Steps

### **Step 1: Execute Supabase Migration**

```bash
cd /Users/hal1/CascadeProjects/QubeBase

# Execute migration
supabase db push

# Or via SQL Editor:
# Copy contents of supabase/migrations/20251015_agent_keys.sql
```

### **Step 2: Add Encryption Key to Environment**

```bash
# Generate a secure 32-byte key
openssl rand -hex 32

# Add to .env.local
AGENT_KEY_ENCRYPTION_SECRET=your-32-byte-hex-key-here

# Add to Amplify Environment Variables
```

### **Step 3: Migrate Existing Keys**

Create a migration script:

```typescript
// scripts/migrate-agent-keys.ts
import { AgentKeyService } from '../services/identity/agentKeyService';
import { agentConfigs } from '../app/data/agentConfig';

async function migrateKeys() {
  const keyService = new AgentKeyService();
  
  for (const [agentId, config] of Object.entries(agentConfigs)) {
    await keyService.storeAgentKeys({
      agentId: config.id,
      agentName: config.name,
      evmPrivateKey: config.walletKeys.evmPrivateKey,
      btcPrivateKey: config.walletKeys.btcPrivateKey,
      solanaPrivateKey: config.walletKeys.solanaPrivateKey,
      evmAddress: config.walletKeys.evmAddress,
      btcAddress: config.walletKeys.btcAddress,
      solanaAddress: config.walletKeys.solanaAddress
    });
    
    console.log(`✅ Migrated keys for ${config.name}`);
  }
}

migrateKeys().catch(console.error);
```

### **Step 4: Update Application Code**

Replace hardcoded keys with service calls:

```typescript
// Before (INSECURE)
const privateKey = agentConfigs['aigent-z'].walletKeys.evmPrivateKey;

// After (SECURE)
const keyService = new AgentKeyService();
const keys = await keyService.getAgentKeys('aigent-z');
const privateKey = keys?.evmPrivateKey;
```

### **Step 5: Remove Hardcoded Keys**

After migration, remove sensitive data from `agentConfig.ts`:

```typescript
// Keep only public data
export const agentConfigs: Record<string, AgentConfig> = {
  "aigent-z": {
    id: "aigent-z",
    name: "Aigent Z",
    fioId: "z@aigent",
    color: "blue",
    // Remove walletKeys - fetch from AgentKeyService instead
    supportedChains: {
      ethereum: true,
      arbitrum: true,
      base: true,
      optimism: true,
      polygon: true,
      bitcoin: true,
      solana: true
    }
  }
};
```

---

## 🔒 Security Best Practices

### **✅ DO**

1. **Store keys encrypted in Supabase**
   - Use `AgentKeyService` for all key operations
   - Keys are encrypted at rest

2. **Use environment variables for encryption keys**
   - `AGENT_KEY_ENCRYPTION_SECRET` in `.env.local`
   - Different keys per environment

3. **Server-side only access**
   - Never expose private keys to client
   - Use API routes for signing operations

4. **Rotate keys regularly**
   - Use `AgentKeyService.rotateKeys()`
   - Keep audit trail

5. **Use IC canisters for high-value operations**
   - Threshold ECDSA for critical transactions
   - Keys never leave canister

### **❌ DON'T**

1. **Never hardcode private keys in code**
   - Not in `agentConfig.ts`
   - Not in any source file

2. **Never commit keys to Git**
   - Use `.gitignore` for `.env.local`
   - Scan for leaked keys

3. **Never send keys to client**
   - No private keys in API responses
   - No keys in client-side state

4. **Never log private keys**
   - Redact from logs
   - Use `[REDACTED]` in debug output

---

## 🎯 Architecture Comparison

### **Current (Insecure)**
```
agentConfig.ts (hardcoded keys)
  ↓
Git Repository (exposed)
  ↓
Client Bundle (visible to users)
  ↓
🚨 SECURITY RISK
```

### **Proposed (Secure)**
```
Environment Variables (AGENT_KEY_ENCRYPTION_SECRET)
  ↓
Supabase (encrypted keys in agent_keys table)
  ↓
AgentKeyService (server-side decryption)
  ↓
API Routes (signing operations)
  ↓
✅ SECURE
```

---

## 📊 Key Types & Storage

| Key Type | Current Storage | Proposed Storage | Access Level |
|----------|----------------|------------------|--------------|
| Supabase URL | ✅ Env Vars | ✅ Env Vars | Public |
| Supabase Anon Key | ✅ Env Vars | ✅ Env Vars | Public (RLS protected) |
| Supabase Service Key | ✅ Env Vars | ✅ Env Vars | Server-only |
| Agent EVM Keys | ❌ Hardcoded | ✅ Supabase (encrypted) | Server-only |
| Agent BTC Keys | ❌ Hardcoded | ✅ Supabase (encrypted) | Server-only |
| Agent Solana Keys | ❌ Hardcoded | ✅ Supabase (encrypted) | Server-only |
| IC Canister Keys | ✅ IC Canister | ✅ IC Canister | Canister-only |

---

## 🚀 Implementation Checklist

- [ ] Execute `20251015_agent_keys.sql` migration in Supabase
- [ ] Generate and add `AGENT_KEY_ENCRYPTION_SECRET` to env vars
- [ ] Run migration script to move keys to Supabase
- [ ] Update application code to use `AgentKeyService`
- [ ] Remove hardcoded keys from `agentConfig.ts`
- [ ] Test key retrieval and signing operations
- [ ] Deploy to staging and verify
- [ ] Deploy to production
- [ ] Delete old keys from Git history (if needed)

---

## 📚 Related Files

- **Migration**: `QubeBase/supabase/migrations/20251015_agent_keys.sql`
- **Service**: `services/identity/agentKeyService.ts`
- **Config**: `app/data/agentConfig.ts` (to be updated)
- **Env Setup**: `ENV_SETUP.md`

---

**Status**: 🟡 Migration ready, not yet executed  
**Priority**: 🔴 High - Security issue  
**Effort**: ~2 hours to migrate and test
