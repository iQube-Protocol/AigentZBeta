# Commit Brief: `5c07dab` — fix(ops): add CRON_TRIGGER_TOKEN to env allowlist

| Field | Value |
|-------|-------|
| SHA | [`5c07dab`](https://github.com/iQube-Protocol/AigentZBeta/commit/5c07dab75546242781f18d152735423c2f5d657d) |
| Author | Claude |
| Date | 2026-06-01T13:37:53Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
fix(ops): add CRON_TRIGGER_TOKEN to env allowlist

Amplify env vars only reach the Lambda runtime if they're listed in
scripts/create-env-production.js (the build-time .env.production
allowlist). Without this, the operator can set the var in the Amplify
console but every redeploy still surfaces 'cron_token_not_configured'
from /api/ops/sync/cron-tick because process.env.CRON_TRIGGER_TOKEN
remains undefined inside the Lambda.

Adding to the allowlist alongside ADMIN_OPS_TOKEN / REFERRAL_SHARE_*
which follow the same secret-injection pattern. Next build picks it up.
```

## Body

Amplify env vars only reach the Lambda runtime if they're listed in
scripts/create-env-production.js (the build-time .env.production
allowlist). Without this, the operator can set the var in the Amplify
console but every redeploy still surfaces 'cron_token_not_configured'
from /api/ops/sync/cron-tick because process.env.CRON_TRIGGER_TOKEN
remains undefined inside the Lambda.

Adding to the allowlist alongside ADMIN_OPS_TOKEN / REFERRAL_SHARE_*
which follow the same secret-injection pattern. Next build picks it up.

## Files Changed

| Change | File |
|--------|------|
| Modified | `scripts/create-env-production.js` |

## Stats

 1 file changed, 4 insertions(+)
