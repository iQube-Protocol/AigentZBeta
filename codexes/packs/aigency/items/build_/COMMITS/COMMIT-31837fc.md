# Commit Brief: `31837fc` — fix: Revert to proper QubeBase SDK architecture for agent keys

| Field | Value |
|-------|-------|
| SHA | [`31837fc`](https://github.com/iQube-Protocol/AigentZBeta/commit/31837fca8dfa1df975ef209c785faa4371a5ad36) |
| Author | Know1 |
| Date | 2025-10-19T04:55:00Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
fix: Revert to proper QubeBase SDK architecture for agent keys

🏗️ ARCHITECTURAL FIX: Restore Proper SDK Integration

**Problem**: Bypassed QubeBase SDK by using direct environment variables
**Root Cause**: System designed to get Supabase credentials from QubeBase SDK, not env vars
**Evidence**: Local works without SUPABASE_* env vars, registry cards work in production

**Solution**: Revert to AgentKeyService (proper SDK pattern)
- Remove direct Supabase client usage
- Remove manual decryption logic
- Use AgentKeyService which handles QubeBase SDK integration
- Maintain proper separation of concerns

**Key Insight**: Environment variables showed NEXT_PUBLIC_* versions available,
confirming the system uses SDK-managed credentials, not direct env access.

This aligns with the intended architecture where QubeBase SDK manages
all Supabase connections and credential handling.
```

## Files Changed

_File details not available in backfill — see commit link above._
