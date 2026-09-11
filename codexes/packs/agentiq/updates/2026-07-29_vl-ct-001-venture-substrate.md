# VL-CT-001 — the venture substrate (V-1, V-2, V-10)

**Date:** 2026-07-29
**Branch:** `claude/constitutional-ground-review-7yg8nb`
**Gaps closed:** V-1 (preparation-cost model), V-2 (service-economy ledger),
V-7 (compensation-regime switch), V-8 (constitutional-completeness scoring),
V-9 (refusal as a compensable receipted service), V-10 (Standing neutrality guard)
**Charter:** `codexes/packs/agentiq/updates/2026-07-28_vl-ct-001-constitutional-trading-venture-charter.md`
**Gap register:** `codexes/packs/agentiq/updates/2026-07-28_vl-ct-001-gap-register.md`

---

## What was built, and why it is one thing

The goal was not reporting. It was to make this chain **run**:

```
Opportunity → work performed → preparation cost measured → constitutional
completion/refusal determined → liability created → ledger entry → DVN receipt
→ Standing-safe outcome
```

V-1, V-2 and V-10 were chartered as three gaps, but they are three views of one
chain and could not be built as three features. A cost model that cannot see
refusals cannot score neutrality; a ledger keyed on executions cannot express
compensation earned without one; and a Standing system that admits execution
count re-introduces, through reputation, the bias the ledger removed from
payment. Build any one alone and the other two silently measure the wrong thing.

Phase 1 is **deterministic simulation with no live value.** Settlement is a
state transition against a simulated operator-funded balance. No wallet, no
chain call, no transfer.

---

## The shared primitives, and where they live

Everything lives under `services/venture/trading/` — inside the existing
`services/venture/` tree, extending it rather than forking a parallel one.

| Type | File |
|---|---|
| `VentureOpportunity`, `PreparationCostEvent`, `ConstitutionalCompletionVerdict`, `ServiceObligation`, `ServiceBudget`, `StandingSignalDecision`, `VentureExperimentCell` | `services/venture/trading/types.ts` |
| Cell derivation (the eight ids) | `services/venture/trading/experimentCells.ts` |
| T0→T2 commitment derivation | `services/venture/trading/refs.ts` |
| V-10 Standing admission gate | `services/venture/trading/standingAdmission.ts` |
| V-1 cost capture + aggregation | `services/venture/trading/preparationCost.ts` |
| V-8 completion verdict | `services/venture/trading/completionVerdict.ts` |
| V-2/V-7 ledger + budget | `services/venture/trading/serviceLedger.ts` |
| R-8 compensation extension | `services/venture/trading/compensationExtension.ts` |
| Receipt journal + checkpoints | `services/venture/trading/receipts.ts` |
| Three deterministic scenarios | `services/venture/trading/scenarios.ts` |
| The run engine | `services/venture/trading/runScenario.ts` |
| Eight-cell replay + reconciliation | `services/venture/trading/replay.ts` |
| Canaries | `tests/venture-trading-substrate.test.ts` |

### The eight cells are derived, never written down

`ventureExperimentCellId()` composes one token per axis, and
`VENTURE_EXPERIMENT_CELLS` is the cross product — so the eight identifiers
(`USDC-BUNDLED-EXEC` … `BASEQC-SERVICE-COMPLETE`) cannot drift from the
configuration that produces them. Bare arm letters `A`/`B`/`C`/`D` are
prohibited and canaried: a letter cannot say which of the three axes it varies,
so a reader of a result table cannot tell a **pricing** finding from a
**neutrality** finding — the exact confusion the three-axis design exists to
prevent.

---

## The liability-timing seam — the part that had to be right

The two compensation regimes differ in exactly one respect: **when a liability
comes into existence.** The charter warns that an implementation which creates
every obligation at execution and back-fills refusals "will look correct and
measure nothing", because the two treatments become structurally identical.

The timing decision therefore lives in **one pure predicate**, and both regimes
flow through **structurally symmetric** code — neither is a special case grafted
onto the other:

**`services/venture/trading/serviceLedger.ts:76-93`** — `liabilityArisesAt`

```ts
if (regime === 'constitutional-completion-contingent') {
  return event === 'constitutional-completion' && completedConstitutionally;
}
return event === 'execution';
```

**`services/venture/trading/serviceLedger.ts:227-237`** — `applyLiabilityEvent`
consults that predicate and, on refusal, records a *reason* in
`ledger.declined` rather than silently doing nothing.

**`services/venture/trading/runScenario.ts:292` and `:317`** — both liability
events are applied to every run in a fixed order (constitutional completion
**first**, execution second). Under completion-contingency the obligation
therefore exists, and is observable, before execution is considered at all.
Reversing that order would produce the same final ledger and destroy the ability
to tell the regimes apart.

**`services/venture/trading/serviceLedger.ts:301-305`** — `earnedAt` is stamped
with the time of the event that created the liability. That is what makes the
seam *observable*: the canaries assert **when** an obligation was earned against
timestamps taken from scenario fixtures, not merely **whether** it exists.

Pricing structure changes **how many** obligations an opportunity produces
(`bundled` → one, `per-service` → one per service) and nothing about timing.
Keeping the axes orthogonal in code is what makes `*-SERVICE-EXEC` vs
`*-SERVICE-COMPLETE` a real comparison rather than an implementation artifact.

---

## V-10 — built first, deliberately

A contaminated Standing write is harder to reverse than a missing analytic: once
execution-derived credit is inside `crm_persona_reputation` it is
indistinguishable from constitutional credit, and the experiment's own result
would mask the contamination. So the gate exists before anything can write
through it.

`evaluateTradingStandingSignal(input) → StandingSignalDecision`
(`services/venture/trading/standingAdmission.ts`).

**Refused as direct inputs:** transaction volume · executed-trade count ·
revenue generated · fees generated · realised profit · notional value ·
execution frequency. These stay commercial metrics and never become
constitutional signals by being renamed — a relabelled claim on an incomplete
process is refused on the *completeness* clause instead.

**Permitted:** correctness · veracity · proof quality · constitutional
completeness · correct refusal · risk detection · authority compliance ·
reproducibility · service reliability · reconciliation quality · absence of
unauthorised expansion.

`correct-refusal` is weighted at **parity with** `correctness`, because the
charter requires a correct refusal to be capable of earning **equal or greater**
Standing than an execution. A lower constant would deny that while appearing to
honour it.

**Existing Standing behaviour is unchanged.** The gate does not import
`computeStandingScore` or `accrueStanding`, does not touch
`crm_persona_reputation`, and does not modify
`services/venture/standingForVenture.ts`. It is an admission gate *in front of*
Standing. A canary pins the existing veracity-led composition in
`services/standing/standingScore.ts` (`veracity × 0.7 + contribution × 0.3`,
volume = `verifiedFactCount / 12`) so a trading-outcome term added there fails
the build.

### The paired canary that proves V-10 is real

`tests/venture-trading-substrate.test.ts` AC-3:

| | Agent A | Agent B |
|---|---|---|
| Act | executed a profitable transaction | correctly refused an unsuitable opportunity |
| Process | **incomplete** (4/7 links) | **complete** (7/7 links) |
| Bases offered | realised profit, executed-trade count, revenue | correct refusal, risk detection, constitutional completeness |
| Verdict | `incomplete` | `refused-complete` |
| **Admissible** | **false** | **true** |
| **Weight** | **0** | **3** |

A profitable-but-incomplete execution does not outrank a correct refusal. The
test also closes the obvious escape: relabelling the profit claim with
*constitutional* bases still fails, on `constitutionally-incomplete`.

Risk/penalty observations are recorded on a **separate channel**
(`VentureScenarioRun.riskSignals`), never as negative Standing — one figure
carrying two incompatible meanings is how the distinction gets lost.

---

## V-1 — preparation cost

The accounting unit is the **opportunity**, never the trade. Executed,
correctly-refused, abandoned and failed opportunities are all first-class and
fully measurable. `refusal` is a **service type**, so a refusal has cost events
of its own — it is not a zero and not a missing record.

Six dimensions are preserved separately (elapsed time, model tokens, compute
units, human time, external cost in exact minor units, evidence count) plus the
event and opportunity counts. **There is no single monetary figure**, by design:
a pricing model can be revised, evidence discarded at capture time cannot be
recovered. A canary asserts the aggregate's exact key set, so adding a
`totalCostMinorUnits` scalar fails the build.

Computed views: per opportunity · per agent · by service type · of executed
opportunities · of correctly-refused opportunities · per
constitutionally-completed service (which returns `null` rather than a zero that
would read as "free" when nothing completed).

---

## V-2 / V-9 — obligations, budgets, and receipts

Compensation is funded from an *ex ante* **operator-funded service budget**
(R-9). A levy on executed trades is prohibited in the confirmatory arm — it
would recreate execution contingency at the pool level after removing it at the
agent level.

Budget figures are **derived from the obligations themselves** on every
transition, never incrementally maintained: an incremental counter is a second
source of truth that drifts the moment a transition is missed, and
reconciliation would then be checking the counter against itself.

Nine consequential events are receipted individually; ordinary cost lines are
batch-checkpointed into one recomputable sha256 commitment:

`venture_opportunity_opened` · `venture_service_completed` ·
`venture_completion_assessed` · `venture_refusal_recorded` ·
`venture_obligation_earned` · `venture_obligation_approved` ·
`venture_settlement_simulated` · `venture_obligation_reversed` ·
`venture_opportunity_closed`

`venture_refusal_recorded` carries a `refusalKind` discriminator separating an
agent's **constitutional service refusal** (a success) from the ledger's
**compensation refusal for want of a valid completion** (a process failure).
One action type with no discriminator would let an audit read the second as the
first.

### R-8 compensation extension

`services/venture/trading/compensationExtension.ts` builds a **named, versioned**
`partner-service-compensation/1` object that rides inside the receipt it belongs
to. A correct refusal is classified as `refusal` — *service completed
constitutionally / execution declined / compensation earned* — never as a failed
trade. Under restricted disclosure the extension carries an **amount commitment
plus a private ledger reference** instead of the raw amount; the commitment is
deterministic over (denomination, amount), so a later authorised disclosure is
checkable against what was anchored.

### DVN pipeline — what was and was not changed

Only `ANCHORABLE_ACTION_TYPES` gained members — the one change CLAUDE.md permits
unilaterally. The pipeline's payload construction, state machine, canister call
and `hashPersonaRef` are **untouched**.

### T0/T2 isolation

`principalRef`, `participatingAgentRefs`, `funderRef`, `beneficiaryAgentRef`,
`delegationRefs` and `sourceCommitment` are all commitments derived through
`personaPublicRef()` / `constitutionalRef()` in
`services/venture/trading/refs.ts`. The receipt emitter **throws** on a payload
containing a UUID rather than scrubbing it — a scrubbed value ships and the call
site keeps the habit. Scenario fixtures use genuinely UUID-shaped persona ids
precisely so the leakage canary has teeth.

---

## The 24 runs

Three scenarios × eight cells, **no code changes between cells** — the cell is a
parameter threaded through `runVentureScenario`, never a branch.

| Scenario | Cells with obligations | Verdict | Standing |
|---|---|---|---|
| S1 approved and executed | 8 / 8 | `executed-complete` | 1 admissible contribution |
| S2 correct refusal | **4 / 8** (the four `*-COMPLETE` cells) | `refused-complete` | 1 admissible contribution, in all 8 cells |
| S3 unauthorised / incomplete | **0 / 8** | `unauthorised` | 0 contributions; 1 risk signal |

S2's 4/8 split **is** the experimental effect: compensation earned on a
non-executed outcome, which an execution-keyed schema cannot express at all. S3
carries no execution event by construction — the unauthorised action was caught,
so the opportunity fails rather than executing, which is why zero obligations
arise in all eight cells rather than only in the completion-contingent four.

All 24 runs reconcile against ten identities (budget balances; no negative
remainder; denomination matches the cell; every obligation names a receipt that
exists; every entry attributable to a cell and a regime; every obligation has an
`earnedAt`; no work left in limbo without a recorded decline; every cost event
names a real receipt; no inadmissible Standing decision reaches contributions).
Replay of every scenario in every cell is byte-identical, and the fingerprint
includes `earnedAt` so a substrate that created the right obligations at the
wrong moments cannot fingerprint identically.

---

## Acceptance criteria

| # | Criterion | How it is proven |
|---|---|---|
| AC-1 | Eight cells derived from configuration; no bare arm letters | `AC-1` — hand-written expected id list; round-trip parse; source grep over every substrate file for `arm:'A'`-shaped naming |
| AC-2 | Standing refuses commercial metrics | `AC-2` — all seven refused individually; a mixed claim's weight is unmoved by adding profit + notional; evidence required; raw-id signals refused |
| AC-3 | A profitable-but-incomplete execution does not outrank a correct refusal | `AC-3` paired canary — A inadmissible at weight 0, B admissible at weight 3, B > A; verdicts asserted first so the pairing cannot be vacuous; relabelling escape closed |
| AC-4 | Liability arises at different events per regime | `AC-4` — predicate truth table; `earnedAt` asserted against **fixture timestamps** (verdict time vs execution time); the two regimes stamp different times; holds under bundled pricing too |
| AC-5 | A refusal is compensated under completion-contingency and not under execution-contingency | `AC-5` — all four `*-COMPLETE` cells create an obligation with basis `correct-refusal`; all four `*-EXEC` cells create none and record a decline reason; group sizes asserted 4 and 4 |
| AC-6 | Cost measured on every population, never collapsed | `AC-6` — hand-computed six-dimension totals for the refused opportunity; `refusal` present as a measured service type; exact aggregate key set; executed + refused sum to the whole; per-opportunity / per-agent / per-completed views |
| AC-7 | An unauthorised opportunity earns nothing anywhere | `AC-7` — 0 obligations and 0 settled in all eight cells; distinct `refusalKind`; 0 Standing contributions with the risk signal on its own channel; cost still measured |
| AC-8 | Nine consequential events receipted and anchor-eligible | `AC-8` — exact nine-type set; each present in `ANCHORABLE_ACTION_TYPES` **and** the `ActivityActionType` union (matched as membership, not a prose mention); happy path emits all seven lifecycle types; cost lines checkpointed |
| AC-9 | Refusal encoded as a success; extension versioned; restricted disclosure withholds the amount | `AC-9` — `classification: 'refusal'`, `liabilityCreationEvent: 'constitutional-completion'`, version pinned; restricted mode has commitment + private ref and **no** amount; commitment deterministic and amount-sensitive |
| AC-10 | No raw identifier crosses the boundary | `AC-10` — fixtures verified UUID-shaped first; no UUID in any receipt across all 24 runs; every commitment field matches `^[0-9a-f]{16}$`; the emitter **throws** when driven with a poisoned payload |
| AC-11 | Deterministic execution and replay | `AC-11` — source grep for `Date.now(`/`Math.random(`/`new Date(`/`performance.now(` across ≥9 substrate files (file count asserted so the loop cannot pass vacuously); replay stable for all three scenarios in all eight cells; fingerprint proven timing-sensitive |
| AC-12 | 24 runs reconcile without code changes | `AC-12` — 24 distinct (scenario, cell) keys; zero violations across ten identities; every obligation attributable; refusal compensation in exactly the four named `*-COMPLETE` cells; settlement moves state only |
| AC-13 | Existing Standing behaviour untouched | `AC-13` — the gate imports none of `computeStandingScore` / `accrueStanding` / `crm_persona_reputation`; the existing composition pinned by source; no substrate module calls `accrueStanding(` |

---

## Mutation table

Every canary was mutation-tested: violation applied → **file diff verified** →
suite run → restored → restore verified. Two mutations initially reported as
survivors were harness defects, not canary gaps, and both were run again
properly.

| # | Mutation | Result | Caught by |
|---|---|---|---|
| M1 | Liability created at execution under completion-contingency | CAUGHT (8) | AC-4 ×3, AC-5, AC-9, AC-12 |
| M2 | A correct refusal produces no obligation | CAUGHT (2) | AC-5, AC-9 |
| M3 | Completion-contingency *also* fires at execution (regimes collapse) | CAUGHT (1) | AC-4 predicate table |
| M4 | Standing admits profit / volume / execution-count | CAUGHT (3) | AC-2 ×2, AC-3 |
| M5 | An incomplete verdict no longer blocks accrual | CAUGHT (1) | AC-3 relabelling clause |
| M6 | A raw identifier reaches a receipt payload | CAUGHT (suite-level throw) | AC-10 emitter guard |
| M7 | The receipt leak guard is disabled | CAUGHT (1) | AC-10 behavioural check |
| M8 | `Date.now()` in the replay path | CAUGHT (1) | AC-11 determinism grep |
| M9 | The Standing gate's refusal is discarded | CAUGHT (2) | AC-7, AC-12 identity 10 |
| M10 | `venture_refusal_recorded` dropped from `ANCHORABLE_ACTION_TYPES` | CAUGHT (1) | AC-8 |
| M11 | A bare arm letter used to name a cell | CAUGHT (1) | AC-1 |
| M12 | Preparation cost collapsed to one monetary figure | CAUGHT (1) | AC-6 key-set check |
| M13 | Refused-opportunity cost made invisible | CAUGHT (1) | AC-6 population split |
| M14 | Only an executed opportunity can complete constitutionally | CAUGHT (11) | AC-3 ×4, AC-5 ×3, AC-6, AC-9, AC-12 ×2 |
| M15 | A correct refusal classified as a generic completion | CAUGHT (1) | AC-9 |
| M16 | Restricted disclosure leaks the raw amount | CAUGHT (1) | AC-9 |
| M17 | The service budget no longer balances | CAUGHT (1) | AC-12 identity 1 |
| M18 | Unauthorised expansion no longer voids the Standing signal | CAUGHT (1) | AC-2 isolating canary |

**Two harness defects worth recording**, because both are the failure mode the
brief warned about — a no-op mutation is indistinguishable from a surviving
canary:

- **M12's first attempt added a field to a TypeScript interface only.** Vitest
  does not typecheck, so the runtime object was unchanged: a genuine no-op that
  reported as SURVIVED. Re-run with all four runtime edits (interface, zero
  value, accumulator, per-completed projection) it was caught immediately.
- **M6's first attempt WAS caught**, but the detector missed it. The emitter
  throws at module-collection time, so the suite reports `Tests no tests` with a
  suite-level failure and **zero** per-test `×` lines — which a detector counting
  `×` lines reads as a clean run.

**M18 was a real gap.** In every scenario an unauthorised expansion also forces
`complete: false`, so the two guards overlap and either alone refuses the S3
fixture — meaning no scenario run could ever exercise the
`unauthorisedExpansion` branch on its own. An isolating unit canary was added
that drives the gate with `{ complete: true, unauthorisedExpansion: true }`, the
shape only a caller computing completeness some other way could produce.

---

## Verification

- **Full suite:** 180 files / 2933 tests passed (baseline 179 / 2878; +1 file,
  +55 tests).
- **`npx tsc --noEmit`:** the two pre-existing config errors only
  (`Cannot find type definition file for 'iqube'`, `Invalid value for
  '--ignoreDeprecations'`). No new errors.

---

## Operator SQL — run this in the Supabase SQL editor

The `ActivityActionType` union and the `activity_receipts` CHECK constraint are
two declarations of one vocabulary. Without this migration every venture receipt
insert raises a check violation at runtime, and several receipt call sites in
this repo swallow the error — losing the receipt **and its DVN anchor** with no
log. `tests/activity-receipts-action-type-parity.test.ts` guards the drift; this
is the second half of the fix.

The migration file is
`supabase/migrations/20260929000000_venture_substrate_receipt_types.sql`. Paste
the whole block below:

```sql
ALTER TABLE public.activity_receipts
  DROP CONSTRAINT IF EXISTS activity_receipts_action_type_check;

ALTER TABLE public.activity_receipts
  ADD CONSTRAINT activity_receipts_action_type_check
  CHECK (action_type IN (
    'intent_queued',
    'specialist_consulted',
    'artifact_created',
    'artifact_published',
    'artifact_sent',
    'approval_granted',
    'approval_rejected',
    'experience_model_updated',
    'session_started',
    'session_completed',
    'passport_application_submitted',
    'passport_issued',
    'passport_status_changed',
    'passport_revoked',
    'passport_privilege_changed',
    'passport_infraction_recorded',
    'governance_decision_ratified',
    'governance_decision_amended',
    'governance_authority_exercised',
    'governance_escalation_triggered',
    'experience_task_completed',
    'agent_revocation_state_changed',
    'operator_action_logged',
    'standing_document_added',
    'partner_agent_evidence_recorded',
    'agent_delegated',
    'agent_delegation_revoked',
    'plan_purchased',
    'plan_renewed',
    'invariant_discovered',
    'invariant_validated',
    'invariant_canonized',
    'invariant_superseded',
    'invariant_qube_published',
    'knowledge_curated',
    'consequence_forecast_recorded',
    'knowledge_evolved',
    'experience_render_validated',
    'implementation_pack_generated',
    'implementation_dispatched',
    'deployment_proposed',
    'constitutional_validation_recorded',
    'remediation_recorded',
    'deployment_authorized',
    'validation_override_granted',
    'capability_registered',
    'capability_operationally_validated',
    'capability_deprecated',
    'research_lifecycle_transition',
    'experiment_result_published',
    'invariant_node_flipped',
    'agreement_formed',
    'agreement_authorized',
    'qubetalk_artifact_shared',
    'qubetalk_artifact_opened',
    'qubetalk_artifact_copied',
    'finance_authoritative_execution',
    'canonical_plate_composed',
    'plan_cancelled',
    'venture_blueprint_handoff',
    'standing_accrued',
    'standing_corrected',
    'workspace_report_published',
    'venture_opportunity_opened',
    'venture_service_completed',
    'venture_completion_assessed',
    'venture_refusal_recorded',
    'venture_obligation_earned',
    'venture_obligation_approved',
    'venture_settlement_simulated',
    'venture_obligation_reversed',
    'venture_opportunity_closed'
));
```

No other schema change is required. The Phase 1 ledger, budgets and receipt
journal are in-memory simulation artifacts and deliberately have **no** tables:
writing 24 replays of the same fixture into `activity_receipts` would pollute
the real provenance trail with simulation output. The emitter is the same one a
live Phase 2 path would use.

---

## Flagged, not decided

> **RULED 2026-07-29.** Items 1-4 below received operator rulings and are no
> longer open. What each ruling changed -- and the one place a ruling's
> qualification did NOT already hold (item 3) -- is recorded in
> `codexes/packs/agentiq/updates/2026-07-29_vl-ct-001-operator-rulings-and-moneypenny-adapter.md`,
> along with the next slice (the thin MoneyPenny simulation adapter) and the
> operator SQL for the deployment compatibility probe. Item 5 is unchanged.
>
> | # | Ruling | Outcome |
> |---|---|---|
> | 1 | R-8 stays receipt-carried | approved; promotion boundary recorded + canaried |
> | 2 | fixture receipts stay unanchored | approved; convention replaced by a runtime guard that throws |
> | 3 | bundled refusal basis | approved WITH a qualification -- **component bases did not already hold; implemented** |
> | 4 | `MAX_STANDING_SIGNAL_WEIGHT = 3` | retained as PROVISIONAL and experiment-scoped; the canary now pins the ordering, not the number |


1. **The DVN payload extension ships as a receipt-carried object, not a pipeline
   change.** R-8 pre-approves the versioned partner-service compensation
   extension, but CLAUDE.md permits only `ANCHORABLE_ACTION_TYPES` additions to
   `services/dvn/activityReceiptDvnPipeline.ts` unilaterally. The extension is
   therefore **built** by the venture substrate and rides inside the receipt it
   is attached to; the pipeline's own payload construction is untouched. If the
   operator wants the extension serialised as a distinct top-level field in the
   canister payload, that is a payload-shape change to the pipeline and needs
   explicit approval.

2. **Phase 1 writes no receipts to `activity_receipts`.** The runs are
   simulations replayed 24 times; anchoring them would put fixture data in the
   real provenance trail. The action types, the anchorable registration and the
   CHECK constraint are all in place so Phase 2 can turn the live path on
   without a schema change. Flagging because "the receipts exist" and "the
   receipts are anchored on-chain" are different claims and should not be
   conflated in any report.

3. **The `bundled` pricing basis for a bundle containing a refusal.** A bundled
   obligation whose pending work includes a correct refusal is recorded with
   basis `correct-refusal` rather than `service-completed`, so the H3 refusal
   classification survives bundling. This is an interpretation of R-7, not
   something the charter states explicitly — worth ratifying, because the
   alternative (a generic `service-completed` bundle) would erase the one
   classification H3 reads in exactly the four bundled cells.

4. **`MAX_STANDING_SIGNAL_WEIGHT = 3` and the per-basis weights are chosen, not
   ruled.** `correct-refusal` is deliberately set at parity with `correctness`
   to satisfy the charter's "equal or greater" requirement. The remaining
   constants are defensible defaults, not derived from anything; they should be
   ratified before Standing consumes real trading signals.

5. **The pilot's own `finance` invariant namespace is still empty** (S-1 in the
   gap register). This substrate is instrumentation; it does not discover
   trading invariants and does not claim to.
