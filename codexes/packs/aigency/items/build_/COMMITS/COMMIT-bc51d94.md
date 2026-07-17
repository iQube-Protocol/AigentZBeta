# Commit Brief: `bc51d94` — CRP-003a: money-moving agreement UI (domain selector + spend cap + settlement)

| Field | Value |
|-------|-------|
| SHA | [`bc51d94`](https://github.com/iQube-Protocol/AigentZBeta/commit/bc51d946a0e3cfbd967e6c898e19fd376be8f588) |
| Author | Claude |
| Date | 2026-07-17T15:01:45Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
CRP-003a: money-moving agreement UI (domain selector + spend cap + settlement)

FinancialServicesTab gains: a domain selector (Intelligence / Investment /
Market); for money-moving domains, an enforced spend-ceiling (P3) input +
settlement fields (rail / amount / currency); the form sends valueCeiling +
settlementTerms + domain-specific governing invariants (adds CFI-001 for
money-moving); the pipeline run passes the domain; the trace panel shows the
domain + the settlement intent/status. Executors stay advice-only
(forbiddenActions: transfer) — settlement is the separate bound step.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Y98FMjkM8zUDsYqJikzsMB
```

## Body

FinancialServicesTab gains: a domain selector (Intelligence / Investment /
Market); for money-moving domains, an enforced spend-ceiling (P3) input +
settlement fields (rail / amount / currency); the form sends valueCeiling +
settlementTerms + domain-specific governing invariants (adds CFI-001 for
money-moving); the pipeline run passes the domain; the trace panel shows the
domain + the settlement intent/status. Executors stay advice-only
(forbiddenActions: transfer) — settlement is the separate bound step.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Y98FMjkM8zUDsYqJikzsMB

## Files Changed

| Change | File |
|--------|------|
| Modified | `app/triad/components/codex/tabs/FinancialServicesTab.tsx` |

## Stats

 1 file changed, 83 insertions(+), 9 deletions(-)
