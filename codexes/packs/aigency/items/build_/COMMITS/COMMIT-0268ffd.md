# Commit Brief: `0268ffd` — fix: Copy .env.production to standalone build for Amplify runtime

| Field | Value |
|-------|-------|
| SHA | [`0268ffd`](https://github.com/iQube-Protocol/AigentZBeta/commit/0268ffd464e773708f76e26d46ac551ed3e19859) |
| Author | Kn0w-1 |
| Date | 2025-12-26T03:04:42Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
fix: Copy .env.production to standalone build for Amplify runtime

- Amplify standalone mode doesn't use .env.production at runtime
- Copy .env.production into .next/standalone/ directory
- This makes PayPal credentials available to Lambda function at runtime
```

## Files Changed

_File details not available in backfill — see commit link above._
