# Commit Brief: `dc6a5b2` — fix PEM normalizer: strip all non-base64 chars from body lines

| Field | Value |
|-------|-------|
| SHA | [`dc6a5b2`](https://github.com/iQube-Protocol/AigentZBeta/commit/dc6a5b2fa45b4672d889bb8487f2fef157421cf0) |
| Author | Claude |
| Date | 2026-06-09T03:54:22Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
fix PEM normalizer: strip all non-base64 chars from body lines

The Amplify-stored PEM value contained stray backslashes and dots
in the base64 body from the original entry process. Instead of
asking the operator to re-enter the value, the normalizer now
strips any character that isn't valid base64 (A-Za-z0-9+/=) from
body lines. Marker lines (-----BEGIN/END-----) are unaffected.

https://claude.ai/code/session_01GAaQ29phj1nbW8wKrx2g3b
```

## Body

The Amplify-stored PEM value contained stray backslashes and dots
in the base64 body from the original entry process. Instead of
asking the operator to re-enter the value, the normalizer now
strips any character that isn't valid base64 (A-Za-z0-9+/=) from
body lines. Marker lines (-----BEGIN/END-----) are unaffected.

https://claude.ai/code/session_01GAaQ29phj1nbW8wKrx2g3b

## Files Changed

| Change | File |
|--------|------|
| Modified | `services/ops/pemNormalizer.ts` |

## Stats

 1 file changed, 1 insertion(+), 1 deletion(-)
