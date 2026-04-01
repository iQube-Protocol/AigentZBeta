# Commit Brief: `832a880` — fix: Use system account to pay for FIO registration + Persona ID documentation

| Field | Value |
|-------|-------|
| SHA | [`832a880`](https://github.com/iQube-Protocol/AigentZBeta/commit/832a880703073337effd0a3d96a2b42899c93a37) |
| Author | Know1 |
| Date | 2025-10-22T20:57:44Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
fix: Use system account to pay for FIO registration + Persona ID documentation

CRITICAL FIX - FIO REGISTRATION:

1. **Root Cause Found** 🔍
   - System account has 25,000 FIO tokens ✅
   - BUT we were using user's keys (0 balance) ❌
   - Registration failed due to insufficient funds

2. **Fix Applied** ✅
   - Now uses FIO_SYSTEM_PRIVATE_KEY to pay fees
   - System account (FIO7Jpu6...) pays 40 FIO
   - User's public key becomes the owner
   - User gets full control of handle

3. **How It Works Now** 🔄
   System Account → Pays Registration Fee (40 FIO)
   User's Public Key → Becomes Handle Owner
   Result → Handle registered on blockchain!

PERSONA ID DOCUMENTATION:

4. **Identity Architecture Explained** 📋
   - Persona ID = UUID (database, NOT blockchain)
   - FIO Handle = Blockchain identity (test21@knyt)
   - FIO Public Key = Cryptographic owner (FIO7Jpu6...)

5. **Why Persona ID Not on FIO Explorer** ✅
   - It's a system identifier (like user ID)
   - Lives in PostgreSQL, not blockchain
   - Links persona to reputation/transactions
   - Enables multiple personas per user

6. **DIDQube Perspective** 🆔
   - Persona ID = did:qube:... (local)
   - FIO Handle = did:fio:... (blockchain)
   - FIO Public Key = Verification method
   - Complete DID Document mapping provided

FILES:
- app/api/identity/persona/create-with-fio/route.ts (FIXED)
- docs/PERSONA_ID_EXPLAINED.md (NEW)
- docs/FIO_REGISTRATION_ISSUE.md (previous)

TESTING:
- Create new persona
- Should register on blockchain with REAL tx ID
- Check FIO explorer for handle
- System account balance will decrease by 40 FIO
```

## Files Changed

_File details not available in backfill — see commit link above._
