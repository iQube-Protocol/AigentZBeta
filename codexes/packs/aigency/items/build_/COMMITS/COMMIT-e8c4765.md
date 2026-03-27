# Commit Brief: `e8c4765` — fix: Restore working balance checking pattern with correct env priority

| Field | Value |
|-------|-------|
| SHA | [`e8c4765`](https://github.com/iQube-Protocol/AigentZBeta/commit/e8c476588e9407e3302b57812098784d06847eb4) |
| Author | Know1 |
| Date | 2025-10-19T06:55:38Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
fix: Restore working balance checking pattern with correct env priority

🔧 RESTORE WORKING PATTERN: Direct Supabase + Correct Priority

**Issue**: Switching to AgentKeyServiceV2 broke the 3/5 working balances
**Root Cause**: UniversalQubeService might have initialization issues

**Solution**: Restore the direct Supabase client pattern that was working
- Keep the decrypt function and direct database access
- Use correct NEXT_PUBLIC_ first priority order
- Maintain the working architecture from commit 31837fc

**Key Changes**:
- Revert from AgentKeyServiceV2 to direct createClient approach
- Environment priority: NEXT_PUBLIC_* || server-side (aligned with architecture)
- Keep manual decryption logic that was proven to work

This should restore the 3/5 → 5/5 balance display functionality.
```

## Files Changed

_File details not available in backfill — see commit link above._
