# Commit Brief: `5071dbf` — fix: Make @napi-rs/canvas external to prevent Amplify build failure

| Field | Value |
|-------|-------|
| SHA | [`5071dbf`](https://github.com/iQube-Protocol/AigentZBeta/commit/5071dbf2b83e9ad9b12a67def767c90c44914bf5) |
| Author | Kn0w-1 |
| Date | 2025-12-25T14:34:08Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
fix: Make @napi-rs/canvas external to prevent Amplify build failure

- Changed canvas import to dynamic import in pdf-page route
- Added @napi-rs/canvas to webpack externals in next.config.js
- Prevents webpack from bundling native binary at build time
- Allows runtime loading in Node.js environment only
```

## Files Changed

_File details not available in backfill — see commit link above._
