# Commit Brief: `8e19382` — Add MPY2-2 Financial Profile: bank-statement aggregates + candidate envelope

| Field | Value |
|-------|-------|
| SHA | [`8e19382`](https://github.com/iQube-Protocol/AigentZBeta/commit/8e193820dc585dc3536f4aff901a223ecefe41a3) |
| Author | Claude |
| Date | 2026-09-01T15:52:16Z |
| Branch | dev (direct push) |
| Type | `feat` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Add MPY2-2 Financial Profile: bank-statement aggregates + candidate envelope

SPEC-MPY-002 §5. Per the operator's re-sequencing (Financial Profile before
Risk Envelope/Scenario/Market work, since it's the durable per-user state
everything else reasons over), and per the spec's own §5.3 hard constraint
("audit existing secure/private-document and blakQube facilities first"),
this reuses three already-live facilities rather than building a fourth:

1. Document intake: extends the EXISTING generic per-persona upload
   facility (services/uploads/*, already handling standing_document etc.)
   with a new 'financial_document' useKind — one migration extending the
   use_kind CHECK constraint, mirroring 20260625000000's own precedent
   exactly. No new upload route, no new storage adapter, no new PDF/CSV
   parser — uploadIndexer.ts's existing dispatch already produces
   contentJson (CSV rows) / contentMd (PDF text) for any use_kind.

2. Derived state: financialProfileAggregation.ts is a pure function turning
   parsed CSV rows into income/expenditure/surplus/cash-flow-volatility/
   liquidity-buffer/recurring-commitments/concentration aggregates plus a
   candidate risk envelope. Recognizes common bank-export column shapes
   (date + signed amount, or date + debit/credit pair, optionally balance/
   category) via header matching only — never guesses from cell content.
   A statement whose shape isn't recognized, or that carries too little
   data for a given figure (e.g. one month for volatility, no balance
   column for liquidity buffer), reports itself unreadable/null rather than
   fabricating a number. No candidate envelope is proposed when average
   expenditure meets or exceeds income.

3. Persistence: financialProfileQube.ts mirrors experienceQube.ts's
   meta(T1)/blak(T0) BlakQube pattern exactly — one new table
   (financial_profile_qubes), service-role-only RLS. Stores ONLY the
   derived aggregates/envelope, never a copy of the raw statement (which
   stays in persona_uploads/persona_upload_index, the one truth store for
   the source documents) — satisfying §5's "no parallel bank_statements
   store" constraint by construction, not by convention.

Two new routes (compute, owner self-view read) and a capability-rail panel
(FinancialProfilePanel.tsx) wired into the existing 'operate' tabGroup —
tabGroups itself is untouched, pinned exactly by
tests/fs-operate-embed-viewport-parity.test.ts. moneypennyCapabilities.ts's
financial-profile item, previously panel: null ("not yet built"), now
points at the real panel.

Not merged to dev — per operator instruction, this stays on
spec/moneypenny-cartridge-upgrade pending explicit approval.

Migration required before this is live:
  supabase/migrations/20260930170000_persona_uploads_financial_document.sql
  supabase/migrations/20260930180000_financial_profile_qubes.sql
```

## Body

SPEC-MPY-002 §5. Per the operator's re-sequencing (Financial Profile before
Risk Envelope/Scenario/Market work, since it's the durable per-user state
everything else reasons over), and per the spec's own §5.3 hard constraint
("audit existing secure/private-document and blakQube facilities first"),
this reuses three already-live facilities rather than building a fourth:

1. Document intake: extends the EXISTING generic per-persona upload
   facility (services/uploads/*, already handling standing_document etc.)
   with a new 'financial_document' useKind — one migration extending the
   use_kind CHECK constraint, mirroring 20260625000000's own precedent
   exactly. No new upload route, no new storage adapter, no new PDF/CSV
   parser — uploadIndexer.ts's existing dispatch already produces
   contentJson (CSV rows) / contentMd (PDF text) for any use_kind.

2. Derived state: financialProfileAggregation.ts is a pure function turning
   parsed CSV rows into income/expenditure/surplus/cash-flow-volatility/
   liquidity-buffer/recurring-commitments/concentration aggregates plus a
   candidate risk envelope. Recognizes common bank-export column shapes
   (date + signed amount, or date + debit/credit pair, optionally balance/
   category) via header matching only — never guesses from cell content.
   A statement whose shape isn't recognized, or that carries too little
   data for a given figure (e.g. one month for volatility, no balance
   column for liquidity buffer), reports itself unreadable/null rather than
   fabricating a number. No candidate envelope is proposed when average
   expenditure meets or exceeds income.

3. Persistence: financialProfileQube.ts mirrors experienceQube.ts's
   meta(T1)/blak(T0) BlakQube pattern exactly — one new table
   (financial_profile_qubes), service-role-only RLS. Stores ONLY the
   derived aggregates/envelope, never a copy of the raw statement (which
   stays in persona_uploads/persona_upload_index, the one truth store for
   the source documents) — satisfying §5's "no parallel bank_statements
   store" constraint by construction, not by convention.

Two new routes (compute, owner self-view read) and a capability-rail panel
(FinancialProfilePanel.tsx) wired into the existing 'operate' tabGroup —
tabGroups itself is untouched, pinned exactly by
tests/fs-operate-embed-viewport-parity.test.ts. moneypennyCapabilities.ts's
financial-profile item, previously panel: null ("not yet built"), now
points at the real panel.

Not merged to dev — per operator instruction, this stays on
spec/moneypenny-cartridge-upgrade pending explicit approval.

Migration required before this is live:
  supabase/migrations/20260930170000_persona_uploads_financial_document.sql
  supabase/migrations/20260930180000_financial_profile_qubes.sql

## Files Changed

| Change | File |
|--------|------|
| Added | `app/(shell)/moneypenny/components/FinancialProfilePanel.tsx` |
| Modified | `app/(shell)/moneypenny/components/moneypennyCapabilities.ts` |
| Added | `app/api/moneypenny/financial-profile/compute/route.ts` |
| Added | `app/api/moneypenny/financial-profile/route.ts` |
| Modified | `app/api/uploads/route.ts` |
| Modified | `app/triad/components/codex/tabs/MoneyPennyPanelTab.tsx` |
| Modified | `data/codex-configs.ts` |
| Added | `services/financialServices/financialProfileAggregation.ts` |
| Added | `services/iqube/financialProfileQube.ts` |
| Modified | `services/uploads/personaUploadService.ts` |
| Added | `supabase/migrations/20260930170000_persona_uploads_financial_document.sql` |
| Added | `supabase/migrations/20260930180000_financial_profile_qubes.sql` |
| Added | `tests/moneypenny-financial-profile.test.ts` |

## Stats

 13 files changed, 1407 insertions(+), 3 deletions(-)
