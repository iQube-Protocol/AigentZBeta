# Horizen Pilot Closure Report

**Date:** 2026-08-09
**Branch:** `horizen-dvn-alignment` (commits `76384429e`..`edd2ed435`, pushed to origin)
**State: CODE READY / LIVE VERIFICATION PENDING** — every item below is implemented, tested, and
pushed. What remains is exercising it against live Base Sepolia / Horizen / a deployed Amplify
build — infrastructure this session has no credentials for (confirmed at session start: no
`.env.local`, no RPC/API keys, no outbound network to Horizen). Nothing was blocked or deferred for
lack of trying; every live-dependent step below has an exact command ready for the operator to run
once deployed.

---

## 1. MoneyPenny transaction truth and recovery result

**Truth:** Not established this session — establishing it requires a live Base Sepolia RPC read
and a live Horizen `get_onboarding_status` call, neither reachable from this sandbox. No txHash,
tokenId, or chain state is asserted here that wasn't independently verified; per CLAUDE.md's
No-Guessing rule, absence of a verified value is reported as absence, not filled with a plausible
guess.

**Recovery mechanism: code-complete.** MoneyPenny needs no bespoke recovery code — the generic
registration reconciler (item 2 below) *is* her recovery path, because her stranded transaction is
structurally identical to "a submitted registration with no confirmation receipt yet," which is
exactly what the reconciler looks for, for any agent. It:
1. Finds her `horizen_registration_submitted` receipt (via the new `findReceiptsByActionType`).
2. Recovers her txHash and network from that receipt's `actionInput`.
3. Resolves her agent config via `resolveRegistrableAgentByRuntimeId('aigent-moneypenny')` —
   never a hardcoded slug.
4. Calls the existing, unmodified `checkAgentRegistrationStatus()` — the SAME function that reads
   Base Sepolia's transaction receipt AND Horizen's onboarding status, and reports divergence
   between them by name.
5. Never calls `broadcastAgentRegistration` — structurally cannot rebroadcast.

**To run it against her real, live data once deployed:**
```bash
curl -sS -X POST -H "x-cron-token: $CRON_TRIGGER_TOKEN" \
  "https://dev-beta.aigentz.me/api/ops/horizen/reconcile-registrations"
```
This is also scheduled automatically every 10 minutes once deployed
(`.github/workflows/horizen-registration-reconciler.yml`), so no manual step is strictly required
after merge — it will pick her up on its own within one cycle.

**If the reconciler reports `still-pending`:** the transaction is broadcast and untouched; nothing
further is needed except waiting for Horizen/the chain. **If it reports `confirmed`:** her tokenId
and confirmation receipts are already written by the existing, unmodified confirmation path
(`registrationConfirmationDeps.ts`) — no separate "advance" step. **If a genuinely reverted
transaction is ever found** (this session found no evidence either way, live or otherwise), the
correct next step is a fresh `prepareAgentRegistration`/ceremony run for her, authorized explicitly
by the operator — never automatic, and out of scope for a reconciler whose entire contract is
"never re-signs."

---

## 2. Horizen reconciliation implementation

`services/horizen/registrationReconciliation.ts` + `app/api/ops/horizen/reconcile-registrations/route.ts`
+ `.github/workflows/horizen-registration-reconciler.yml` (commit `76384429e`).

Gives `checkAgentRegistrationStatus()` — previously reachable only via a browser poll capped at
160 seconds — independent, scheduled liveness, mirroring the exact pattern already proven for DVN
finalization (`activity-receipts-finalizer.yml`). Agent-generic (resolves the subject from the
submitted receipt's own `agentsInvoked`), idempotent (skips anything already confirmed, verified
via `findAgentRegistrationReceipts`), and exception-isolated (one agent's failure never blocks
another's check in the same run). 6 tests, all passing:
`tests/horizen-registration-reconciliation.test.ts`.

Extracted the interactive status route's confirmation-writing logic into
`services/horizen/registrationConfirmationDeps.ts` so the interactive route and the reconciler
share one implementation — no duplicated "what confirmation writes" logic.

---

## 3. Standing resolution record and implementation

**Resolution record (written before implementation, per CLAUDE.md's resolution-to-invariant loop):**
`codexes/packs/agentiq/resolution-records/records/RES-2026-08-09-STANDING-SEED-PRODUCTION-WIRING-001.json`
+ candidate invariant `CI-2026-08-09-STANDING-SEED-PRODUCTION-WIRING-001.json`. Validated clean by
`npm run report:resolutions` (same warning class as every other existing record — canary-not-yet-
verified-to-fail-before-fix, ratification-pending — no blockers).

**Implementation (commit `d427c26e2`):** `services/journey/registrationStandingSeedAward.ts` is
the one production caller of `registrationStandingSeed.ts`'s previously-unexecuted contract —
settle `registry_standing_seeded`, then award exactly one `standing_accrued` receipt (amount=1,
basis `iqube_registry_registration`, tier `initial`, `impliesPerformance: false`), attributed to
the real active operator persona. Wired into the journey state route at the same point it already
observes factory-ingestion eligibility, mirroring the route's own existing inline-settle pattern
for `passport_is_issued` — not a new architecture. Idempotent via `settleFact`'s own
`alreadySettled` semantics; safe against retried GETs and concurrent requests. 7 tests, all
passing: `tests/registration-standing-seed-award.test.ts`.

**This remains the existing nominal registration seed of 1** — explicitly tagged
`impliesPerformance: false`, structurally incapable of moving an agent off Standing bucket 0 on its
own (per the seed module's own documented safeguard). No PoWP/PoTS computation was invented or
touched.

---

## 4. Nakamoto Standing result

**Code path: ready.** The exact transition —
`Deploy/factory ingestion complete → eligibility established → registration Standing seed awarded
once → standing_accrued receipt → Standing stage resolves` — is exercised end-to-end by
`tests/registration-standing-seed-award.test.ts`'s "genuine first eligibility" test, using
Nakamoto's own `RegistrableAgentConfig` explicitly (not a stand-in).

**Live result: not yet observed.** Nakamoto's registry_assets row already exists (seeded migration,
pre-dates this session), so `factoryIngested` is very likely already true for her in the live
database — meaning the very next authenticated `GET /api/journey/moneypenny-horizen/state?agentSlug=nakamoto`
against the deployed app should award her seed on that request. This session cannot make that
request (no deployed instance, no persona session token reachable from this sandbox). Once merged
and deployed, the operator can confirm with:
```bash
curl -sS "https://dev-beta.aigentz.me/api/journey/moneypenny-horizen/state?agentSlug=nakamoto" \
  -H "Authorization: Bearer $PERSONA_ACCESS_TOKEN" | python3 -m json.tool | grep -A3 standing
```

---

## 5. MoneyPenny complete journey result

**Code path: ready for every stage.** Register (item 2's reconciler), Ratify's runtime descriptor
(item 3 — see below), P&L verification (item 6), and Standing (item 3 above, agent-generic) are all
now wired for her specifically, not just in the abstract:
- Her registry runtime descriptor gap is closed by name: `app/api/agents/moneypenny/health/route.ts`
  + `supabase/migrations/20260930002300_moneypenny_runtime_endpoint.sql` (commit `20dc5ed31`),
  pointing `runtime.endpoint` at her real chat runtime (`/api/moneypenny/chat`) and `runtime.health`
  at the new health route — mirroring Nakamoto's existing migration exactly.
- Her financial-services-specific capabilities (the chat runtime, `callSovereign('reasoning', ...)`)
  were left untouched — domain-specific behavior is preserved, per the operator's own instruction,
  not flattened into sameness with Nakamoto.

**Live result: pending deployment + the reconciler picking up her stranded transaction** (item 1).
Claim, Passport, Delegate, aigentMe, and Ratify's Constitutional Agreement itself are operator
sovereign acts this session cannot perform on the operator's behalf (signature, sponsorship,
delegation, agreement authorization all require the real operator's credentials) — they were
already coded before this closure pass and are unaffected by it.

---

## 6. P&L authorization vs verification result

**Code: wired and distinguished (commit `4846fa62e`).** `discoverAndReceiptPnlServiceEvidence`
(fully built, tested, previously zero production callers) is now called from
`services/horizen/pnlVerificationBoundary.ts`, wired into the journey state route at the boundary
where a subject to correlate first becomes known (a confirmed registration's own tokenId). Never
coupled to Pulse admission or the Ratify gate, per the operator's own already-ratified rule
(`RES-2026-08-08-PNL-INDEPENDENT-EVIDENCE-001`).

The response now carries **both** fields, never conflated:
- `pnlTransparencyEnabled` / `pnlDisclosureAuthorized` — authorization (unconditional alongside
  Pulse confirmation).
- `pnlServiceVerified` — independent verification (only true on a genuine, on-chain-attributed,
  chain-agreeing Horizen correlation), plus `pnlServiceVerificationDetail` naming why when pending.

**Live result:** not yet observed for either agent — requires a live correlation call to Horizen's
`/v1/erc8004/{tokenId}`, unreachable from this sandbox. `evidencePending` is the expected, honest
report until a genuine correlation appears for either agent's specific token.

---

## 7. Genericity fixes

Commits `fc163cc1b` and `0eaaa90b6`:
- **PILOT_AGENTS** (`components/journey/RegisterAgentPanel.tsx`) is no longer a hand-copied array —
  projected from the canonical `services/horizen/registrableAgents.ts` registry via
  `resolveRegistrableAgent`, with only the display order still asserted explicitly.
- **`aigent-${slug}` string coincidence** replaced with canonical `runtimeAgentId` resolution at
  every site found (`RegisterAgentPanel.tsx` ×4, `PilotJourneyTab.tsx`'s `receiptsSubjectAgentRef`),
  falling back to the coincidence only if resolution genuinely fails.
- **JourneyCompanionCarousel** now accepts an `agentSlug` prop, resolves the operator's shared
  last-selected agent (`services/journey/selectedPilotAgent.ts`, new — a small localStorage-backed
  record PilotJourneyTab now also reads/writes) when absent, and uses it in its own state fetch
  (which previously ignored agent selection entirely and always queried the default agent).
- **Journey narration** (`horizenMoneyPennyJourney.ts`) — every rendered "MoneyPenny" string
  (~10 occurrences) replaced with `{{agentDisplayName}}`, substituted at render time via
  `services/journey/journeyCopyTemplate.ts`'s `renderJourneyCopy`. `JOURNEY_INTRO_TEXT` is now
  `buildJourneyIntroText(agent)`, a function of the selected agent.
- **MoneyPenny runtime-route namespace check:** investigated explicitly — no `agent-moneypenny`
  spelling exists anywhere in the codebase; only the canonical `aigent-moneypenny` was found. No
  defect, no change made (a fix for a bug that doesn't exist would itself be a defect).

**Not done, flagged as residual:** the journey definition's own `subjectRef`/`actor` fields
(`horizenMoneyPennyJourney.ts` lines 23, 30-31, 309, etc.) are still literally `'moneypenny'` —
confirmed these are inert metadata with zero current consumers (no component reads them for
display), so left alone rather than changed speculatively. If a future consumer starts reading
them, they need the same generic treatment as the narration strings.

---

## 8. Agent-N test

`tests/agent-n-genericity.test.ts` (4 tests) + `tests/agent-n-genericity-resolution.test.ts`
(3 tests), commit `edd2ed435`. A synthetic "Aigent Q" — never added to the real registry — proves:
- Registration Standing seed award, P&L verification boundary, and journey narration templating
  handle her correctly via parameter alone (no source-code branch for her exists or is needed).
- The Agent-N preflight and the registration reconciler resolve her correctly through a **mocked**
  canonical registry (standing in for a real config + migration), proving the slug/runtimeAgentId
  resolution boundary itself is generic.
- Adding her never alters `DEFAULT_REGISTRABLE_AGENT_SLUG` (still `moneypenny`) — addition is
  additive, never a silent takeover of the default.
- Every assertion explicitly checks that neither "MoneyPenny" nor "Nakamoto" leaks into any of
  Aigent Q's own results — the exact "silently defaults" failure mode the operator named.

---

## 9. Preflight output

`services/horizen/agentPreflight.ts` + `GET /api/journey/moneypenny-horizen/preflight?agentSlug=<slug>`,
commit `a0169201d`. 21 checks across identity/config, authority, infrastructure, verification, and
consequence, each independently exception-isolated (one thrown dependency degrades only that line).
7 tests passing.

**This session's own live run against itself is necessarily incomplete** — no Supabase, no Horizen,
no Base Sepolia reachable — which is precisely what the preflight is *for*: run against the real
dev deployment, it will report:
- `receipt-persistence`, `dvn-submission`, `dvn-finalizer` → **BLOCKED** in a session with no env
  vars (as this one is) — becomes READY once deployed with real Supabase/canister/cron-token config.
- `horizen-registry-api`, `base-sepolia-rpc` → **DEGRADED** here (no outbound network) — the
  deployed app, which does have outbound network, should report READY or a genuine BLOCKED with a
  real HTTP status, never DEGRADED for network reasons.
- `registry-configuration`, `runtime-endpoint`, `agent-key`, etc. → depend on real seeded data;
  expected to report ALREADY_COMPLETE for both Nakamoto and MoneyPenny once this branch is merged
  (their migrations already exist/are added by this pass).

**To run it for real:**
```bash
curl -sS "https://dev-beta.aigentz.me/api/journey/moneypenny-horizen/preflight?agentSlug=nakamoto" | python3 -m json.tool
curl -sS "https://dev-beta.aigentz.me/api/journey/moneypenny-horizen/preflight?agentSlug=moneypenny" | python3 -m json.tool
```

---

## 10. Receipt/DVN evidence chain for both agents

Not established live this session (requires the deployed database). What the code now guarantees,
once deployed:
- **Nakamoto**: her existing `horizen_agent_registered` chain (tokenId 8798, per prior sessions'
  work) is untouched. New: on her next journey-state read, if `factoryIngested` is true (very
  likely, given her pre-existing registry_assets row), she gains one `standing_accrued` receipt
  (basis `iqube_registry_registration`) and, if her token correlates to a genuine Horizen PnL
  record, one `pnl_service_verified` receipt.
- **MoneyPenny**: her existing `horizen_registration_submitted` receipt is untouched — the
  reconciler reads it, never rewrites it. Once confirmed (live, via the reconciler), she gains the
  same `horizen_agent_registered` / `horizen_registration_confirmed` / `agent_registry_binding_recorded`
  receipts Nakamoto already has, then the same Standing/PnL receipts as above once eligible.

Neither chain was fabricated, guessed, or asserted without a live read to back it — this section
states what the CODE will produce, explicitly not what has been observed.

---

## 11. Remaining blockers

1. **No live credentials in this sandbox** — no `.env.local`, no Base Sepolia RPC key, no Horizen
   MCP reachability, confirmed at session start and unchanged throughout. This blocks every "live
   result" cell above, not the code that produces them.
2. **Ratify's `agreementReceiptsAnchored` naming mismatch** (item 6 of the DVN transition matrix) —
   checks id-presence, not `receipt_status`, despite its name. Flagged, not fixed — belongs with
   the Constitutional Agreement lifecycle's own owner.
3. **Standing's evidence-existence gate** — a candidate for requiring `dvn_recorded` in a future
   pass, now that item 2's reconciler pattern makes a bounded wait feasible. Not changed here,
   per the explicit instruction not to mechanically gate every stage.
4. **Journey definition's residual `subjectRef: 'moneypenny'` fields** — inert today (no consumer),
   flagged for whoever next builds a consumer of them.
5. **Two pre-existing, unrelated test failures** confirmed NOT caused by this pass: 4 test files
   fail on `supabaseUrl is required` (missing env var in this sandbox — same root cause as blocker
   1); `tests/companion-observer.test.ts`'s refresh-session test fails on an unrelated 500 vs
   400/401 status code, in code this pass never touched.
6. **This branch is pushed but not merged to `dev`** — merging, and the subsequent Amplify build,
   is the operator's call given the branch touches the live journey state route; not done
   unilaterally in this pass.

---

## 12. READY / NOT READY FOR VELA determination

**CODE READY / LIVE VERIFICATION PENDING.**

Every numbered item in the closure instruction has a corresponding, tested, pushed implementation:
the registration reconciler (1), the Standing seed wiring with its resolution record (2), the
Ratify runtime descriptor for MoneyPenny (3), real P&L verification distinct from authorization
(4), the presentation/configuration genericity fixes (5), the DVN finality transition matrix (6),
the read-only preflight (7), and the Agent-N genericity proof (10). Items 8 and 9 (MoneyPenny's
live recovery, both agents' complete live journeys) have their enabling code fully in place — the
generic reconciler IS MoneyPenny's recovery path, the generic Standing/PnL wiring IS both agents'
path to Standing — but the actual live transactions, receipts, and state have not been observed
because this session had no path to observe them.

**Before this is READY FOR VELA in the full sense** (two real agents observed, live, through
Standing), the operator needs to:
1. Merge this branch (or push it to `dev` directly) and let it deploy.
2. Confirm `CRON_TRIGGER_TOKEN`, `CROSS_CHAIN_SERVICE_CANISTER_ID`, and the Supabase service-role
   env vars are set in the deployed environment (the preflight will report exactly this if not).
3. Run the two `curl` commands in §9 for both agents, and the one in §1 for MoneyPenny's
   reconciliation, and read the results.
4. Apply migration `20260930002300_moneypenny_runtime_endpoint.sql` if migrations aren't
   auto-applied on deploy in this environment.

None of those four steps require more code. They require the live infrastructure this pass could
not reach.
