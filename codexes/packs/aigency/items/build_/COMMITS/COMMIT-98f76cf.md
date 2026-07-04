# Commit Brief: `98f76cf` — stage 4 agent flow HTTP-first: schema serving, validate/submit/status machine surfaces

| Field | Value |
|-------|-------|
| SHA | [`98f76cf`](https://github.com/iQube-Protocol/AigentZBeta/commit/98f76cf328da4920f634e2fbad2cc1afb3b415ec) |
| Author | Claude |
| Date | 2026-06-10T21:34:37Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
stage 4 agent flow HTTP-first: schema serving, validate/submit/status machine surfaces

- Add /api/polity-passport/schemas/[name]: serve the v0.1 schema bundle
  verbatim behind a strict allowlist (manifest at /schemas/index)
- Add services/passport/participantApplicationValidator.ts: structural
  validation of participant applications (shared by validate + submit so
  they never drift; thin ajv wrapper when ajv gains 2020-12 support)
- Add /api/polity-passport/validate (dry-run, nothing persisted)
- Add /api/polity-passport/submit: one-open-application-per-agent-card
  guard, application_payload jsonb for registry-public participant
  material, agent_declaration proof, signature recorded_unverified (v0.2
  signed-JSON spec pending), receipt via PASSPORT_BUREAU_SYSTEM_PERSONA_ID
- Add /api/polity-passport/status/[id]: public-safe status projection
- Add 20260610200000_passport_application_payload.sql migration
- Extend canary suite: validator accept/reject/class-mapping + schema
  allowlist sync — 46 tests passing

https://claude.ai/code/session_011WbEHMJb5S4TDxmbbCFBJA
```

## Body

- Add /api/polity-passport/schemas/[name]: serve the v0.1 schema bundle
  verbatim behind a strict allowlist (manifest at /schemas/index)
- Add services/passport/participantApplicationValidator.ts: structural
  validation of participant applications (shared by validate + submit so
  they never drift; thin ajv wrapper when ajv gains 2020-12 support)
- Add /api/polity-passport/validate (dry-run, nothing persisted)
- Add /api/polity-passport/submit: one-open-application-per-agent-card
  guard, application_payload jsonb for registry-public participant
  material, agent_declaration proof, signature recorded_unverified (v0.2
  signed-JSON spec pending), receipt via PASSPORT_BUREAU_SYSTEM_PERSONA_ID
- Add /api/polity-passport/status/[id]: public-safe status projection
- Add 20260610200000_passport_application_payload.sql migration
- Extend canary suite: validator accept/reject/class-mapping + schema
  allowlist sync — 46 tests passing

https://claude.ai/code/session_011WbEHMJb5S4TDxmbbCFBJA

## Files Changed

| Change | File |
|--------|------|
| Added | `app/api/polity-passport/schemas/[name]/route.ts` |
| Added | `app/api/polity-passport/status/[id]/route.ts` |
| Added | `app/api/polity-passport/submit/route.ts` |
| Added | `app/api/polity-passport/validate/route.ts` |
| Modified | `codexes/packs/agentiq/updates/2026-06-10_polity-passport-bureau-implementation-plan.md` |
| Added | `services/passport/participantApplicationValidator.ts` |
| Added | `supabase/migrations/20260610200000_passport_application_payload.sql` |
| Modified | `tests/passport-bureau.test.ts` |

## Stats

 8 files changed, 566 insertions(+), 1 deletion(-)
