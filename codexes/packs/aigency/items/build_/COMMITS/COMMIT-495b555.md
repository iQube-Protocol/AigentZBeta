# Commit Brief: `495b555` — CRITICAL FIX: Revenue-blocking payment issues

| Field | Value |
|-------|-------|
| SHA | [`495b555`](https://github.com/iQube-Protocol/AigentZBeta/commit/495b55556c327160c2b95d4647b748b9a919386f) |
| Author | Kn0w-1 |
| Date | 2025-12-25T23:51:00Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
CRITICAL FIX: Revenue-blocking payment issues

- Fixed Q¢ purchase API URL (VITE_AIGENT_API_URL -> VITE_API_URL)
- Created retroactive signup bonus script for existing personas
- PayPal auth error requires credential verification in Amplify Console

Issues fixed:
1. Q¢ purchase 400 error - wrong API URL prevented personaId/packageId from reaching backend
2. Base Q¢ not showing for existing personas - need to run retroactive bonus script
3. PayPal invalid_client - credentials mismatch (sandbox vs live mode)
```

## Files Changed

_File details not available in backfill — see commit link above._
