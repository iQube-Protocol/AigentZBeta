# Commit Brief: `59aa70c` — fix(a2a): bake AGENT_KEY_ENCRYPTION_SECRET into build and expose diagnostics\n\n- Add AGENT_KEY_ENCRYPTION_SECRET to .env.production in amplify.yml\n- Add hasEncryptionSecret flag to /api/test diagnostics\n\nThis should fix 500s in A2A and gas card by enabling key decryption in production

| Field | Value |
|-------|-------|
| SHA | [`59aa70c`](https://github.com/iQube-Protocol/AigentZBeta/commit/59aa70c7bf2f7dedb1775755ce09eff03b139de0) |
| Author | Know1 |
| Date | 2025-10-23T22:03:41Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
fix(a2a): bake AGENT_KEY_ENCRYPTION_SECRET into build and expose diagnostics\n\n- Add AGENT_KEY_ENCRYPTION_SECRET to .env.production in amplify.yml\n- Add hasEncryptionSecret flag to /api/test diagnostics\n\nThis should fix 500s in A2A and gas card by enabling key decryption in production
```

## Files Changed

_File details not available in backfill — see commit link above._
