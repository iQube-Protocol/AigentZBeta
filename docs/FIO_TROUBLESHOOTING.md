# FIO Handle Registration Troubleshooting

## Common Issues and Solutions

### 1. Handle Not Appearing on FIO Blockchain Explorer

**Symptom:** Handle registers successfully in the app but doesn't appear on https://fio.blocks.io/

**Cause:** `FIO_MOCK_MODE=true` in environment variables

**Solution:**
```bash
# In .env.local, set:
FIO_MOCK_MODE=false

# OR remove the line entirely (defaults to false)
```

**To Verify:**
- Check server logs for: `[FIO Register] MOCK MODE` vs `[FIO Register] REAL MODE`
- Mock mode will show `mock_tx_` transaction IDs
- Real mode will show actual FIO transaction hashes

---

### 2. RLS Policy Error (Production)

**Error:** `new row violates row-level security policy for table "persona"`

**Cause:** Missing `SUPABASE_SERVICE_ROLE_KEY` in production environment variables

**Solution:**
1. Go to Amplify Console → Environment Variables
2. Add: `SUPABASE_SERVICE_ROLE_KEY` = `[your service role key from Supabase]`
3. Redeploy the application

**To Verify:**
- Check server logs for: `[Persona API] WARNING: SUPABASE_SERVICE_ROLE_KEY not set!`
- If you see this warning, the key is missing

---

### 3. Entity Type Validation Error

**Error:** `new row for relation "persona" violates check constraint "persona_world_id_status_check"`

**Cause:** Entity Type (Human/AI Agent) not selected in form

**User-Friendly Error:** "Please select whether this persona represents a Verified Human or AI Agent"

**Solution:**
- Always select an Entity Type before creating persona
- Default is "Not Verified" but must be explicitly selected

---

### 4. 404 Error After Persona Creation

**Error:** `API error: 404` when fetching created persona

**Cause:** Missing `/api/identity/persona/[id]` endpoint

**Solution:** Already fixed in commit `ac6c9b7`

---

## Environment Variable Checklist

### Local Development (.env.local)

```bash
# For REAL FIO registration (testnet):
FIO_MOCK_MODE=false
FIO_API_ENDPOINT=https://testnet.fioprotocol.io/v1/
FIO_CHAIN_ID=b20901380af44ef59c5918439a1f9a41d83669020319a80574b804a5f95cbd7e

# For MOCK registration (no blockchain):
FIO_MOCK_MODE=true

# Required for persona creation:
SUPABASE_SERVICE_ROLE_KEY=[your-service-role-key]
```

### Production (Amplify Environment Variables)

```bash
# REQUIRED:
SUPABASE_SERVICE_ROLE_KEY=[your-service-role-key]
FIO_API_ENDPOINT=https://fio.eosusa.io/v1/
FIO_CHAIN_ID=21dcae42c0182200e93f954a074011f9048a7624c6fe81d3c9541a614a88bd1c

# OPTIONAL (defaults to false):
FIO_MOCK_MODE=false
```

---

## Debugging Steps

### 1. Check Server Logs

Look for these log messages:

```
[FIO Register] Starting registration: { handle, mockMode, ... }
[FIO Register] MOCK MODE: Simulating registration
  OR
[FIO Register] REAL MODE: Registering on FIO blockchain
[FIO Register] Registration successful: { txId, fioAddress, fee }
```

### 2. Verify Transaction on Blockchain

**Testnet:**
- Explorer: https://fio-test.bloks.io/
- Search for your handle (e.g., `test4@knyt`)

**Mainnet:**
- Explorer: https://fio.blocks.io/
- Search for your handle

### 3. Check Persona in Database

```sql
SELECT 
  id, 
  fio_handle, 
  fio_tx_id, 
  fio_registration_status,
  world_id_status
FROM persona 
WHERE fio_handle = 'your-handle@domain';
```

---

## Quick Fixes

### Enable Real FIO Registration (Local)

```bash
# 1. Edit .env.local
FIO_MOCK_MODE=false

# 2. Restart dev server
npm run dev

# 3. Try registering a new handle
```

### Fix Production RLS Error

```bash
# 1. Add to Amplify Environment Variables:
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...your-key

# 2. Trigger redeploy:
git commit --allow-empty -m "chore: trigger redeploy"
git push origin dev

# 3. Wait for Amplify build (~5-7 min)
```

---

## Testing Checklist

- [ ] Handle appears in persona selector dropdown
- [ ] Handle appears on FIO blockchain explorer
- [ ] Transaction ID is not `mock_tx_*`
- [ ] No RLS policy errors
- [ ] Entity Type validation works
- [ ] User-friendly error messages display
- [ ] Persona fetches without 404 error

---

## Support

If issues persist:
1. Check server logs for detailed error messages
2. Verify all environment variables are set correctly
3. Ensure FIO testnet/mainnet is accessible
4. Check Supabase RLS policies are configured correctly
