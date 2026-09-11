# Commit Brief: `30cc93e` — add factor standing-proposal queue (journey f) — propose only

| Field | Value |
|-------|-------|
| SHA | [`30cc93e`](https://github.com/iQube-Protocol/AigentZBeta/commit/30cc93e7ad40ad8c15eb05005723be3f4632fd79) |
| Author | Claude |
| Date | 2026-09-04T17:08:50Z |
| Branch | dev (direct push) |
| Type | `feat` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
add factor standing-proposal queue (journey f) — propose only

Factor may propose a standing event; it never writes standing directly.
Refuses a proposal carrying no veracity/contribution/risk-of-repair
evidence — positive economic outcome alone is insufficient (PRD sec 10).
Never touches services/crm/standingAccrualService.ts's tables, the real
accrual path on this base (tested: the only table this module writes
across a full create-then-accept flow is factor_standing_proposals).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01S5Y1pnDdW3LyguwPdfJjXy
```

## Body

Factor may propose a standing event; it never writes standing directly.
Refuses a proposal carrying no veracity/contribution/risk-of-repair
evidence — positive economic outcome alone is insufficient (PRD sec 10).
Never touches services/crm/standingAccrualService.ts's tables, the real
accrual path on this base (tested: the only table this module writes
across a full create-then-accept flow is factor_standing_proposals).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01S5Y1pnDdW3LyguwPdfJjXy

## Files Changed

| Change | File |
|--------|------|
| Added | `services/factor/standingProposal.ts` |

## Stats

 1 file changed, 102 insertions(+)
