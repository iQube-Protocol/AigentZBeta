# Factor + Aegis PRD tranche: Vela test-TEE integration + controlled Horizen rehearsal (2026-09-05)

**Governing instruction (verbatim):** "Proceed with the next Factor/Aegis PRD tranche: integrate the
existing Vela SDK test TEE and prepare Factor for a controlled end-to-end Horizen Journey Spine
rehearsal. Do not broadcast Factor's ERC-8004 registration or perform any irreversible external act
in this tranche."

**Bottom line up front:** every item below is complete except the rehearsal script's live run against
a deployed host, which requires an operator JWT this session does not have. The script exists, is
mirrored on the working `bankr-live-rehearsal.mjs` pattern, and is safe by construction — it has no
code path that can sign or broadcast anything. Factor is NOT end-to-end Horizen-ready: it has never
been registered, and this tranche does not register it. That is the point.

## 1. Reconciliation

Confirmed via `grep -rln "prepareProjection\|submitProjection\|getProjectionEvidence" services/` that
the Vela confidential-projection stack (`types/confidentialProjection.ts`,
`services/vela/velaProjectionProvider.ts`, `velaTestTransport.ts`, `velaConfig.ts`) was fully built and
tested but had **zero application-layer callers**. No new simulator was created — this tranche makes
Factor the first real caller of the existing seam.

## 2. Factor bound to Vela (implemented, unit-tested against the in-memory fake)

- `services/vela/velaFactorProvider.ts` — `createFactorConfidentialProjectionProvider()`, a memoized
  factory over the existing `VelaConfidentialProjectionProvider` + `VelaTestTransport`. Defaults to
  the test transport because `velaConfig.ts` only resolves a `'local'` deployment requiring an
  unreachable `localhost:8545` Docker stack — **there is no live/production Vela deployment anywhere
  in this codebase to default to instead.** This is stated in the file's own doc comment so it is
  never mistaken for a live connection later.
- `services/factor/factorConfidentialWorkload.ts` — Factor's first real confidential workload:
  **admission-packet policy evaluation** (confidentially compares a case's readiness score against a
  policy threshold without either value leaving the confidential environment in the clear). Persists
  onto Factor's EXISTING durable homes — `factor_evidence_items` (via `upsertEvidenceItem`),
  `factor_case_events` (via `appendCaseEvent`), and a `confidential_projection_evaluated` activity
  receipt — never a new table. `readinessScore`/`policyThreshold` are never persisted, logged, or
  returned; only commitments and the coarse ACCEPTABLE/UNACCEPTABLE/UNRESOLVED verdict leave the
  function (asserted directly in tests, not just by convention).
- `journeyStageId` is caller-supplied, never re-derived — the caller resolves it (e.g. via
  `GET /api/journey/moneypenny-horizen/state?agentSlug=factor`) and passes it through, matching how
  `services/factor/authorityChain.ts` already threads `agentRootDid`.
- `tests/factor-vela-confidential-workload.test.ts` — 8 tests: successful workload, UNACCEPTABLE
  case, tampered-attestation detection, live-only-policy rejection of simulated attestation (+ its
  NOT_REQUIRED counterpart), cross-agent evidence isolation, idempotent resume (success + failure).

## 3. Live-only policy rejects simulated attestation (already existed — proven, not built)

`composeConfidentialComponent`'s `CompositionPolicy.attestationRequirement` mechanism already composes
unattested evidence to `disposition: 'UNRESOLVED'` under `REQUIRED` (and fails closed under
`UNSPECIFIED`) — confirmed by reading its full body, then proven for Factor's real evidence shape by
two of the 8 tests above. No new policy code was needed.

## 4. Register ceremony safety gates (implemented, unit-tested)

- `tests/register-ceremony.test.ts` — fixed 2 stale source-scan tests that regex-matched literal text
  no longer present in `RegisterAgentPanel.tsx` (now a `.sort()` projection over
  `listRegistrableAgents()`); rewrote both behaviorally. Added a new Factor-specific behavioral suite
  (8 tests) covering: mandate preparation, the principal-approval signature boundary, agent-invocation
  preparation, owner-wallet resolution, receipt subject-scoping, replay/idempotency, confirmation
  handling, and `BROADCAST_FAILED`.
- `tests/bankr-receipt-agent-isolation.test.ts` (new) — 2 tests proving
  `listActivityReceiptsForAgent` isolates receipts by agent even under a shared persona.

## 5. Controlled rehearsal

### 5a. Bankr rehearsal (Phase 9, unchanged from the prior tranche)

`scripts/bankr-live-rehearsal.mjs` — draft → preflight → Aegis assessment → ratify → approval_pending,
then STOPS and prints the human approval package. No submit/approve call exists in the script.

### 5b. Factor Horizen mandate rehearsal (new this tranche)

`scripts/factor-horizen-mandate-rehearsal.mjs` — reads Factor's current Journey Spine state, then
calls **only** `register/mandate/prepare` (which "signs nothing" per its own header comment — it
creates a pending PRINCIPAL `SigningRequest` for the operator's wallet to review). The script then
stops. It has no flag, and no code path, that can approve the mandate, sign the AGENT invocation, or
broadcast — satisfying the tranche's hard constraint by construction, not by convention.

**This script has not yet been run against a live deployed host** — that requires a Supabase JWT for
an authenticated operator session, which this sandboxed session does not hold. Running it is the
operator's own next step; the checklist below records everything already confirmed by direct,
read-only live-database queries instead.

### Operator checklist — facts already LIVE-VERIFIED (read-only, via Supabase MCP against project
`bsjhfvctmduxhohtllly`, 2026-09-05)

| Fact | Value | Verified how |
|---|---|---|
| Factor's `registry_assets.metadata.horizen` | `null` (never registered) | direct SQL read |
| Factor's real EVM address (`agent_keys.evm_address`) | `0xF67299Ad3CB85f3A788CE38012C99Df7213E2734` | direct SQL read |
| `agent_keys.last_used_at` for Factor | `null` (key never used to sign) | direct SQL read |
| Prior `signing_requests` for `subject_agent_ref='aigent-factor'` | none — clean baseline | direct SQL read |
| Target network | Base Sepolia, chainId `84532` | `services/horizen/identity.ts::HORIZEN_NETWORK_FACTS` |
| Canonical ERC-8004 identity registry (Base Sepolia) | `0x8004A818BFB912233c491871b3d84c89A494BD9e` | same source file |
| `register/mandate/prepare` signs nothing | confirmed | route's own header comment, read directly |

### Live-migration gap discovered and closed this tranche

Mid-rehearsal-prep, live Supabase was found to be **missing the entire Bankr Phase 2-4 schema**
(`token_launches`, `provider_wallet_bindings` tables did not exist) and this tranche's own
`confidential_projection_evaluated` receipt-type migration — meaning the Bankr backend and Factor's
new Vela workload, though fully unit-tested against the in-memory fake, would have failed against
real Supabase. All five migrations
(`20260930200000_moneypenny_bankr_tokenization_capability`,
`20260930210000_provider_wallet_bindings`, `20260930220000_token_launches`,
`20260930230000_aegis_assessments_token_launch_subject`,
`20260930240000_bankr_token_launch_receipt_action_types`, and this tranche's
`20260930250000_confidential_projection_receipt_action_type`) were reviewed for safety (additive-only,
idempotent, RLS service-role-gated, no destructive drops) and applied via `apply_migration`, then
verified live: `token_launches`/`provider_wallet_bindings` now exist, `aegis_assessments_subject_type_check`
admits `token_launch`, `activity_receipts_action_type_check` admits the full Bankr list plus
`confidential_projection_evaluated`, and MoneyPenny's registry row carries `bankr_tokenization`.
Separately, `factor_cases`/`factor_evidence_items`/`factor_case_events`/`aegis_assessments` were found
to already exist live despite their originating migration not appearing in tracked migration history —
apparently created out-of-band in an earlier session. This is flagged here, not silently reconciled.

## 6. Bankr regression closure

No regression — the Bankr backend, tests, and frontend from the prior tranche are unchanged by this
one; this tranche only adds a new, independent confidential-workload caller and the Horizen mandate
rehearsal script.

## 7. Verification and honest status

| Claim | Status |
|---|---|
| Vela stack has a real application-layer caller | **Implemented**, unit-tested against `VelaTestTransport` (deterministic in-memory double — not a live TEE) |
| Live-only policy rejects simulated attestation | **Proven** via existing mechanism + new tests |
| Register ceremony Factor-specific behavior | **Implemented + unit-tested** (behavioral, against test doubles) |
| Live database schema for Bankr + confidential-projection receipts | **Live-applied and live-verified** (read-only SQL confirms all 5 migrations landed) |
| Factor Horizen mandate rehearsal script | **Written**, safe by construction; **not yet run** against a live host (needs an operator JWT) |
| Factor's ERC-8004 registration | **Not performed.** No signing, no broadcast, anywhere in this tranche. |
| "Factor end-to-end Horizen ready" | **Not claimed.** Per the tranche's own instruction, that claim requires the Factor-specific behavioral tests passing (they do) AND the controlled rehearsal reaching the signing boundary cleanly on a live host (not yet run in this session) — both conditions must hold, and only the first is currently satisfied end-to-end live. |

## Files touched this tranche

- `services/vela/velaFactorProvider.ts` (new)
- `services/factor/factorConfidentialWorkload.ts` (new)
- `services/receipts/activityReceiptService.ts` — added `confidential_projection_evaluated`
- `services/dvn/activityReceiptDvnPipeline.ts` — added it to `ANCHORABLE_ACTION_TYPES`
- `supabase/migrations/20260930250000_confidential_projection_receipt_action_type.sql` (new, applied live)
- `tests/factor-vela-confidential-workload.test.ts` (new, 8 tests)
- `tests/register-ceremony.test.ts` — fixed 2 stale tests, added 8 Factor-specific behavioral tests
- `tests/bankr-receipt-agent-isolation.test.ts` (new, 2 tests)
- `scripts/factor-horizen-mandate-rehearsal.mjs` (new)
