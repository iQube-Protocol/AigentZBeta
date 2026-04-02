# Commit Brief: `18a4089` — refactor: Use QubeBase SDK (@qriptoagentiq/core-client) for Supabase connections

| Field | Value |
|-------|-------|
| SHA | [`18a4089`](https://github.com/iQube-Protocol/AigentZBeta/commit/18a4089a401e9134ad28e5e333b6010a8dac1155) |
| Author | Know1 |
| Date | 2025-10-15T22:33:50Z |
| Branch | dev (direct push) |
| Type | `refactor` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
refactor: Use QubeBase SDK (@qriptoagentiq/core-client) for Supabase connections

- Replace direct Supabase client creation with SDK
- PersonaService now uses initAgentiqClient()
- supabaseServer.ts now uses initAgentiqClient()
- Proper architecture: AigentZBeta → QubeBase SDK → Supabase
- SDK already installed (v0.1.5) and published to npm

This is the correct approach for multi-app QubeBase architecture.
```

## Files Changed

_File details not available in backfill — see commit link above._
