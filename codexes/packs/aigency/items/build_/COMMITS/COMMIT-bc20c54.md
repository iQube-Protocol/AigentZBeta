# Commit Brief: `bc20c54` — stage 7 discovery surfaces: .well-known bureau document + llms.txt orientation

| Field | Value |
|-------|-------|
| SHA | [`bc20c54`](https://github.com/iQube-Protocol/AigentZBeta/commit/bc20c54a4b9fc039fa504ae7d7ef629c54fffe8f) |
| Author | Claude |
| Date | 2026-06-10T22:44:04Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
stage 7 discovery surfaces: .well-known bureau document + llms.txt orientation

- Add /.well-known/polity-passport: Bureau discovery document with apply/
  submit/validate/status endpoints, schema bundle URLs, and constitutional
  principles (mirrors the iqube-catalog well-known pattern, CORS-enabled)
- Add /api/polity-passport/llms.txt: plain-text LLM agent orientation —
  passport classes, privacy model, machine application flow, discovery links
- Update implementation plan: Stage 7 discovery surfaces delivered

https://claude.ai/code/session_011WbEHMJb5S4TDxmbbCFBJA
```

## Body

- Add /.well-known/polity-passport: Bureau discovery document with apply/
  submit/validate/status endpoints, schema bundle URLs, and constitutional
  principles (mirrors the iqube-catalog well-known pattern, CORS-enabled)
- Add /api/polity-passport/llms.txt: plain-text LLM agent orientation —
  passport classes, privacy model, machine application flow, discovery links
- Update implementation plan: Stage 7 discovery surfaces delivered

https://claude.ai/code/session_011WbEHMJb5S4TDxmbbCFBJA

## Files Changed

| Change | File |
|--------|------|
| Added | `app/.well-known/polity-passport/route.ts` |
| Added | `app/api/polity-passport/llms.txt/route.ts` |
| Modified | `codexes/packs/agentiq/updates/2026-06-10_polity-passport-bureau-implementation-plan.md` |

## Stats

 3 files changed, 144 insertions(+), 1 deletion(-)
