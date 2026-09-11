# Commit Brief: `95277c7` — Close AC-C06 cross-persona-read-denial gap; mark 3 checks blocked-on-access

| Field | Value |
|-------|-------|
| SHA | [`95277c7`](https://github.com/iQube-Protocol/AigentZBeta/commit/95277c77b7f706fc1c52887f4756446f852a4a98) |
| Author | Claude |
| Date | 2026-09-03T00:20:09Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Close AC-C06 cross-persona-read-denial gap; mark 3 checks blocked-on-access

Add real tests proving no financial-profile route accepts a caller-
supplied personaId (source-shape, all four routes) and that
getFinancialProfileQube actually isolates two personas' rows rather
than merely appearing to in source text (behavioral, fake two-persona
table). Closes the specific gap AC-C06 has carried since the original
crosswalk: "no dedicated cross-persona-read-denial test located."

Record the three remaining acceptance checks (native admin replacement,
A3 agent upload, local server-backed reads) as blocked-on-access with
their specific remedies named, and state explicitly that an admin-token
API test would establish API acceptance only, never browser-UI
acceptance -- no further polling or code changes attempted against
these three pending real access.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01S5Y1pnDdW3LyguwPdfJjXy
```

## Body

Add real tests proving no financial-profile route accepts a caller-
supplied personaId (source-shape, all four routes) and that
getFinancialProfileQube actually isolates two personas' rows rather
than merely appearing to in source text (behavioral, fake two-persona
table). Closes the specific gap AC-C06 has carried since the original
crosswalk: "no dedicated cross-persona-read-denial test located."

Record the three remaining acceptance checks (native admin replacement,
A3 agent upload, local server-backed reads) as blocked-on-access with
their specific remedies named, and state explicitly that an admin-token
API test would establish API acceptance only, never browser-UI
acceptance -- no further polling or code changes attempted against
these three pending real access.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01S5Y1pnDdW3LyguwPdfJjXy

## Files Changed

| Change | File |
|--------|------|
| Modified | `codexes/packs/agentiq/updates/2026-09-02_moneypenny-authoritative-three-spec-import-and-reconciliation.md` |
| Modified | `tests/moneypenny-financial-profile.test.ts` |

## Stats

 2 files changed, 158 insertions(+), 1 deletion(-)
