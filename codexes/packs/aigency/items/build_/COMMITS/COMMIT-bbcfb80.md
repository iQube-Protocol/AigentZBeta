# Commit Brief: `bbcfb80` — feat: multi-email identity controls with merge/segregate personas and access preferences

| Field | Value |
|-------|-------|
| SHA | [`bbcfb80`](https://github.com/iQube-Protocol/AigentZBeta/commit/bbcfb803ed4f4a1f6b0f4fbd42fd53375f36ba9d) |
| Author | Kn0w-1 |
| Date | 2026-02-21T03:50:44Z |
| Branch | dev (direct push) |
| Type | `feat` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
feat: multi-email identity controls with merge/segregate personas and access preferences

- Add tables: crm_auth_profile_emails, crm_auth_profile_links, crm_persona_access_preferences
- Add helpers: normalizeEmail, listEmailAliases, upsertEmailAlias, resolveAuthProfileIdByEmail, getMergedAuthProfiles, getPersonaAccessPreferences
- Update /api/wallet/personas to include personas from merged auth profiles and apply allow/deny preferences
- Add API routes:
  - GET/POST/DELETE /api/wallet/identity/emails (email aliases)
  - GET/POST/DELETE /api/wallet/identity/links (auth profile linking)
  - GET/POST/DELETE /api/wallet/identity/preferences (persona access preferences)
- Document usage flows and rollout guidance in docs/MULTI_EMAIL_IDENTITY_CONTROLS.md
```

## Files Changed

_File details not available in backfill — see commit link above._
