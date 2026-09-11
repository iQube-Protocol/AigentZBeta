# Phase 3, Stage 3.1 + 3.2 — MoneyPenny Financial Services Runtime

**Date:** 2026-08-22
**Status:** Stage 3.1 and 3.2 code-complete and test-proven (local/protocol). Stage 3.3 (real Vela
attestation) remains blocked on Horizen early access — tracked separately as task #256 / VELA-002.

## Why this exists

VELA-001 closed with the constitutional commerce ontology frozen and LIVE-PROVEN end to end
(Authority → ConsequenceProjection → ActionAuthorisation → bounded execution → ObservedConsequence →
validation → receipts), against a real local Vela deployment. The operator's ruling on closing that
work was explicit: **"Proceed into Phase 3 now. Treat VELA-001 local/protocol integration as
complete. Do not wait for Vela Live Early Access to build the Financial Services operating layer."**

Phase 3 builds the first real *consumer* of that frozen ontology — MoneyPenny's Financial Services
lifecycle — with one hard constraint carried over unchanged from VELA-001: **do not create a
parallel authority, projection, authorisation or execution system.** Everything in
`services/financialServices/` is glue over existing, frozen modules, plus a service catalog and
eligibility layer that did not exist yet.

## What Stage 3.1 built

**`types/financialServices.ts`** — the service-definition contract. Every catalog entry declares
exactly the nine fields the operator specified: `serviceClass`, `eligibilityPolicy`,
`authorityRequirement`, `projectionRequirement`, `confidentialityRequirement`,
`attestationRequirement`, `executionPolicy`, `pricingPolicy`, `receiptPolicy`.

**`services/financialServices/serviceCatalog.ts`** — the three MoneyPenny services the operator
named: **Advisor**, **Architect**, **Runtime**.

| Service | `serviceClass` | Execution mode | Execution reachable | Attestation |
|---|---|---|---|---|
| Advisor | `advisor` | `preview` | no | `NOT_REQUIRED` |
| Architect | `architect` | `shadow` | no | `NOT_REQUIRED` |
| Runtime | `runtime` | `authoritative` | yes | **`REQUIRED`** |

The `serviceClass → executionMode` mapping (`SERVICE_CLASS_EXECUTION_MODE`) reuses the exact
Gate 2 behavior VELA-001 already implements — `preview`/`shadow` execution modes pass Gate 2
unconditionally for any `capabilityId`; only `authoritative` mode is gated, and only for the one
named capability (`CONFIDENTIAL_CONSEQUENCE_PROJECTION`). Runtime is the only service that uses
that capability id; Advisor and Architect use distinct ids of their own. **Gate 2 itself was not
touched** — the mapping was designed around its existing, unmodified behavior.

**`services/financialServices/eligibility.ts`** — a pre-flight discovery-time check, not a second
admission or authority decision. It calls the exact same `resolveAgentAdmissionState()` Gate 1
independently calls, and the canonical `computeStandingScore()` Standing reader — never a
duplicate of either. Three-valued (`eligible: true | false | undefined`), matching this codebase's
house style for admission/evidence reads: `undefined` means "could not be determined," never a
fabricated refusal.

**`services/financialServices/serviceRequestOrchestrator.ts`** — `requestFinancialService()`, the
one generic lifecycle implementation: discovery → eligibility → Authority/Mandate/ProposedAction →
`ConsequenceProjection` (Runtime only) → governed capability invocation (Gate 1/2/3, unchanged) →
`ActionAuthorisation` → bounded execution → `ObservedConsequence` → validation → receipts →
Standing.

Two design decisions worth naming:

- **`DELIVERED` is a new, distinct status from `AUTHORISED`.** Advisor and Architect are
  informational/planning services — they terminate on the gateway's `allow`/`refuse` decision and
  never call `deriveActionAuthorisation()`. Calling that function for a non-consequential
  interaction would overclaim what happened; `DELIVERED` says exactly what did.
- **`attestationRequirement: 'REQUIRED'` on Runtime's definition is the enforcement mechanism for
  Phase 3's hard dependency** ("services with `attestationRequirement=REQUIRED` may not execute
  real consequential value until Stage 3.3 is LIVE-PROVEN"). `composeUnifiedConsequenceProjection`
  already downgrades any unattested confidential evidence to `UNRESOLVED` under `REQUIRED` — so
  Runtime structurally cannot reach `AUTHORISED` against today's local
  (`NoAttestationTeeAuthenticator`) Vela deployment, regardless of the enclave's actual verdict.
  This is proven directly in the test suite (see below), not asserted in prose.

**`services/financialServices/orchestration.ts`** — `assembleFinancialServiceOrchestration()`, a
pure, read-only projection over already-produced `FinancialServiceOutcome`s, mirroring
`causalChain.ts`'s own discipline one layer up: it computes nothing new and holds no parallel
authority state.

Stage 3.1's required proof — "at least one admitted non-MoneyPenny agent consumes a MoneyPenny
service through the complete lifecycle" — uses Aigent Nakamoto (`aigent-nakamoto`) as the consumer
and MoneyPenny (`aigent-moneypenny`) as the provider, via the "orchestrated pattern" Gate 1 already
implements (`requestingAgentId === orchestratorAgentId`, resolved provider is a different,
independently-admitted agent). No new cross-agent plumbing was built for this — it already existed.

## What Stage 3.2 built

Stage 3.2's charge was to generalize the consumer side and prove genericity structurally, not just
by example:

**`services/financialServices/discovery.ts`** — `discoverFinancialServicesForConsumer()` /
`discoverEligibleFinancialServices()`. Implements "Standing and admission status should drive
service discovery/eligibility" directly: it runs the exact same `evaluateFinancialServiceEligibility()`
against every catalog entry, once per consumer, so what a consumer is *offered* already reflects
what it could actually *request*. No second eligibility rule exists here.

**Marketa's boundary.** Marketa (`services/marketa/admissionAssessmentEngine.ts`) is the
qualification/sourcing signal upstream of admission (`delegationActive`) — not a financial
execution authority. It is **not called** from per-request eligibility; that would be the wrong
layer (it gates agent *admission*, not per-service-request eligibility). This is proven structurally,
not asserted: the module has exactly one import (`ExternalAgentAdmissionEvidence`), zero coupling to
`constitutionalCommerce`, `invocationGateway`, `boundedExecution`, `actionAuthorisation`,
`observedConsequence`, `commerceReceipts`, `standingAccrualService`, or `financialServices` itself.

**Genericity, proven structurally.** "Consumer A, consumer B, Agent-N all use the same service
request/orchestration implementation with no source branch" is proven two ways: (1) a behavioral
test running Aigent Know1 (`aigent-kn0w1`) — a second, distinct, real registrable agent — through
the identical `requestFinancialService()`/discovery functions with no special-casing; (2) a
structural canary that reads `serviceRequestOrchestrator.ts`'s literal source and asserts none of
the three real `REGISTRABLE_AGENTS` runtime ids (`aigent-moneypenny`, `aigent-nakamoto`,
`aigent-kn0w1`) appear as a hardcoded literal anywhere in it. The structural canary is the stronger
proof — it holds for every future consumer, not just the two sampled in tests.

## Test coverage

`tests/financial-services-runtime.test.ts` — 20 tests, all passing, mirroring this repo's
established mocking convention (`resolveCapabilityProviders`, `resolveAgentAdmissionState`,
`computeStandingScore`, `accrueStanding`, receipt emitters mocked; Gate 1, Gate 2,
`deriveActionAuthorisation`, `bindExecution`, `recordObservedConsequence`, `assembleCausalChain` all
run for real):

- Service discovery resolves all three definitions with every required policy field; Runtime is the
  only Gate-2-gated capability; Runtime requires `REQUIRED` attestation by construction.
- Advisor/Architect: cross-agent `DELIVERED`, refused `INELIGIBLE` when the consumer isn't admitted.
- Runtime, the hard dependency: an `ACCEPTABLE` but unattested confidential verdict still resolves
  `UNRESOLVED` with zero execution (the realistic case — every Vela deployment reachable today runs
  `NoAttestationTeeAuthenticator`); an `UNACCEPTABLE` verdict is `REFUSED`, distinct from
  `UNRESOLVED`, independent of attestation state; Standing-below-threshold is `INELIGIBLE` before
  any gateway/projection work happens; a clearly-labeled **synthetic fixture** (explicitly commented
  as proving the mechanism, not a live claim — "no live Vela deployment reachable today produces
  this") shows the full `AUTHORISED` → executed → observed → `MATCHED_PROJECTION` chain is correct
  once Stage 3.3 delivers real attestation; execution binding never fabricates a `transactionRef`,
  even in that synthetic case.
- Orchestration assembly names a `nextServiceId` with no new authority computed.
- Genericity: Aigent Know1 through the identical function; the structural no-hardcoded-agent-id
  canary over `serviceRequestOrchestrator.ts`'s source.
- Marketa boundary: the structural zero-coupling canary over `admissionAssessmentEngine.ts`'s
  imports.
- Discovery: an admitted consumer below Runtime's Standing floor sees Advisor/Architect eligible and
  Runtime ineligible (`STANDING_BELOW_THRESHOLD`); at/above the floor, all three are eligible; a
  non-admitted consumer sees nothing eligible, including the Standing-free Advisor/Architect
  (`NOT_ADMITTED`); a second consumer (Know1) run through the identical discovery function reflects
  its own Standing independently.

`npx tsc --noEmit` introduces zero new errors from any file under `services/financialServices/` or
`types/financialServices.ts` against the pre-existing baseline. The 45 pre-existing test failures
across 18 other files (unrelated: journey/orient/passport/pulse/register-ceremony surfaces) are
unchanged by this work — confirmed by full-suite diff before and after.

## What this does not do

- No new authority, projection, authorisation, or execution mechanism — every constitutional
  decision still flows through the frozen VELA-001 modules and the three unmodified gates.
- No route or UI wiring yet. Stage 3.1/3.2 as specified prove the **lifecycle mechanism** via tests;
  no operator instruction has yet asked for a live-callable API route or a MoneyPenny surface
  consuming it.
- No live/product registry for the service catalog — `serviceCatalog.ts`'s `CATALOG` is a static,
  in-code lookup, explicitly documented as not a live registry (the same "data change, needs live
  credentials" gap already named for VELA-001's DB-backed capability descriptors, which also have no
  live rows for MoneyPenny in this sandbox).
- Stage 3.3 (real Vela attestation promotion) is unstarted and fully blocked on Horizen granting
  early access — see `docs/vela/VELA_EARLY_ACCESS_HANDOFF.md`.

## Files

| File | Role |
|---|---|
| `types/financialServices.ts` | Service definition, request, outcome, and orchestration contract |
| `services/financialServices/serviceCatalog.ts` | Advisor/Architect/Runtime definitions + lookup |
| `services/financialServices/eligibility.ts` | Discovery-time admission/Standing pre-flight check |
| `services/financialServices/serviceRequestOrchestrator.ts` | The one generic lifecycle implementation |
| `services/financialServices/orchestration.ts` | Read-only orchestration-record assembly |
| `services/financialServices/discovery.ts` | Consumer-scoped, Standing/admission-driven service discovery |
| `tests/financial-services-runtime.test.ts` | 20 tests: lifecycle, hard dependency, genericity, Marketa boundary, discovery |
