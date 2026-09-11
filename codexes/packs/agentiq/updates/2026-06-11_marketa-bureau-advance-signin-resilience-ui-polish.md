# Marketa Activation → Passport Bureau advance flow, sign-in resilience, UI polish

**Date:** 2026-06-11 (second session segment, after the deployment handoff doc)
**Branch:** `claude/optimistic-davinci-exiykx` → auto-merged to `dev`
**Commits:** `20e8a01e`, `8f952f6e`, `ea4e47df`, `2f388b59`, `1b8a947d`, `b329ed10`, `9024fb54`

## Incident: platform-wide sign-in failure (resolved)

Sign-in hung on "Signing in…" across the platform. Root cause was **not code**:
the Supabase project (`bsjhfvctmduxhohtllly`) was down — Cloudflare returned
HTTP 522 (origin unreachable) on `/auth/v1/token`, and server routes hit
20–28s 500/504s on DB queries. Operator restarted the project; recovered.

Hardening shipped while diagnosing (`20e8a01e`):
- Both SmartWalletDrawer sign-in handlers lacked try/catch — a thrown
  `signInWithPassword` (network failure) left the button stuck forever with
  no message. Now surfaces the real error.
- `consolidateIdentity` got an 8s abort, `/api/wallet/personas` a 12s abort,
  plus console diagnostics throughout `useSupabaseSessionPersonas`.

Known UX trap noted for a future session: the Passport Bureau sign-on uses the
same Supabase client singleton as native sign-in, so a Bureau sign-in REPLACES
the operator session app-wide. Not the outage cause, but worth a warning UI.

## Activation Engine: candidates now advance into the Bureau steward queue

The pipeline previously dead-ended at "draft prepared, consents pending."

- `POST /api/marketa/activation/candidates/:id/passport` accepts
  `{ action: "submit", consents }`. All four mandatory Bureau consents must be
  explicitly true — given by the HUMAN operator via checkboxes in the
  scorecard. The route forwards the prepared application through the Bureau's
  own machine surface (`/api/polity-passport/submit`) so its open-app check,
  insert, and receipt pipeline apply unchanged. Marketa never consents on
  anyone's behalf; the operator is recorded as consent actor.
- Submitted applications appear in the Bureau cartridge → Steward queue.
  Clicking Passport again re-syncs status (and issued `ppp-*` id) back.
- Agent card editor in the scorecard (Save when missing, Replace when set) —
  the Bureau anchors participant identity on `agent_card_url`.
- Samples now carry **resolvable** agent card data: new public route
  `GET /api/marketa/activation/sample-agent-card?seed=N` serves real
  A2A-shape Agent Card JSON; "Add sample" mints a unique card URL per click
  (one open Bureau application per card URL).
- Tooltips on every Activation Engine button.
- `human_mobility` classification now persists on score (was computed and
  dropped — scorecard always showed the empty default).

## Smoke script

`scripts/smoke-marketa-activation.mjs --host=dev-beta.aigentz.me`
Steps: list (migration check) → create → card resolves → score → registry →
reputation (source provenance) → passport prepare → **operator-consented
submit (6b)** → outreach draft → export. Exits non-zero on first failure.

## UI polish

- Global cartridge chrome: tier-2 tab labels 12→13px, tier-3 sub-tabs
  11→12px (separate-row variant 10→11px). Tier-4 unchanged.
- Passport Registry class filters moved into the cartridge sub-menu bar via
  `SubHeaderSlotContext` portal (Apply's 5-step strip stays in-body — it is a
  stateful wizard, per operator).
- Marketa accent: rose → light faint pink, all solid blocks converted to
  liquid glass (`bg-pink-400/20` + border + backdrop-blur) across 21
  surfaces. `MARKETA_CARTRIDGE.metadata.color = 'pink'` with a Tailwind JIT
  safelist comment for the dynamic chrome classes. Danger states
  (rejected/do_not_contact, error banners) intentionally kept red-family.

## Approved next phase (gated on operator smoke test)

**Phase A — passport credential envelope** (operator picked option 2,
"after we smoke test"): Bureau approval generates a signed credential
envelope (W3C-VC-shaped) persisted alongside `polity_passport_records` and
returned at claim time — the artifact the agent actually HOLDS. Foundation
for the subsequent phases discussed:
- **@aigent FIO handle** minted at passport acceptance (`<ref>@aigent`,
  human-readable; keypair issuance stubbed initially, self-custody blakQube
  envelope at claim in a later phase)
- persona_id ↔ passport binding lives in a private blakQube the agent may
  withhold under bounded delegation
- "aigent" as the brand class for polity-compliant passported agents
  (`polity_passported_agent` badge; spine `evaluateAccess` gating)

Open operator decisions before Phase C: VC signing key custody (Bureau KMS
vs IC canister identity) and @aigent FIO domain reservation.

## Outstanding operator actions

1. Run both pending migrations in the dev Supabase SQL editor:
   `supabase/migrations/20260610000000_marketa_activation_engine.sql`, then
   `supabase/migrations/20260611100000_marketa_human_mobility.sql`
2. Confirm `RQH_CANISTER_ID` is set in Amplify env (else reputation reports
   `activation_score_fallback`)
3. Smoke test: `node scripts/smoke-marketa-activation.mjs --host=dev-beta.aigentz.me`
4. Verify a submitted sample appears in Bureau → Steward queue; approve it;
   re-click Passport in Marketa to sync the issued id
5. Greenlight Phase A
