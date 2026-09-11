# Commit Brief: `14e72e9` — fix PEM parsing: install @dfinity/identity-secp256k1 and route all callers through it

| Field | Value |
|-------|-------|
| SHA | [`14e72e9`](https://github.com/iQube-Protocol/AigentZBeta/commit/14e72e9169f972e585e6d522ce88264386641faa) |
| Author | Claude |
| Date | 2026-06-09T02:27:33Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
fix PEM parsing: install @dfinity/identity-secp256k1 and route all callers through it

Root cause: @dfinity/identity 3.x removed `fromPem` from
`Ed25519KeyIdentity` and deprecated `Secp256k1KeyIdentity` to an
empty stub. Every PEM-parsing call site in the codebase silently
fell back to anonymous, breaking cycles-status, top-up, dvn-test,
check-canister-cycles, and the DVN submission path in icAgent.ts.

Changes:
- Install @dfinity/identity-secp256k1 3.4.3 (the official replacement
  for EC key parsing, matches @dfinity/agent version).
- Add `parsePemToIdentity()` + `detectIdentityFromPem()` helpers to
  pemNormalizer.ts. Both try the new package first, fall back to the
  legacy @dfinity/identity exports if present.
- Strip stray trailing backslashes + clean characters glued to the
  END marker in normalizePem (Amplify env-var mangling quirk).
- Route all five call sites through the new helpers:
    services/ops/icAgent.ts          (DVN submission path)
    app/api/ops/canisters/cycles-status/route.ts
    app/api/ops/canisters/top-up/route.ts
    app/api/admin/dvn-test/route.ts
    app/api/admin/debug/check-canister-cycles/route.ts
- Update /api/admin/debug/pem-status diagnostic to probe both
  packages and surface which one accepted the PEM.

The icAgent.ts change is purely defensive — it does not modify the
call mechanism, payload shape, or state machine for the DVN
pipeline. The HttpAgent + Actor construction is unchanged; only
PEM parsing is rerouted through a more permissive helper.

https://claude.ai/code/session_01GAaQ29phj1nbW8wKrx2g3b
```

## Body

Root cause: @dfinity/identity 3.x removed `fromPem` from
`Ed25519KeyIdentity` and deprecated `Secp256k1KeyIdentity` to an
empty stub. Every PEM-parsing call site in the codebase silently
fell back to anonymous, breaking cycles-status, top-up, dvn-test,
check-canister-cycles, and the DVN submission path in icAgent.ts.

Changes:
- Install @dfinity/identity-secp256k1 3.4.3 (the official replacement
  for EC key parsing, matches @dfinity/agent version).
- Add `parsePemToIdentity()` + `detectIdentityFromPem()` helpers to
  pemNormalizer.ts. Both try the new package first, fall back to the
  legacy @dfinity/identity exports if present.
- Strip stray trailing backslashes + clean characters glued to the
  END marker in normalizePem (Amplify env-var mangling quirk).
- Route all five call sites through the new helpers:
    services/ops/icAgent.ts          (DVN submission path)
    app/api/ops/canisters/cycles-status/route.ts
    app/api/ops/canisters/top-up/route.ts
    app/api/admin/dvn-test/route.ts
    app/api/admin/debug/check-canister-cycles/route.ts
- Update /api/admin/debug/pem-status diagnostic to probe both
  packages and surface which one accepted the PEM.

The icAgent.ts change is purely defensive — it does not modify the
call mechanism, payload shape, or state machine for the DVN
pipeline. The HttpAgent + Actor construction is unchanged; only
PEM parsing is rerouted through a more permissive helper.

https://claude.ai/code/session_01GAaQ29phj1nbW8wKrx2g3b

## Files Changed

| Change | File |
|--------|------|
| Modified | `app/api/admin/debug/check-canister-cycles/route.ts` |
| Modified | `app/api/admin/debug/pem-status/route.ts` |
| Modified | `app/api/admin/dvn-test/route.ts` |
| Modified | `app/api/ops/canisters/cycles-status/route.ts` |
| Modified | `app/api/ops/canisters/top-up/route.ts` |
| Modified | `package-lock.json` |
| Modified | `package.json` |
| Modified | `services/ops/icAgent.ts` |
| Modified | `services/ops/pemNormalizer.ts` |

## Stats

 9 files changed, 135 insertions(+), 128 deletions(-)
