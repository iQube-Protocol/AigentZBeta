# Commit Brief: `ac1608d` — fix: Add private key decryption to A2A transfer and balance checking APIs

| Field | Value |
|-------|-------|
| SHA | [`ac1608d`](https://github.com/iQube-Protocol/AigentZBeta/commit/ac1608dd998da09269558ce9e03edd51b87d47a4) |
| Author | Know1 |
| Date | 2025-10-19T03:12:08Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
fix: Add private key decryption to A2A transfer and balance checking APIs

🚨 CRITICAL PRODUCTION FIX: Encrypted Private Key Support

**Problem**: Production APIs failing because private keys are encrypted in database
- A2A transfers returning 500 errors
- Balance checking APIs showing 'Error' for all chains
- Ops Gas Status card completely broken

**Root Cause**: APIs expecting plain text private keys but database stores encrypted keys

**Solution**:
- Add decryption function to both A2A transfer and balance checking APIs
- Use direct Supabase client to avoid AgentiQBootstrap conflicts
- Properly handle encrypted private keys with AGENT_KEY_ENCRYPTION_SECRET
- Update field references to match database schema (evm_private_key_encrypted)

**APIs Fixed**:
- /api/a2a/signer/transfer - A2A transfers now work
- /api/admin/debug/check-eth-balance - Balance checking now works

This should resolve all 'Error' statuses in Ops Gas Status card and enable A2A transfers.
```

## Files Changed

_File details not available in backfill — see commit link above._
