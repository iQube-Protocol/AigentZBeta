# Marketa opportunities CRUD + passport re-sync diagnostics + pill/scorecard polish

**Date:** 2026-06-11
**Session branch:** `claude/optimistic-davinci-exiykx`
**Workstream:** Marketa golden path (recruiting + revenue) — attack order #1

## Smoke test status

The operator ran both Marketa migrations
(`20260610000000_marketa_activation_engine.sql`,
`20260611100000_marketa_human_mobility.sql`) in Supabase and walked the
full pipeline: Add sample → Score → Registry → Reputation → Passport
prepare → 4 operator consents → Submit to Bureau → Steward approve.
Steps 1–7 all passed; the Bureau issued `ppp-1019155b85d23b73ccf91dd1`.

Step 8 (re-sync in the Activation Engine) appeared to do nothing. SQL
diagnostics showed the Bureau side fully correct (application `approved`,
record issued) but Marketa's stub still `submitted`. Two contributing
factors identified:

1. **Silent error swallowing** — the Bureau-application lookup in
   `app/api/marketa/activation/candidates/[id]/passport/route.ts`
   destructured `{ data }` without the error; a failed lookup fell
   through to the prepare branch, which is a no-op when the stub is
   already `submitted`. Fixed in `9c1c3d89`: errors are logged
   (`[marketa passport sync]`), surfaced in the response note, and the
   sync note now states the Bureau status + passport id explicitly.
2. **Candidate ambiguity** — four near-identically named sample
   candidates exist; the approved application belongs to
   "Example Agent Candidate 1781206694852" (the one with the
   `seed=1781206694852` card URL). Re-syncing a different sample
   correctly reports no change. Awaiting operator retest.

## Opportunities CRUD + revenue roll-up (golden path #1) — `7f405fa9`

The revenue half of the funnel is now operational:

- **API** `app/api/marketa/activation/candidates/[id]/opportunities/route.ts`
  — GET (list), POST (create: description required, type/target/value/
  clean-revenue/policy-risk optional), PATCH (update by `opportunityId`
  in body; status advance, value change).
- **Mechanical roll-up** on every create/update
  (`rollUpRevenue` in `services/marketa/activation/normalizers.ts`):
  open opportunities (proposed/approved/active/paused) sum into
  `estimatedPipelineValue`; completed sum into `closedCleanRevenue`;
  rejected counts nowhere. Written onto the candidate's
  `revenue_tracking` JSONB.
- **Events** — `opportunity_created` / `opportunity_updated` activation
  events per change.
- **UI** — "Opportunities & revenue" panel in the scorecard column:
  add form (description + $), per-opportunity advance
  (proposed→approved→active→completed) and reject buttons, panel-level
  pipeline/closed summary. Cartridge metric grid gains two read-only
  cards: Pipeline value + Closed revenue summed across all candidates.
- **Tests** — `rollUpRevenue` math + `opportunityInputToDb`
  normalization added to `tests/marketa-activation.test.ts` (12 pass).

## Pill + scorecard design tweaks (operator request) — `c1ad7958`, `7f405fa9`

- **`components/ui/badge.tsx`** now uses `cn()` merge (mirroring
  Button) + `whitespace-nowrap` base. Root cause of the "solid white
  pills": raw string concat let the variant's `bg-primary` beat custom
  glass backgrounds depending on generated CSS order. Pills are also
  single-line by definition now.
- Scorecard action buttons (Score/Registry/Rep/Passport/Draft) moved to
  a single horizontally-scrollable row above the candidate name;
  "Clean revenue + Passport readiness" subheader inline with the
  Scorecard heading.
- Header toolbar is a single non-wrapping row so Add sample always sits
  right of Import.
- Candidate-card status pills get `shrink-0` (full width, one line);
  remaining solid slate badge fills swapped for glass treatment.

## Next (golden path attack order)

2. Outreach send via existing Marketa send path + reply-flip hook —
   **blocked on operator decision**: reuse campaign Mailjet adapter or
   dedicated activation sender?
3. Revenue attribution per source/lane — **blocked on operator
   decision**: what counts as Marketa revenue (subscription / per
   qualified intro / per closed opportunity)?
4. Discovery automation; 5. Template library.

Plan: `docs/marketa/MARKETA_GOLDEN_PATH_PLAN.md` (updated this session).
