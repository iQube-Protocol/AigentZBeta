# 🔐 Secure Agent Keys Setup - Complete Guide

**Generated**: October 15, 2025  
**Status**: Ready to Execute

---

## 🔑 Your Master Encryption Key

**CRITICAL: Save this securely! You'll need it for both local and production.**

```bash
AGENT_KEY_ENCRYPTION_SECRET=<REDACTED-2026-07-30-treat-as-compromised-rotate-before-use>
```

**Where to store**:
- ✅ Password manager (1Password, LastPass, etc.)
- ✅ Secure notes
- ✅ Encrypted backup

**Where NOT to store**:
- ❌ Git repository
- ❌ Slack/email
- ❌ Plain text file

---

## 📋 Step-by-Step Migration

### **Step 1: Execute Supabase Migration**

Go to Supabase SQL Editor:
https://supabase.com/dashboard/project/bsjhfvctmduxhohtllly/sql/new

Copy and execute this SQL:

```sql
-- Agent Keys Storage Migration
-- Stores encrypted agent private keys in Supabase

-- Add agent_keys table for secure key storage
create table if not exists public.agent_keys (
  id uuid primary key default gen_random_uuid(),
  agent_id text unique not null,
  agent_name text not null,
  
  -- Encrypted private keys (use pgcrypto or application-level encryption)
  evm_private_key_encrypted text,
  btc_private_key_encrypted text,
  solana_private_key_encrypted text,
  
  -- Public addresses (safe to store unencrypted)
  evm_address text,
  btc_address text,
  solana_address text,
  
  -- Metadata
  key_version int default 1,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  last_used_at timestamptz,
  
  -- Optional: Link to persona if agent has identity
  persona_id uuid references public.persona(id) on delete set null
);

-- Enable RLS
alter table public.agent_keys enable row level security;

-- Policy: Only server-side service role can access agent keys
create policy "agent_keys_service_role_only" on public.agent_keys
  for all using (auth.role() = 'service_role');

-- Function to get agent public addresses (safe to expose)
create or replace function public.get_agent_addresses(p_agent_id text)
returns table (
  agent_id text,
  evm_address text,
  btc_address text,
  solana_address text
) as $$
begin
  return query
  select 
    ak.agent_id,
    ak.evm_address,
    ak.btc_address,
    ak.solana_address
  from public.agent_keys ak
  where ak.agent_id = p_agent_id;
end;
$$ language plpgsql security definer;

-- Grant execute to authenticated users (addresses are public)
grant execute on function public.get_agent_addresses(text) to authenticated;
grant execute on function public.get_agent_addresses(text) to anon;

-- Index for fast lookups
create index if not exists idx_agent_keys_agent_id on public.agent_keys(agent_id);
create index if not exists idx_agent_keys_persona on public.agent_keys(persona_id);

-- Comments
comment on table public.agent_keys is 'Encrypted storage for agent private keys. Access restricted to service role only.';
comment on column public.agent_keys.evm_private_key_encrypted is 'Encrypted EVM private key (use pgp_sym_encrypt or app-level encryption)';
comment on column public.agent_keys.btc_private_key_encrypted is 'Encrypted Bitcoin private key';
comment on column public.agent_keys.solana_private_key_encrypted is 'Encrypted Solana private key';
```

---

### **Step 2: Add Environment Variables**

#### **Local Development** (`.env.local`)

Add this line to `/Users/hal1/CascadeProjects/AigentZBeta/.env.local`:

```bash
# Master encryption key for agent private keys
AGENT_KEY_ENCRYPTION_SECRET=<REDACTED-2026-07-30-treat-as-compromised-rotate-before-use>
```

#### **AWS Amplify** (Production)

1. Go to: https://console.aws.amazon.com/amplify/
2. Select **AigentZBeta** app
3. **App Settings** → **Environment variables**
4. Click **Manage variables**
5. Add:
   ```
   AGENT_KEY_ENCRYPTION_SECRET = <REDACTED-2026-07-30-treat-as-compromised-rotate-before-use>
   ```
6. **Save**

---

### **Step 3: Verify Table Created**

Run in Supabase SQL Editor:

```sql
-- Check table exists
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name = 'agent_keys';

-- Should return 1 row
```

---

### **Step 4: Migrate Existing Keys to Supabase**

I'll create a migration script for you. This will:
1. Read current keys from `agentConfig.ts`
2. Encrypt them
3. Store in Supabase
4. Verify storage

---

## 🧹 Cleanup Tasks

After migration is complete, I will:

1. ✅ Remove hardcoded keys from `app/data/agentConfig.ts`
2. ✅ Remove Supabase fallback credentials from `supabaseServer.ts`
3. ✅ Remove Supabase fallback credentials from `personaService.ts`
4. ✅ Update all services to use `AgentKeyService`
5. ✅ Commit clean code to Git

---

## 🔒 Security Checklist

- [ ] Master encryption key saved securely
- [ ] Encryption key added to `.env.local`
- [ ] Encryption key added to Amplify
- [ ] Supabase migration executed
- [ ] `agent_keys` table verified
- [ ] Keys migrated to Supabase
- [ ] Hardcoded keys removed from code
- [ ] Fallback credentials removed
- [ ] Application tested locally
- [ ] Application tested on Amplify
- [ ] Old keys deleted from Git history (optional)

---

## 📊 Before & After

### **Before** (Insecure)
```typescript
// app/data/agentConfig.ts
walletKeys: {
  evmPrivateKey: "0x1234567890abcdef...",  // ❌ EXPOSED
  btcPrivateKey: "cVN4VvHzRK31...",        // ❌ EXPOSED
  solanaPrivateKey: "5J8QhkrwTZHC...",     // ❌ EXPOSED
}
```

### **After** (Secure)
```typescript
// app/data/agentConfig.ts
// Keys removed - use AgentKeyService instead

// To get keys (server-side only):
const keyService = new AgentKeyService();
const keys = await keyService.getAgentKeys('aigent-z');
const privateKey = keys?.evmPrivateKey;  // ✅ SECURE
```

---

## 🚀 Ready to Proceed?

**Current Status**:
- ✅ Encryption key generated
- ✅ Migration SQL ready
- ✅ AgentKeyService created
- ⏳ Awaiting your confirmation to proceed

**Next Action**: 
Execute the SQL migration in Supabase, then I'll migrate the keys and clean up the code.

---

**Master Encryption Key**: `<REDACTED-2026-07-30-treat-as-compromised-rotate-before-use>`  
**Save this securely!** 🔐
