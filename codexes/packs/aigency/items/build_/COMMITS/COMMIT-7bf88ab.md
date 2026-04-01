# Commit Brief: `7bf88ab` — fix: Disable persona creation when active + better reputation error messages

| Field | Value |
|-------|-------|
| SHA | [`7bf88ab`](https://github.com/iQube-Protocol/AigentZBeta/commit/7bf88ab200fc3b2d9bebf78715a2c6f872b160be) |
| Author | Know1 |
| Date | 2025-10-22T21:32:33Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
fix: Disable persona creation when active + better reputation error messages

UX IMPROVEMENTS:

1. **Disable Create Persona Button** ✅
   - Button disabled when a persona is selected
   - Tooltip explains why it's disabled
   - Prevents sub-persona creation (not allowed)
   - Can still cancel if form is open

2. **Better Reputation Error Messages** ✅
   - Changed 'API error: 404' → 'Reputation not yet initialized'
   - More user-friendly messaging
   - Explains that reputation needs to be activated
   - Consistent with ReputationManager messaging

3. **FIO Registration Debugging** 🔍
   - Added logging to show SDK vs owner public keys
   - Warning when keys don't match
   - Helps diagnose why registration isn't charging wallet

TESTING:
- Select persona → Create button should be disabled
- New persona → Should show 'Reputation not yet initialized' not '404'
- Check console logs for FIO registration details

NOTE: Still investigating why FIO wallet not being charged
System account has 25,000 FIO but registration falling back
```

## Files Changed

_File details not available in backfill — see commit link above._
