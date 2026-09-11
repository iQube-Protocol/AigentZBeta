# Commit Brief: `45137ac` — stage 2 identity & auth: bureau synthetic-email sign-on + persona/KybeDID bind flow

| Field | Value |
|-------|-------|
| SHA | [`45137ac`](https://github.com/iQube-Protocol/AigentZBeta/commit/45137acb998c3937b46b6e83f142720565895ff1) |
| Author | Claude |
| Date | 2026-06-10T21:25:30Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
stage 2 identity & auth: bureau synthetic-email sign-on + persona/KybeDID bind flow

- Add services/passport/bureauIdentityService.ts: synthetic-email Supabase
  auth user creation (<username>@passport.metame.internal), username
  validation, KybeDID minting (did:kybe:ppb:*), persona + KybeDID bind with
  duplicate-check (one Bureau persona per account, idempotent re-bind) and
  existing-RootDID mapping (existing KybeDID reused — one per human)
- Add /api/passport/auth/signup, /api/passport/auth/check-username,
  /api/passport/identity/bind routes — spine caller resolution via
  getCallerIdentityContext; T0-safe responses (commitment refs only, no raw
  personaId/kybe_did/root did_uri in browser JSON)
- Addendum B recovery-policy stub metadata on signup + bind responses
- Extend tests/passport-bureau.test.ts: 7 new tests (auth helpers + T0-leak
  source canaries), 34 total passing
- Update implementation plan: Stage 2 delivered

https://claude.ai/code/session_011WbEHMJb5S4TDxmbbCFBJA
```

## Body

- Add services/passport/bureauIdentityService.ts: synthetic-email Supabase
  auth user creation (<username>@passport.metame.internal), username
  validation, KybeDID minting (did:kybe:ppb:*), persona + KybeDID bind with
  duplicate-check (one Bureau persona per account, idempotent re-bind) and
  existing-RootDID mapping (existing KybeDID reused — one per human)
- Add /api/passport/auth/signup, /api/passport/auth/check-username,
  /api/passport/identity/bind routes — spine caller resolution via
  getCallerIdentityContext; T0-safe responses (commitment refs only, no raw
  personaId/kybe_did/root did_uri in browser JSON)
- Addendum B recovery-policy stub metadata on signup + bind responses
- Extend tests/passport-bureau.test.ts: 7 new tests (auth helpers + T0-leak
  source canaries), 34 total passing
- Update implementation plan: Stage 2 delivered

https://claude.ai/code/session_011WbEHMJb5S4TDxmbbCFBJA

## Files Changed

| Change | File |
|--------|------|
| Added | `app/api/passport/auth/check-username/route.ts` |
| Added | `app/api/passport/auth/signup/route.ts` |
| Added | `app/api/passport/identity/bind/route.ts` |
| Modified | `codexes/packs/agentiq/updates/2026-06-10_polity-passport-bureau-implementation-plan.md` |
| Added | `services/passport/bureauIdentityService.ts` |
| Modified | `tests/passport-bureau.test.ts` |

## Stats

 6 files changed, 630 insertions(+), 1 deletion(-)
