# Commit Brief: `c87dfd5` — fix nakamoto join: use crm_personas.email via identity_persona_id

| Field | Value |
|-------|-------|
| SHA | [`c87dfd5`](https://github.com/iQube-Protocol/AigentZBeta/commit/c87dfd504ecaa92aeddc2add7ccd31719e0900d2) |
| Author | Claude |
| Date | 2026-03-24T11:20:40Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
fix nakamoto join: use crm_personas.email via identity_persona_id

personas.fio_handle is a FIO name handle (@knyt, @qripto), not an email.
The real email lives in crm_personas.email, linked by identity_persona_id.
Fall back to fio_handle only for legacy records with no crm_personas row.

https://claude.ai/code/session_017i9fiEGA3zMjxFonVYZCQT
```

## Files Changed

_File details not available in backfill — see commit link above._
