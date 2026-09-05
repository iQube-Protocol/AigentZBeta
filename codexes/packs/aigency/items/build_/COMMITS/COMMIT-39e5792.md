# Commit Brief: `39e5792` — Add Bankr Phase 9 live-rehearsal script (stops at the approval boundary)

| Field | Value |
|-------|-------|
| SHA | [`39e5792`](https://github.com/iQube-Protocol/AigentZBeta/commit/39e5792aec67df029203286c9c738ad77076a41f) |
| Author | Claude |
| Date | 2026-09-05T21:02:10Z |
| Branch | dev (direct push) |
| Type | `feat` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Add Bankr Phase 9 live-rehearsal script (stops at the approval boundary)

scripts/bankr-live-rehearsal.mjs drives the real HTTP pipeline
(readiness -> prepare -> preflight -> request Aegis -> drive assessment to
ratified -> request approval) against a deployed host, using nothing but
the routes shipped in the last two commits. It never calls submit or
approve, has no --yes/--force bypass, and stops after printing the exact
human approval package (spec fields, Bankr terms + provenance, Aegis
decision/rationale, disclosures) — approving or submitting is a separate,
explicit operator act named in the script's own output, not performed by
it.

Requires all token-identity fields (chain/tokenName/tokenSymbol/
feeRecipient) as explicit flags — never defaults or invents them, matching
the same constraint the API/service layer already enforces.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01EGP1sZh5ka4XcFutt5UAsc
```

## Body

scripts/bankr-live-rehearsal.mjs drives the real HTTP pipeline
(readiness -> prepare -> preflight -> request Aegis -> drive assessment to
ratified -> request approval) against a deployed host, using nothing but
the routes shipped in the last two commits. It never calls submit or
approve, has no --yes/--force bypass, and stops after printing the exact
human approval package (spec fields, Bankr terms + provenance, Aegis
decision/rationale, disclosures) — approving or submitting is a separate,
explicit operator act named in the script's own output, not performed by
it.

Requires all token-identity fields (chain/tokenName/tokenSymbol/
feeRecipient) as explicit flags — never defaults or invents them, matching
the same constraint the API/service layer already enforces.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01EGP1sZh5ka4XcFutt5UAsc

## Files Changed

| Change | File |
|--------|------|
| Added | `scripts/bankr-live-rehearsal.mjs` |

## Stats

 1 file changed, 207 insertions(+)
