# Commit Brief: `8996cae` — fix: Align Payment Service with intended QubeBase architecture

| Field | Value |
|-------|-------|
| SHA | [`8996cae`](https://github.com/iQube-Protocol/AigentZBeta/commit/8996cae017dfd76e3c18062db158e2352720e29e) |
| Author | Know1 |
| Date | 2025-10-19T06:17:03Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
fix: Align Payment Service with intended QubeBase architecture

🏗️ ARCHITECTURAL ALIGNMENT: Proper Environment Variable Priority

**Root Cause**: Payment and Registry services had opposite priority orders
- Payment: SUPABASE_URL || NEXT_PUBLIC_SUPABASE_URL (server-first)
- Registry: NEXT_PUBLIC_SUPABASE_URL || SUPABASE_URL (public-first)

**Intended Architecture**:
NEXT_PUBLIC_SUPABASE_URL (public connection) → Encrypted database storage
→ Server-side decryption → Secure key delivery

**Fix**: Standardize Payment Service to use NEXT_PUBLIC_ first
- Aligns with security model: public URL, encrypted storage
- Matches Registry pattern that works in production
- Maintains server-side decryption for sensitive operations

**Changes**:
- Update createPaymentService() priority order
- Switch APIs to AgentKeyServiceV2 (UniversalQubeService)
- Consistent SDK architecture across all services

This should resolve both local registry 401s and production balance failures.
```

## Files Changed

_File details not available in backfill — see commit link above._
