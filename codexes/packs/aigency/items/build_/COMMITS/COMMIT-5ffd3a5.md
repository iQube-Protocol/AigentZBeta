# Commit Brief: `5ffd3a5` — stage 3 citizen flow server-side: self-custody vault, weak proof, application submit pipeline

| Field | Value |
|-------|-------|
| SHA | [`5ffd3a5`](https://github.com/iQube-Protocol/AigentZBeta/commit/5ffd3a5ba09b5e0b158f419ed4968e2b84f4d0f6) |
| Author | Claude |
| Date | 2026-06-10T21:30:54Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
stage 3 citizen flow server-side: self-custody vault, weak proof, application submit pipeline

- Add services/passport/selfCustodyVault.ts: client-side WebCrypto
  AES-256-GCM with PBKDF2-SHA256 (310k iters), versioned PPBVAULT1 envelope,
  buildSelfCustodyRef pinning Addendum A custody consts (holder-controlled
  key, no bureau/sysadmin plaintext access)
- Add /api/passport/vault/upload: ciphertext-only relay to Auto Drive —
  refuses non-envelope bytes with 422, no plaintext path exists
- Add services/passport/personhoodProof.ts: CAPTCHA weak-proof interface
  (Turnstile behind TURNSTILE_SECRET_KEY, fail-closed dev stub)
- Add /api/passport/applications/submit: consent + 4 mandatory self-custody
  acknowledgements validation, weak proof, one-open-application guard,
  passport_application_submitted receipt via canonical pipeline
- Add /api/passport/applications/status: applicant own-status (T1-safe)
- Extend ActivityActionType + activity_receipts CHECK with 6 passport types
  (20260610100000_passport_receipt_action_types.sql)
- Extend canary suite: vault round-trip, plaintext refusal, custody consts,
  route source canaries — 42 tests passing

https://claude.ai/code/session_011WbEHMJb5S4TDxmbbCFBJA
```

## Body

- Add services/passport/selfCustodyVault.ts: client-side WebCrypto
  AES-256-GCM with PBKDF2-SHA256 (310k iters), versioned PPBVAULT1 envelope,
  buildSelfCustodyRef pinning Addendum A custody consts (holder-controlled
  key, no bureau/sysadmin plaintext access)
- Add /api/passport/vault/upload: ciphertext-only relay to Auto Drive —
  refuses non-envelope bytes with 422, no plaintext path exists
- Add services/passport/personhoodProof.ts: CAPTCHA weak-proof interface
  (Turnstile behind TURNSTILE_SECRET_KEY, fail-closed dev stub)
- Add /api/passport/applications/submit: consent + 4 mandatory self-custody
  acknowledgements validation, weak proof, one-open-application guard,
  passport_application_submitted receipt via canonical pipeline
- Add /api/passport/applications/status: applicant own-status (T1-safe)
- Extend ActivityActionType + activity_receipts CHECK with 6 passport types
  (20260610100000_passport_receipt_action_types.sql)
- Extend canary suite: vault round-trip, plaintext refusal, custody consts,
  route source canaries — 42 tests passing

https://claude.ai/code/session_011WbEHMJb5S4TDxmbbCFBJA

## Files Changed

| Change | File |
|--------|------|
| Added | `app/api/passport/applications/status/route.ts` |
| Added | `app/api/passport/applications/submit/route.ts` |
| Added | `app/api/passport/vault/upload/route.ts` |
| Modified | `codexes/packs/agentiq/updates/2026-06-10_polity-passport-bureau-implementation-plan.md` |
| Added | `services/passport/personhoodProof.ts` |
| Added | `services/passport/selfCustodyVault.ts` |
| Modified | `services/receipts/activityReceiptService.ts` |
| Added | `supabase/migrations/20260610100000_passport_receipt_action_types.sql` |
| Modified | `tests/passport-bureau.test.ts` |

## Stats

 9 files changed, 691 insertions(+), 2 deletions(-)
