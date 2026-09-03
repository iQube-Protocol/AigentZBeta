# Commit Brief: `40a36b4` — Financial-profile compute/manual routes never crash on a missing table

| Field | Value |
|-------|-------|
| SHA | [`40a36b4`](https://github.com/iQube-Protocol/AigentZBeta/commit/40a36b43ea901a19ddbdea7c6f8c4cc06898f2fb) |
| Author | Claude |
| Date | 2026-09-02T06:07:58Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Financial-profile compute/manual routes never crash on a missing table

Both had zero try/catch — upsertFinancialProfileQube's throw on a
missing financial_profile_qubes table was unhandled, producing a raw
500 with no JSON body instead of an honest, actionable response.

upsertFinancialProfileQube now throws a named
FinancialProfileTableMissingError on that specific condition (distinct
from every other write failure); both routes catch it and return a
clean 503 'financial-profile-unavailable'. The read path
(getFinancialProfileQube) is unchanged — it keeps degrading silently to
null, the same honest-empty convention every other missing-table read in
this codebase already uses; it is the ACTIVE write attempt that needed
a distinct signal, since "your save failed" and "no profile exists yet"
are different facts.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01S5Y1pnDdW3LyguwPdfJjXy
```

## Body

Both had zero try/catch — upsertFinancialProfileQube's throw on a
missing financial_profile_qubes table was unhandled, producing a raw
500 with no JSON body instead of an honest, actionable response.

upsertFinancialProfileQube now throws a named
FinancialProfileTableMissingError on that specific condition (distinct
from every other write failure); both routes catch it and return a
clean 503 'financial-profile-unavailable'. The read path
(getFinancialProfileQube) is unchanged — it keeps degrading silently to
null, the same honest-empty convention every other missing-table read in
this codebase already uses; it is the ACTIVE write attempt that needed
a distinct signal, since "your save failed" and "no profile exists yet"
are different facts.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01S5Y1pnDdW3LyguwPdfJjXy

## Files Changed

| Change | File |
|--------|------|
| Modified | `app/api/moneypenny/financial-profile/compute/route.ts` |
| Modified | `app/api/moneypenny/financial-profile/manual/route.ts` |
| Modified | `services/iqube/financialProfileQube.ts` |
| Modified | `tests/financial-profile-manual-entry.test.ts` |

## Stats

 4 files changed, 55 insertions(+), 2 deletions(-)
