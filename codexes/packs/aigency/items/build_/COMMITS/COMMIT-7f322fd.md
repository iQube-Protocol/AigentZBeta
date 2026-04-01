# Commit Brief: `7f322fd` — fix: Create .env.production during build to bake env vars into Next.js bundle

| Field | Value |
|-------|-------|
| SHA | [`7f322fd`](https://github.com/iQube-Protocol/AigentZBeta/commit/7f322fddbf7837840b296b1fe9514307a66cae9b) |
| Author | Know1 |
| Date | 2025-10-23T05:08:45Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
fix: Create .env.production during build to bake env vars into Next.js bundle

ATTEMPT #3: Runtime injection via amplify.yml failed twice

ROOT CAUSE:
- Amplify not injecting env vars to Lambda runtime despite correct syntax
- /api/test still shows hasSupabaseUrl: false, hasFioEndpoint: false
- Neither environment.variables nor compute.environment worked

NUCLEAR SOLUTION:
- Create .env.production file during build phase
- Use heredoc to write all env vars from Amplify Console
- Next.js will bundle these into the server at build time
- Env vars become part of the deployed artifact, not runtime injection

HOW IT WORKS:
1. Build phase runs: cat > .env.production << EOF
2. Writes all 8 env vars from ${VAR} substitution
3. Next.js build reads .env.production
4. Server bundle includes env vars statically
5. API routes get process.env.* at runtime

TRADE-OFF:
- Env vars are baked into build (not dynamic)
- Requires rebuild to change env vars
- BUT: This is standard for Next.js production anyway
- AND: It actually works unlike runtime injection

EXPECTED RESULT:
- /api/test: hasSupabaseUrl: true, hasFioEndpoint: true
- /api/health/fio: Real endpoint/chainId values
- FIO registration: Real testnet transactions

If this doesn't work, the problem is:
- Amplify Console env vars not set at all
- Branch mismatch (domain uses different branch)
- Variable names don't match exactly
```

## Files Changed

_File details not available in backfill — see commit link above._
