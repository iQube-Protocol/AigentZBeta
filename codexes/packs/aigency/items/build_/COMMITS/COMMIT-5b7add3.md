# Commit Brief: `5b7add3` — normalize DFX_IDENTITY_PEM to handle Amplify env-var whitespace mangling

| Field | Value |
|-------|-------|
| SHA | [`5b7add3`](https://github.com/iQube-Protocol/AigentZBeta/commit/5b7add3411e079ff7738331089f3a56aa113acc0) |
| Author | Claude |
| Date | 2026-06-08T21:52:41Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
normalize DFX_IDENTITY_PEM to handle Amplify env-var whitespace mangling

Amplify env-var inputs can collapse PEM newlines to spaces or store
escaped \\n literals. Both broke fromPem() silently — server fell back
to anonymous identity and cycle reads returned 'unknown'.

New helper services/ops/pemNormalizer.ts restores parseable PEMs from
any of: real newlines, \\n literals, single-line with spaces, CRLF.
Wired into cycles-status, top-up, dvn-test, and check-canister-cycles
routes. Idempotent — well-formed PEMs pass through unchanged.

services/ops/icAgent.ts not modified (DVN-protected); requires
operator approval per CLAUDE.md.

https://claude.ai/code/session_01GAaQ29phj1nbW8wKrx2g3b
```

## Body

Amplify env-var inputs can collapse PEM newlines to spaces or store
escaped \\n literals. Both broke fromPem() silently — server fell back
to anonymous identity and cycle reads returned 'unknown'.

New helper services/ops/pemNormalizer.ts restores parseable PEMs from
any of: real newlines, \\n literals, single-line with spaces, CRLF.
Wired into cycles-status, top-up, dvn-test, and check-canister-cycles
routes. Idempotent — well-formed PEMs pass through unchanged.

services/ops/icAgent.ts not modified (DVN-protected); requires
operator approval per CLAUDE.md.

https://claude.ai/code/session_01GAaQ29phj1nbW8wKrx2g3b

## Files Changed

| Change | File |
|--------|------|
| Modified | `app/api/admin/debug/check-canister-cycles/route.ts` |
| Modified | `app/api/admin/dvn-test/route.ts` |
| Modified | `app/api/ops/canisters/cycles-status/route.ts` |
| Modified | `app/api/ops/canisters/top-up/route.ts` |
| Added | `services/ops/pemNormalizer.ts` |

## Stats

 5 files changed, 60 insertions(+), 12 deletions(-)
