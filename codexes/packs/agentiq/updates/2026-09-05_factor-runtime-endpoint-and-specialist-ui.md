# Factor runtime endpoint, Journey Spine rehearsal, and Factor/Aegis specialist UI (2026-09-05)

Closes the operator's narrow follow-up sequence after the live provisioning milestone.

## 1-3. Factor's runtime descriptor

Added `app/api/agents/factor/invoke/route.ts` and `.../aegis/invoke/route.ts` (mirroring
`app/api/agents/nakamoto/invoke/route.ts` exactly — delegate to the existing ask-agent/
specialistRouter path, specialistId pinned). Seeded `registry_assets.metadata.runtime` for
`aigentqube-factor` (migration `20260905040000_factor_runtime_endpoint.sql`, applied live) pointing
at the new invoke route + the existing health route.

**Verified live:**
- Factor's Agent Card now projects the runtime block (already-wired `resolveRuntime()` from the
  identity-provisioning pass needed no further change).
- Horizen preflight's "Runtime endpoint descriptor" check moved from `BLOCKED` to
  `ALREADY_COMPLETE`.

Aegis's own invoke route exists (for specialist consultation) but was deliberately NOT seeded into
`registry_assets` — it is not a Horizen pilot-journey participant.

**Real bug found and fixed along the way:** `app/api/assistant/ask-agent/route.ts`'s
`VALID_SPECIALISTS` allowlist never included `'factor'`/`'aegis'`, so both new invoke routes would
have rejected every real call with `invalid-specialist` despite being fully wired. Fixed
immediately, since the routes were already deployed. Also widened `SpecialistResponseCard`'s
`specialistId` prop from a stale, hand-copied 6-value union to the canonical `SpecialistId` type
(`services/agents/specialistRouter.ts`) — it was already missing moneypenny/metaye/researcher/
aletheon before today, not just factor/aegis.

## 4. Journey Spine rehearsal (read-only, no signing)

`GET /api/journey/moneypenny-horizen/state?agentSlug=factor` against the live host confirms:
`currentStageId: "register"`, `state: "IN_PROGRESS"`, evidence present (`aigentQubeResolved`,
`agentCardResolves`), evidence missing is exactly the signing/broadcast-dependent set (`tokenId`,
`principalRegistrationMandateSigned`, `agentRegistryTransactionSigned`,
`horizenRegistrationSubmitted`, `horizenRegistrationConfirmed`, `agentRegistryBindingRecorded`).
Every downstream stage (claim, orient, passport, activate, delegate, aigentme, verify) correctly
reports `BLOCKED`, waiting on Register. This IS the rehearsal through the pre-broadcast boundary —
`register/mandate/prepare` (the actual signing-ceremony entry point) was deliberately never called;
it requires a live authenticated operator wallet session, which is a human act by design, not
something this session invoked on the operator's behalf.

## 5. No broadcast

No signing request was created, no mandate was prepared, no transaction was broadcast. Base Sepolia
registration remains a separate, explicit operator act.

## 6. MoneyPenny specialist UI — first slice

Added `app/(shell)/moneypenny/components/CandidateIntakePanel.tsx` — the first operator-facing UI
for Factor/Aegis. Deliberately thin: calls the same `/api/assistant/ask-agent` path (via
`personaFetch`, per CLAUDE.md's spine-fetch rule) every other specialist consultation uses, renders
with the same `SpecialistResponseCard` every other specialist response renders with. Wired as a new
`candidate-intake` panel key, in the Operate capability group (alongside Service Orchestration —
candidates awaiting admission vs. already-admitted agents), landing in the Activity area.

Advisory only, matching the real backend contract: never mutates a candidate case or an assessment.
Factor's/Aegis's own case-management REST surfaces (`app/api/moneypenny/factor/cases`, `.../aegis/
assessments`) still have no dedicated UI — a real next slice, not built here.

Aegis remains outside `services/horizen/registrableAgents.ts` (not a pilot-journey participant) and
outside `registry_assets.metadata.runtime` (no Horizen runtime descriptor) — both deliberate, per
the operator's explicit boundary — while being fully callable as a MoneyPenny specialist via its
own invoke route and this new panel.

## Verification

`npx tsc --noEmit` — 680 errors before and after every change (baseline unchanged, confirmed at each
step). Full `npx vitest run` — same 15 pre-existing failing test files, zero new failures. New tests:
7 (Factor/Aegis invoke routes), 2 (ask-agent allowlist fix), 8 (Candidate Intake panel + wiring) —
all pass. Full interactive browser verification of the new panel was not possible from this session
(the panel requires a live authenticated persona, which this sandboxed session does not have) —
flagged honestly rather than claimed.

Deployed to `dev` in two pushes (`7020465ff→3e6e4012f`), confirmed live via direct calls to
`dev-beta.aigentz.me`.
