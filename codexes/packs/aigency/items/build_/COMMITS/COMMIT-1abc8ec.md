# Commit Brief: `1abc8ec` — add polity passport as first-class metaMe activation + embed link on all activation cards

| Field | Value |
|-------|-------|
| SHA | [`1abc8ec`](https://github.com/iQube-Protocol/AigentZBeta/commit/1abc8ec9c1872909eb96ae9bb4b10401da6186ae) |
| Author | Claude |
| Date | 2026-06-13T21:09:18Z |
| Branch | dev (direct push) |
| Type | `feat` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
add polity passport as first-class metaMe activation + embed link on all activation cards

- Add polity-passport entry to ACTIVATION_CATALOG with metrics and actions
- Add passport TabGroup to metaMe codex with activationId gate
- Mirror Bureau tabs into metaMe passport group via polityPassportTabsByGroup
- Add Embed button to all activation cards — copies the standalone embed
  URL so users can share the activation surface outside the runtime
- Add ContentQube seed migration for the polity-passport activation

https://claude.ai/code/session_01LPt5L6vMfR6x9uqnNLmTzt
```

## Body

- Add polity-passport entry to ACTIVATION_CATALOG with metrics and actions
- Add passport TabGroup to metaMe codex with activationId gate
- Mirror Bureau tabs into metaMe passport group via polityPassportTabsByGroup
- Add Embed button to all activation cards — copies the standalone embed
  URL so users can share the activation surface outside the runtime
- Add ContentQube seed migration for the polity-passport activation

https://claude.ai/code/session_01LPt5L6vMfR6x9uqnNLmTzt

## Files Changed

| Change | File |
|--------|------|
| Modified | `app/triad/components/codex/tabs/ActivationsTab.tsx` |
| Modified | `data/activation-catalog.ts` |
| Modified | `data/codex-configs.ts` |
| Added | `supabase/migrations/20260613000000_polity_passport_activation.sql` |

## Stats

 4 files changed, 124 insertions(+), 3 deletions(-)
