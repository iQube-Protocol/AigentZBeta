# Commit Brief: `5e26748` — repair-classify-provenance-record.ts: load .env.local like its sibling scripts

| Field | Value |
|-------|-------|
| SHA | [`5e26748`](https://github.com/iQube-Protocol/AigentZBeta/commit/5e26748d729d049a3022ec10153086df26b6d921) |
| Author | Claude |
| Date | 2026-08-31T00:13:27Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
repair-classify-provenance-record.ts: load .env.local like its sibling scripts

A standalone tsx invocation never gets Next.js's own automatic .env.local
loading (that only happens inside the Next dev/build/start process), so
getSupabaseServer() saw an empty process.env even with real credentials on
disk -- surfaced live as "Supabase configuration missing" when the operator
ran the script. Mirrors the exact same inline .env.local/.env.local.temp
loader scripts/publish-independence-review.ts already uses -- not a new
mechanism.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01NQfGRfi4TgkQbnzUxbMKG9
```

## Body

A standalone tsx invocation never gets Next.js's own automatic .env.local
loading (that only happens inside the Next dev/build/start process), so
getSupabaseServer() saw an empty process.env even with real credentials on
disk -- surfaced live as "Supabase configuration missing" when the operator
ran the script. Mirrors the exact same inline .env.local/.env.local.temp
loader scripts/publish-independence-review.ts already uses -- not a new
mechanism.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01NQfGRfi4TgkQbnzUxbMKG9

## Files Changed

| Change | File |
|--------|------|
| Modified | `.amplify-deploy` |
| Modified | `scripts/repair-classify-provenance-record.ts` |

## Stats

 2 files changed, 29 insertions(+), 1 deletion(-)
