# Marketa Activation Engine — Phase 1 + 2 Deployed, Handoff

**Date:** 2026-06-11
**Session branch:** `claude/optimistic-davinci-exiykx` (pushed; auto-merged to dev)
**Story key:** MARKETA-ACTIVATION-PHASE1-2
**Status:** Code complete + validated; awaiting dev DB migration + smoke tests

## What landed

The Codex-built Marketa Activation Engine (Phase 1 candidate spine + Phase 2
integration handoffs), transferred via chat-chunked source packets after the
QubeTalk bridge relay failed (packets never reached `iQube-Protocol/AigentZBeta`),
applied to this repo and corrected per operator mandate.

### Phase 1 — candidate activation spine

- `app/(shell)/marketa/components/activation/MarketaActivationEngineTab.tsx` —
  "Activation Engine" tab inside the existing Marketa cartridge (wired
  surgically into `MarketaCartridge.tsx`; the stale Codex base would have
  regressed the `/api/mvl/partners` fix — avoided).
- `app/api/marketa/activation/` — candidates list/create, detail/PATCH,
  score, import (JSON/CSV), export (JSON/CSV).
- `services/marketa/activation/` — types, defaults, text, policy
  (clean-revenue screen + risk flagger), scoring (configurable weights),
  classification (lanes, verticals, High-Yield Legal vs Polity Legal Aid,
  Exec/Vulnerable persons mobility tagging), normalizers.
- `supabase/migrations/20260610000000_marketa_activation_engine.sql` —
  marketa schema: candidate_agents, candidate_sources,
  candidate_opportunities, activation_events, score_weights.
- `tests/marketa-activation.test.ts` — 6 tests.

### Phase 2 — integration handoffs (all extend existing systems)

| Handoff | Route | Integration |
|---|---|---|
| iQube Registry | `POST .../candidates/:id/registry` | `createAsset`/`getAsset` + `emitReceiptSilent` from `services/registry` — candidate becomes an `AigentQube` asset (full registry cartridge path, not the side-menu surface) |
| Reputation | `GET\|POST .../candidates/:id/reputation` | **RQH ICP canister authoritative** (`getActor` + `rqhIDL`, `RQH_CANISTER_ID`); Supabase `reputation_bucket` cache/mirror fallback; activation score labelled non-authoritative last resort |
| Outreach | `POST .../candidates/:id/outreach` | Draft-only; review-before-send; never auto-sends |
| Passport Bureau | `POST .../candidates/:id/passport` | **NEW — wired to the completed Bureau**: requires registry handoff first; keys on `agent_card_url`; syncs `polity_passport_applications` status + issued `ppp-*` id; otherwise prepares a draft application dry-run through `validateParticipantApplication` without faking the four operator consents |

### Corrections applied (operator-mandated)

1. **RQH is an ICP canister, not a Supabase bucket** — reputation route rewritten.
2. **Passport Bureau is complete** — stub language replaced by live handoff; docs updated.
3. **`classifyLegalTrack` bug fix** — the bare `'legal'` substring matched
   aid-context phrases ("legal clinics"), mislabelling Polity Legal Aid
   candidates as `'both'`; excluded from the high-yield check. This was the
   only test failure in the delivered code (Codex never ran the suite).
4. `app/api/content/entitlements/route.ts` — FIO-handle resolution fix applied.
5. `AGENTS.md` — Golden Rule expansion + `origin/ev` → `origin/dev` typo fix.
6. `PassportIntegrationStub.passportApplicationStatus` union extended with the
   Bureau's real statuses (`needs_more_information`, `denied`, `withdrawn`).

### Validation

- 6/6 `tests/marketa-activation.test.ts`
- 35/35 `tests/passport-bureau.test.ts` (no regression)
- `tsc --noEmit`: zero errors in the new modules
- `git diff --check`: clean
- QubeTalk outbox packet regenerated via `create_packet.py` (deploy-ready)

## Operator actions outstanding

1. **Run the migration on dev Supabase** (SQL editor):
   `supabase/migrations/20260610000000_marketa_activation_engine.sql`
2. **Confirm `RQH_CANISTER_ID`** is set in the dev environment — without it the
   reputation route falls back to the Supabase mirror (labelled in responses).
3. **Smoke tests** after Amplify deploy (create → score → registry → reputation
   → passport → outreach; see Phase 2 notes doc for the workflow).

## Deferred / next session

- Candidate detail drawer + manual add form + activation-status dropdown +
  opportunity tracker panels (Phase 1 UI acceptance items beyond the shipped
  list/scorecard view).
- Marketa daily/weekly activation summary; outreach template library.
- Live Agent Card / MCP / OpenAPI metadata parsing (V1 roadmap).
- Reference docs: `docs/marketa/MARKETA_ACTIVATION_ENGINE_PHASE_PLAN.md`,
  `docs/marketa/MARKETA_ACTIVATION_ENGINE_PHASE2_INTEGRATION_NOTES.md`.
