# Commit Brief: `348fc88` — fix: amplify env injection + paypal runtime dotenv + qc cors + ghostscript

| Field | Value |
|-------|-------|
| SHA | [`348fc88`](https://github.com/iQube-Protocol/AigentZBeta/commit/348fc887d96cb129f0714f1f67f684c1cfdcd190) |
| Author | Kn0w-1 |
| Date | 2025-12-26T19:12:03Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
fix: amplify env injection + paypal runtime dotenv + qc cors + ghostscript

- Replace indented heredoc with env|grep pattern (AWS recommended)
- Patch standalone server.js to load dotenv at runtime
- Add Ghostscript installation via dnf/yum
- Fix Base Q¢ CORS with reflected origin and credentials
- Harden PayPal service with trim() and clear error messages
- Remove compute: block (AWS recommends .env.production injection)

Fixes all 3 production blockers:
1. PayPal 401 invalid_client (env vars now accessible at runtime)
2. Base Q¢ CORS blocking (proper headers on all responses)
3. Ghostscript missing (installed in preBuild phase)
```

## Files Changed

_File details not available in backfill — see commit link above._
