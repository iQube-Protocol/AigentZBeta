# Commit Brief: `e7ab69b` — add factor+aegis 0.1 phase 1 constitutional schema, reconciled onto current base

| Field | Value |
|-------|-------|
| SHA | [`e7ab69b`](https://github.com/iQube-Protocol/AigentZBeta/commit/e7ab69bedab7d4b9c1831b4808eaa6c9de2b76f3) |
| Author | Claude |
| Date | 2026-09-04T17:08:26Z |
| Branch | dev (direct push) |
| Type | `feat` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
add factor+aegis 0.1 phase 1 constitutional schema, reconciled onto current base

factor_cases/factor_case_events/factor_evidence_items (new, no existing
primitive covers candidate-intake pipeline state); aegis_assessments/
aegis_findings modelled on the proven marketa_agent_admission_assessments
append-only/superseding pattern as a SEPARATE table (independent assessor,
per-dimension findings marketa's table lacks); factor_authority_chains as a
thin overlay referencing delegation_grants.grant_id for direct-mode chains
(delegation_grants cannot express principal->moneypenny->factor mediation);
factor_standing_proposals propose-only. activity_receipts CHECK constraint
rebuilt wholesale with 11 new action types — no parallel receipt table.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01S5Y1pnDdW3LyguwPdfJjXy
```

## Body

factor_cases/factor_case_events/factor_evidence_items (new, no existing
primitive covers candidate-intake pipeline state); aegis_assessments/
aegis_findings modelled on the proven marketa_agent_admission_assessments
append-only/superseding pattern as a SEPARATE table (independent assessor,
per-dimension findings marketa's table lacks); factor_authority_chains as a
thin overlay referencing delegation_grants.grant_id for direct-mode chains
(delegation_grants cannot express principal->moneypenny->factor mediation);
factor_standing_proposals propose-only. activity_receipts CHECK constraint
rebuilt wholesale with 11 new action types — no parallel receipt table.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01S5Y1pnDdW3LyguwPdfJjXy

## Files Changed

| Change | File |
|--------|------|
| Added | `supabase/migrations/20260930190000_factor_aegis_constitution_reconciled.sql` |

## Stats

 1 file changed, 612 insertions(+)
