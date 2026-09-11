# Commit Brief: `ceb823f` — add factor case pipeline service (journey a) and canonical hashing util

| Field | Value |
|-------|-------|
| SHA | [`ceb823f`](https://github.com/iQube-Protocol/AigentZBeta/commit/ceb823f96a137b23dd182fdee16815340504fb5a) |
| Author | Claude |
| Date | 2026-09-04T17:08:40Z |
| Branch | dev (direct push) |
| Type | `feat` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
add factor case pipeline service (journey a) and canonical hashing util

factorCaseService.ts: server-validated state machine, idempotent
create-or-resume, pause/resume, evidence upsert-with-supersession.
Structurally refuses to set admitted/conditionally_admitted/rejected —
those three target states throw admission-requires-moneypenny-authority
unconditionally. Receipts via createActivityReceipt (activity_receipts),
not a parallel ledger.

canonical.ts: deterministic canonical-JSON + sha256 commitment hashing,
kept self-contained rather than importing services/research/review/
deterministic.ts to avoid any coupling to the Crystal/Track2 substrate
(explicit scope boundary, 2026-09-04).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01S5Y1pnDdW3LyguwPdfJjXy
```

## Body

factorCaseService.ts: server-validated state machine, idempotent
create-or-resume, pause/resume, evidence upsert-with-supersession.
Structurally refuses to set admitted/conditionally_admitted/rejected —
those three target states throw admission-requires-moneypenny-authority
unconditionally. Receipts via createActivityReceipt (activity_receipts),
not a parallel ledger.

canonical.ts: deterministic canonical-JSON + sha256 commitment hashing,
kept self-contained rather than importing services/research/review/
deterministic.ts to avoid any coupling to the Crystal/Track2 substrate
(explicit scope boundary, 2026-09-04).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01S5Y1pnDdW3LyguwPdfJjXy

## Files Changed

| Change | File |
|--------|------|
| Added | `services/factor/canonical.ts` |
| Added | `services/factor/factorCaseService.ts` |

## Stats

 2 files changed, 549 insertions(+)
