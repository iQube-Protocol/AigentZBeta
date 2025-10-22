# FIO Testnet Status & Fallback Behavior

## Current Issue: FIO Testnet Unreliable

**Error:** `Error 500 while fetching https://testnet.fioprotocol.io/v1/chain/register_fio_address`

**Status:** FIO testnet API is currently down or unreliable

**Impact:** Handles cannot be registered on the actual FIO blockchain

---

## Automatic Fallback Mechanism

The application now includes **automatic fallback** when FIO API fails:

### How It Works

1. **Attempt Real Registration**
   - Tries to register handle on FIO blockchain
   - Uses endpoint: `https://testnet.fioprotocol.io/v1/`

2. **On Failure → Fallback Mode**
   - If FIO API returns 500 error or times out
   - Automatically falls back to mock registration
   - Saves persona to database with `fallback_tx_*` transaction ID

3. **User Experience**
   - Persona creation **completes successfully**
   - User can continue using the application
   - Handle is reserved in our database
   - Can be re-registered on blockchain when testnet is back up

---

## Identifying Fallback Registrations

### Transaction ID Prefixes

- **Real Registration:** `FIO1234567890abcdef...` (actual FIO transaction hash)
- **Mock Mode:** `mock_tx_1234567890` (development mode)
- **Fallback Mode:** `fallback_tx_1234567890` (FIO API down)

### Database Query

```sql
SELECT 
  id,
  fio_handle,
  fio_tx_id,
  fio_registration_status,
  fio_registered_at
FROM persona
WHERE fio_tx_id LIKE 'fallback_tx_%';
```

### Server Logs

Look for these messages:

```
[FIO Register] FIO API Error: Error 500 while fetching...
[FIO Register] Falling back to MOCK MODE due to FIO API failure
[FIO Register] Using fallback registration: { txId: 'fallback_tx_...' }
```

---

## Re-registering Handles When Testnet Returns

When FIO testnet is back online, you can re-register fallback handles:

### Option 1: Manual Re-registration Script

```typescript
// scripts/reregister-fallback-handles.ts
import { createClient } from '@supabase/supabase-js';
import { getFIOService } from '@/services/identity/fioService';

async function reregisterFallbackHandles() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Get all fallback registrations
  const { data: personas } = await supabase
    .from('persona')
    .select('*')
    .like('fio_tx_id', 'fallback_tx_%');

  for (const persona of personas || []) {
    try {
      const fioService = getFIOService();
      await fioService.initialize({
        endpoint: process.env.FIO_API_ENDPOINT!,
        chainId: process.env.FIO_CHAIN_ID!,
        privateKey: persona.fio_private_key, // Need to store this
        publicKey: persona.fio_public_key
      });

      const result = await fioService.registerHandle(
        persona.fio_handle,
        persona.fio_public_key
      );

      // Update with real transaction ID
      await supabase
        .from('persona')
        .update({
          fio_tx_id: result.txId,
          fio_registration_status: 'confirmed'
        })
        .eq('id', persona.id);

      console.log(`✅ Re-registered: ${persona.fio_handle}`);
    } catch (error) {
      console.error(`❌ Failed: ${persona.fio_handle}`, error);
    }
  }
}
```

### Option 2: Automatic Retry on Next Login

Add retry logic to persona service:

```typescript
async function checkAndRetryFallbackRegistration(personaId: string) {
  const persona = await getPersona(personaId);
  
  if (persona.fio_tx_id?.startsWith('fallback_tx_')) {
    try {
      // Attempt real registration
      const result = await registerOnFIOBlockchain(persona);
      // Update if successful
      await updatePersonaFIOStatus(personaId, result.txId);
    } catch (error) {
      // Still failing, keep fallback status
      console.log('FIO testnet still unavailable');
    }
  }
}
```

---

## Environment Configuration

### Development (.env.local)

```bash
# Use testnet (currently unreliable)
FIO_MOCK_MODE=false
FIO_API_ENDPOINT=https://testnet.fioprotocol.io/v1/
FIO_CHAIN_ID=b20901380af44ef59c5918439a1f9a41d83669020319a80574b804a5f95cbd7e
```

### Production (Amplify)

```bash
# Use mainnet (requires real FIO tokens)
FIO_MOCK_MODE=false
FIO_API_ENDPOINT=https://fio.eosusa.io/v1/
FIO_CHAIN_ID=21dcae42c0182200e93f954a074011f9048a7624c6fe81d3c9541a614a88bd1c
```

### Development (Force Mock)

```bash
# Skip blockchain entirely
FIO_MOCK_MODE=true
# Endpoints not used in mock mode
```

---

## Alternative FIO Testnet Endpoints

If primary testnet is down, try these alternatives:

```bash
# Primary (currently down)
FIO_API_ENDPOINT=https://testnet.fioprotocol.io/v1/

# Alternatives (may work)
FIO_API_ENDPOINT=https://fiotestnet.blockpane.com/v1/
FIO_API_ENDPOINT=https://fio-test.eosusa.io/v1/
FIO_API_ENDPOINT=https://testnet.fioprotocol.io:443/v1/
```

**Note:** Test each endpoint before using in production.

---

## Monitoring FIO Testnet Status

### Check Testnet Health

```bash
# Test API connectivity
curl https://testnet.fioprotocol.io/v1/chain/get_info

# Should return:
{
  "server_version": "...",
  "chain_id": "b20901380af44ef59c5918439a1f9a41d83669020319a80574b804a5f95cbd7e",
  "head_block_num": 123456,
  ...
}
```

### FIO Testnet Block Explorer

- **URL:** https://fio-test.bloks.io/
- **Use:** Verify if testnet is producing blocks
- **Check:** Search for recent transactions

### FIO Community Resources

- **Discord:** https://discord.gg/fio
- **Telegram:** https://t.me/fiofoundation
- **Status Page:** Check FIO Foundation announcements

---

## Current Recommendation

**For Development:**
- Use `FIO_MOCK_MODE=false` to test real flow
- Accept `fallback_tx_*` registrations as normal
- Handles are still reserved in database
- Can re-register when testnet is back

**For Production:**
- Use FIO mainnet (requires real FIO tokens)
- Or wait for testnet to stabilize
- Or use mock mode for demo purposes

---

## Summary

| Scenario | Transaction ID | Blockchain | Database | User Impact |
|----------|---------------|------------|----------|-------------|
| Real Registration | `FIO123...` | ✅ Registered | ✅ Saved | ✅ Full functionality |
| Mock Mode | `mock_tx_...` | ❌ Not registered | ✅ Saved | ⚠️ Dev only |
| Fallback (API down) | `fallback_tx_...` | ❌ Not registered | ✅ Saved | ⚠️ Can retry later |

**Bottom Line:** Application continues to work even when FIO testnet is down. Handles can be re-registered when service is restored.
