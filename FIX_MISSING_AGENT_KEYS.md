# Fix: Agent Private Key Not Found

## 🐛 Problem
When trying to send QCT from agents in production, you get:
```
❌ Agent private key not found
```

## 🔍 Root Cause
The agent keys migration was run locally, but **aigent-nakamoto** and **aigent-kn0w1** were never added to the database.

**Current Status:**
- ✅ aigent-z - Keys found
- ✅ aigent-x - Keys found  
- ✅ aigent-y - Keys found
- ❌ aigent-nakamoto - **MISSING**
- ❌ aigent-kn0w1 - **MISSING**

---

## ✅ Solution: Add Missing Agent Keys

### Option 1: If You Have the Private Keys

If you have the private keys for these agents, run:

```bash
cd /Users/hal1/CascadeProjects/AigentZBeta

SUPABASE_URL=https://bsjhfvctmduxhohtllly.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=<REDACTED-2026-07-30-treat-as-compromised-see-rotation-notice> \
AGENT_KEY_ENCRYPTION_SECRET=<REDACTED-2026-07-30-treat-as-compromised-rotate-before-use> \
NAKAMOTO_PRIVATE_KEY=0xYOUR_NAKAMOTO_PRIVATE_KEY_HERE \
KN0W1_PRIVATE_KEY=0xYOUR_KN0W1_PRIVATE_KEY_HERE \
npx tsx scripts/add-missing-agents.ts
```

### Option 2: Generate New Private Keys

If you don't have the keys or want to generate new ones:

```bash
# Generate new Ethereum private keys
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

This will output a 64-character hex string. Add `0x` prefix to use as private key.

Then run the script from Option 1 with the new keys.

### Option 3: Use Existing Agent Keys

If you just want to test, you can use aigent-z's credentials for all agents (not recommended for production):

```bash
# Just use aigent-z for testing
# Update agentConfig.ts to remove aigent-nakamoto and aigent-kn0w1
```

---

## 🔍 Verify Keys After Adding

```bash
SUPABASE_URL=https://bsjhfvctmduxhohtllly.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=<REDACTED-2026-07-30-treat-as-compromised-see-rotation-notice> \
AGENT_KEY_ENCRYPTION_SECRET=<REDACTED-2026-07-30-treat-as-compromised-rotate-before-use> \
npx tsx scripts/verify-agent-keys.ts
```

You should see:
```
✅ Keys found for all agents
```

---

## 📋 What Happened?

1. **Initial migration** only migrated aigent-z, aigent-x, and aigent-y
2. **aigent-nakamoto** and **aigent-kn0w1** were added to `agentConfig.ts` later
3. Their private keys were never migrated to Supabase
4. When you try to transfer from these agents, the app can't find their keys

---

## 🎯 Next Steps

After adding the missing keys:

1. ✅ Verify all keys exist (run verify script)
2. ✅ Test agent-to-agent transfer in production
3. ✅ Confirm no more "Agent private key not found" errors

---

## ⚠️ Important Notes

- **Private keys are encrypted** in Supabase using AES-256
- **Only server-side code** can decrypt them
- **Never commit** private keys to git
- **Keep the encryption key** (`AGENT_KEY_ENCRYPTION_SECRET`) secure
