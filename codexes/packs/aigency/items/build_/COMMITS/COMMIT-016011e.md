# Commit Brief: `016011e` — add standing-signal seam: log work done as verified progress signals

| Field | Value |
|-------|-------|
| SHA | [`016011e`](https://github.com/iQube-Protocol/AigentZBeta/commit/016011e130b835de46ad499f28f82bd6fad6f9f6) |
| Author | Claude |
| Date | 2026-06-24T22:18:28Z |
| Branch | dev (direct push) |
| Type | `feat` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
add standing-signal seam: log work done as verified progress signals

Foundation for the actions-taken / standing-documents feedback loop. Work
DONE (on- or off-platform) becomes a verified Standing signal that grounded
progress reports read as PROGRESS from the ingested baseline — closing the
loop the no-hallucination mandate depends on.

- New activity action types operator_action_logged + standing_document_added,
  added to ANCHORABLE_ACTION_TYPES (the permitted unilateral DVN change) so
  logged work is DVN-anchored provenance.
- services/standing/standingSignalService.ts: logStandingSignal() writes the
  activity receipt (the canonical actions-taken log) and best-effort accrues
  Personal Standing via the existing crm engine (resolving crm_personas.id by
  identity_persona_id). Never throws — a ledger hiccup can't lose the receipt.

Operator's own log of their own work is a legitimate Personal Standing signal
("not everything needs attestation"); outcome/value CLAIMS stay verification-
gated via ProofOfOutcomeClaim. API route + UI affordance are the next increment.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_011WbEHMJb5S4TDxmbbCFBJA
```

## Body

Foundation for the actions-taken / standing-documents feedback loop. Work
DONE (on- or off-platform) becomes a verified Standing signal that grounded
progress reports read as PROGRESS from the ingested baseline — closing the
loop the no-hallucination mandate depends on.

- New activity action types operator_action_logged + standing_document_added,
  added to ANCHORABLE_ACTION_TYPES (the permitted unilateral DVN change) so
  logged work is DVN-anchored provenance.
- services/standing/standingSignalService.ts: logStandingSignal() writes the
  activity receipt (the canonical actions-taken log) and best-effort accrues
  Personal Standing via the existing crm engine (resolving crm_personas.id by
  identity_persona_id). Never throws — a ledger hiccup can't lose the receipt.

Operator's own log of their own work is a legitimate Personal Standing signal
("not everything needs attestation"); outcome/value CLAIMS stay verification-
gated via ProofOfOutcomeClaim. API route + UI affordance are the next increment.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_011WbEHMJb5S4TDxmbbCFBJA

## Files Changed

| Change | File |
|--------|------|
| Modified | `services/dvn/activityReceiptDvnPipeline.ts` |
| Modified | `services/receipts/activityReceiptService.ts` |
| Added | `services/standing/standingSignalService.ts` |

## Stats

 3 files changed, 142 insertions(+), 1 deletion(-)
