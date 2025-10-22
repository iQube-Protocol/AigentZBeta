# Environment Setup Guide

## ⚠️ CRITICAL: .env.local Location

**The `.env.local` file MUST be in the project root directory!**

```
✅ CORRECT:
/Users/hal1/CascadeProjects/AigentZBeta/.env.local

❌ WRONG:
/Users/hal1/Desktop/env.local
/Users/hal1/.env.local
/Users/hal1/CascadeProjects/.env.local
```

### Why This Matters

Next.js only reads environment variables from `.env.local` in the **project root**. If you edit a copy elsewhere, your changes won't take effect!

### How to Verify

```bash
# Navigate to project root
cd /Users/hal1/CascadeProjects/AigentZBeta

# Check if .env.local exists
ls -la .env.local

# View the file
cat .env.local | grep "FIO_MOCK_MODE"
```

---

## Required Environment Variables

### Local Development (.env.local)

```bash
# Supabase - REQUIRED for persona creation
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...  # CRITICAL: Required to bypass RLS

# FIO Protocol - For blockchain handle registration
FIO_MOCK_MODE=false  # Set to false for real blockchain registration
FIO_API_ENDPOINT=https://testnet.fioprotocol.io/v1/
FIO_CHAIN_ID=b20901380af44ef59c5918439a1f9a41d83669020319a80574b804a5f95cbd7e

# ICP Canisters
NEXT_PUBLIC_DVN_CANISTER_ID=sp5ye-2qaaa-aaaao-qkqla-cai
NEXT_PUBLIC_RQH_CANISTER_ID=zdjf3-2qaaa-aaaas-qck4q-cai
```

### Production (Amplify Environment Variables)

**MUST be set in AWS Amplify Console:**

```bash
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...  # CRITICAL!
FIO_MOCK_MODE=false
FIO_API_ENDPOINT=https://fio.eosusa.io/v1/  # Mainnet for production
FIO_CHAIN_ID=21dcae42c0182200e93f954a074011f9048a7624c6fe81d3c9541a614a88bd1c
```

---

## Common Issues

### 1. Changes Not Taking Effect

**Symptom:** You edit .env.local but nothing changes

**Cause:** Editing wrong file (e.g., Desktop copy)

**Solution:**
```bash
# 1. Delete any copies outside project root
rm ~/Desktop/env.local

# 2. Edit the correct file
cd /Users/hal1/CascadeProjects/AigentZBeta
nano .env.local  # or use your editor

# 3. Restart dev server
npm run dev
```

### 2. RLS Policy Error in Production

**Error:** `Database permission error. Please contact support.`

**Cause:** `SUPABASE_SERVICE_ROLE_KEY` not set in Amplify

**Solution:**
1. Go to AWS Amplify Console
2. Select your app → Environment variables
3. Add `SUPABASE_SERVICE_ROLE_KEY` with value from Supabase
4. Redeploy

### 3. FIO Handle Not on Blockchain

**Symptom:** Handle registers but doesn't appear on FIO explorer

**Cause:** `FIO_MOCK_MODE=true`

**Solution:**
```bash
# In .env.local
FIO_MOCK_MODE=false

# Restart dev server
npm run dev
```

---

## Verification Checklist

Before starting development:

- [ ] `.env.local` is in project root (`/Users/hal1/CascadeProjects/AigentZBeta/`)
- [ ] No copies of `.env.local` on Desktop or elsewhere
- [ ] `SUPABASE_SERVICE_ROLE_KEY` is set
- [ ] `FIO_MOCK_MODE=false` for real blockchain registration
- [ ] Dev server restarted after changes
- [ ] Production environment variables set in Amplify

---

## Quick Commands

```bash
# Check current environment
cd /Users/hal1/CascadeProjects/AigentZBeta
cat .env.local | grep -E "FIO_MOCK|SUPABASE_SERVICE"

# Find any stray .env files
find ~ -name ".env.local" -o -name "env.local" 2>/dev/null

# Restart dev server
npm run dev
```

---

## Security Notes

1. **Never commit `.env.local` to git** (it's in `.gitignore`)
2. **Never share SERVICE_ROLE_KEY publicly** (it bypasses all security)
3. **Use different keys for dev/prod** (separate Supabase projects)
4. **Rotate keys if exposed** (regenerate in Supabase dashboard)

---

## Support

If environment issues persist:
1. Verify file location: `pwd` should show project root
2. Check file permissions: `ls -la .env.local`
3. View actual values: `cat .env.local`
4. Restart dev server: `npm run dev`
5. Clear Next.js cache: `rm -rf .next`
