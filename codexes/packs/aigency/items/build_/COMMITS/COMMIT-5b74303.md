# Commit Brief: `5b74303` — diagnose and fix experience fetch: log supabase key type, parallel queries

| Field | Value |
|-------|-------|
| SHA | [`5b74303`](https://github.com/iQube-Protocol/AigentZBeta/commit/5b74303d1bad06581e2c7715c11bb2dfba6af4e6) |
| Author | Claude |
| Date | 2026-03-25T17:10:16Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
diagnose and fix experience fetch: log supabase key type, parallel queries

- supabaseServer: log which key type (SERVICE_ROLE_KEY vs ANON_KEY) is
  used at client init so CloudWatch shows the root cause immediately
- composerPersistence: log row count and error for every listExperiences
  Supabase call — visible in Amplify CloudWatch
- ComposerStudio fetchExperiences: replace sequential fallback chain with
  parallel Promise.all across tenant, legacy-tenant, broad (no filter),
  and creator_id queries — results merged by ID; experiences surface
  regardless of RLS config or tenant_id mismatch

https://claude.ai/code/session_01VcE6pnjSeAtYvhau1Q6GVM
```

## Files Changed

_File details not available in backfill — see commit link above._
