# CRP-003a Increment 2 (N2) — the canonical service pattern, shadow on Domain 3

**Date:** 2026-07-17
**Branch:** `claude/agentiq-onboarding-docs-jrbeha`
**Spec:** `CRP-003a` §3 (the 12-step pattern as a seam), §7 Increment 2

The canonical constitutional service pattern (PRD §10) is now ONE composable
seam, running **observe-first** on a Domain-3 (Financial Intelligence, read-only)
capability, with the N1 agreement gate wired as the precondition of the
delegated call. This is "the canonical Founder Office execution model" in code.

## What shipped

- **`services/constitutional/constitutionalServicePipeline.ts`** — the twelve
  steps as one orchestrator (Intent → Discovery → **Constitutional Agreement** →
  Standing → Policy → Bounded Delegation → **Execution** → Verification →
  Settlement → Evidence → Standing Accrual → Invariant Learning). **Step 3 is the
  N1 gate** (`requireAuthorizedAgreement`): the delegated call at step 7 is made
  ONLY when an authorized agreement binds the (operator, capability, agent)
  triple. Dependency-injected control flow (node-testable without Supabase/LLM).
- **Observe-first (CFS-017), two modes.** `shadow` (default): a gate refusal is
  recorded (`shadow-block`) and the delegated call is simply not made — the trace
  shows exactly what the authoritative path WOULD refuse, zero side effects.
  `authoritative`: the gate BLOCKS at step 3 (409-shaped `ok:false`). The
  shadow→authoritative flip is the later operator-gated ratification.
- **`services/constitutional/financialIntelligenceExecutor.ts`** — the Domain-3
  read-only executor + its Verification (F-201 Source Diversity · F-202 Evidence
  Attribution · F-203 Confidence Calibration, CRP-003 §4). **Honest stub:** it
  shapes a result to the domain invariants but does NOT run a live LLM/research
  call yet (that needs a provider + credits — the named follow-on). It returns
  `confidence:'low'` + empty sources on purpose, so an un-grounded brief SHOULD
  fail F-201/F-202 at Verification — the pipeline OBSERVING that failure in
  shadow is the point, never a fabricated pass.
- **`app/api/constitutional/service-pipeline/route.ts`** — spine-authenticated
  (caller = requesting operator); POST `{ intent, capabilityRef, selectedAgentRef,
  mode? }`; authoritative gate-refusal returns 409.

## What is composed vs observed

- **Composed (real):** step 3 (N1 agreement gate), step 7 (Domain-3 executor),
  step 8 (Verification F-201/202/203).
- **Observed (N2 records what the authoritative path checks; live wiring is
  Increment 2b):** step 4 `readDelegateStanding`, step 5 `evaluateAccess`, step 6
  the grant envelope, step 10 the evidence receipt (shadow emits none — CFS-017),
  steps 11/12 Reach accrual via `citeInvariants`. These are honest trace notes,
  not half-wired subsystems.
- **Skipped by design:** step 9 Settlement — Domain 3 is read-only; the USDC/Q¢
  settlement binding is a money-moving-domain increment (gated on P3, the
  enforced spend cap).

## Verification

- 16/16 pipeline drill (`scratchpad/n2_pipeline_harness.mts`): the real executor
  (structured stub, empty result fails F-201, a grounded result passes) + the
  orchestrator branching — shadow-no-agreement completes-without-executing
  (step 3 & 7 `shadow-block`, 12 steps), authoritative-no-agreement blocks at
  step 3 and does not execute, gate-open executes the delegated call and OBSERVES
  the stub failing verification.
- The pure executor parse-checks + runs clean under Node type-stripping.

## Honest limits / next

- **Domain-3 executor is a structured stub** — live invariant-grounded
  intelligence (source retrieval + analysis via a provider) is Increment 2b.
- **Steps 4/5/6/10/11/12 are observed, not yet live-wired** — 2b threads
  `readDelegateStanding` / `evaluateAccess` / the grant envelope / a shadow
  observation store / `citeInvariants`.
- **Not yet on a product surface** — Increment 3 is the Financial Services
  Capability Suite (tab-group + activation, 3-experience) where an operator runs
  this against a real registered Domain-3 capability.
- **The gate is not yet flipped authoritative** on any live surface — shadow is
  the default; the flip is a later ratification once the shadow trace shows the
  loop holds.
