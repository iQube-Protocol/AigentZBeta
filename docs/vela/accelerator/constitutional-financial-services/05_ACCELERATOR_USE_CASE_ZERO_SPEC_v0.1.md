# Accelerator Use Case Zero
## Constitutional Risk — Confidential Programmable Underwriting for Agentic Financial Services

**Version:** 0.2  
**Date:** 9 September 2026  
**Status:** Accelerator build specification; bounded MVP  
**Primary runtime:** MoneyPenny  
**Confidential substrate:** Vela  
**Research relationship:** Operational / hypothesis-generating Golden Cycle pilot unless separately registered

## 1. Use Case Zero proposition

Demonstrate that a multi-party, agent-mediated financial action can:
1. assemble relevant parties/services;
2. preserve information sovereignty across parties;
3. decompose the action into specific consequence/risk units;
4. confidentially evaluate a bounded risk inside Vela;
5. obtain or compute coverage/transfer terms;
6. authorize and execute the covered action;
7. settle economic obligations;
8. emit a causal receipt;
9. feed observed outcomes back into Invariant Intelligence.

Short form:

> **Measure → price → cover/assume → execute → observe → settle → recalibrate.**

## 2. Why this is the accelerator wedge

The use case is narrow enough to implement with Vela's current execution model but broad enough to demonstrate a new class of financial service:

> **transaction-native micro-underwriting for machine-mediated economic actions.**

The runtime does not need to become an insurer.

The system supplies:
- risk measurement;
- information minimization;
- deterministic confidential evaluation;
- service orchestration;
- coverage quote/terms interface;
- settlement;
- evidence.

A licensed insurer/reinsurer/capacity provider can supply real risk-bearing capacity when available.

## 3. Actors

### Required platform actors
- **Human/institutional principal**
- **MoneyPenny**
- **Vela**
- **at least one financial service/agent**
- **risk/underwriting provider** — simulated deterministic provider for baseline; external partner preferred for showcase

### Optional but strategically valuable
- **Factor** — discovers/assembles agents, services, counterparties and underwriting capacity
- **Aegis** — evaluates admissibility/evidence/reliability
- **additional Horizen accelerator cohort agent/service**
- **external client**
- **reinsurance / insurance design partner**

No named third-party token-issuance provider is required.

## 4. MVP transaction shape — private multi-party liquidity portfolio

One coordinated portfolio, three private participant accounts, one proposed reallocation, one bounded process-risk slice and one settlement cycle per run. Use simulated capital and one integer-denominated asset. No live investment recommendation or insurance issuance is needed.

| Participant | Contribution (demo units) | Example private mandate |
|---|---:|---|
| A | 5,000 | Up to 2,000 eligible for the proposed allocation; retain 3,000 liquid. |
| B | 3,000 | Proposed opportunity outside permitted exposure; retain capital outside it. |
| C | 2,000 | Participation requires specified process-risk coverage; otherwise remain outside. |

Initial pool: 10,000. Baseline opportunity: 2,000, funded entirely by A. B/C capital and obligations remain unaffected, subject to verified dependency separation. A simulated gain of 100 and attributable fee of 10 gives A a net gain of 90: final balances 5,090 / 3,000 / 2,000, total 10,090. A simulated investment loss of 200 plus fee of 10 gives 4,790 / 3,000 / 2,000, total 9,790. These are fixtures, not return predictions.

A separate scenario can include C after the required simulated coverage condition is satisfied in simulation. A simulated quote cannot satisfy a live binding-coverage requirement. All changed participation schedules require a fresh envelope. If eligible capital cannot fund the action, resize and reauthorize, seek another eligible contributor, or refuse it.

Returns follow action-specific deployed capital under an accepted rule, not initial pool shares or stated risk appetite. Investment loss, process risk, repair burden and coverage recovery remain distinct. Additional first-loss or senior/junior structures are deferred.

## 5. Three-tier information flow

### Tier 1 — Collaborative
Counterparties intentionally share agreed information through CubeTalk/iQubes.

### Tier 2 — Bounded confidential
Each party contributes protected information without exposing all underlying data to the other parties.

### Tier 3 — Vela execution
MoneyPenny creates one strongly pseudonymous, minimum-necessary `ConsequenceEnvelope` for deterministic confidential processing.

## 6. Pre-Vela orchestration

Outside Vela, MoneyPenny/Factor/Aegis may:
- discover service providers;
- fetch external data;
- assess provenance;
- obtain market/reference facts;
- establish authority/mandate;
- compose the transaction graph;
- assign candidate risk slices;
- validate freshness;
- freeze input snapshot.

No live fetch occurs from the guest.

## 7. Vela kernel responsibilities

The Vela guest may:
- read private financial state;
- read private risk/pricing parameters;
- evaluate deterministic eligibility;
- compute bounded consequence/risk metrics;
- derive a verdict;
- derive quote variables or settlement instruction if within scope;
- update encrypted private state;
- emit minimum necessary signed result.

The Vela guest must not:
- call external APIs;
- query RPCs/databases;
- run an LLM;
- rely on GPU;
- determine constitutional personhood/authority;
- reveal confidential operands in plaintext app events.

## 8. Risk object

For each consequential transition create one or more `RiskSlice`s.

Minimum MVP fields:
- origin/process;
- bearer;
- probability;
- severity;
- expected repair burden;
- maximum exposure;
- coverage eligibility;
- coverage limit;
- premium/price;
- exclusions/conditions;
- evidence/version;
- observed outcome.

Do not define a universal actuarial formula in v0.2. The provider/model version is explicit and replayable.

## 9. Coverage path

### Baseline path — unilateral
A deterministic simulated underwriting provider returns:
- eligible / ineligible / unresolved;
- maximum coverage;
- premium;
- conditions.

This is enough to prove the architecture end-to-end without claiming regulated insurance.

### Partner path — preferred
An external insurer/reinsurer or regulated capacity partner:
- validates risk taxonomy;
- provides or calibrates pricing rules;
- optionally supplies a real quote or pilot cover;
- reviews disclosure/claims evidence.

### Cohort path
A Horizen cohort member may supply:
- data;
- settlement;
- asset/service;
- credential;
- risk input;
- underwriting capability;
- other callable agent service.

The architecture must not depend on cohort participation for basic delivery.

## 10. Authorization rule

Coverage does not authorize action.

The existing path remains:

**authority → mandate → public consequence projection → confidential Vela projection → unified projection → action authorization → bounded execution → observed consequence → causal receipt**

Where coverage exists, it is an additional risk-transfer state bound to the action, not a substitute for constitutional permission.

## 11. Settlement

MVP should support distinct settlements where applicable:
- service fee;
- premium/risk-transfer payment;
- transaction principal/value;
- collateral/deductible if used;
- claim/repair settlement in later phase.

The rail may be selected from existing supported settlement capabilities. No new token is required.

## 12. Evidence and feedback

Every run should produce a `GoldenCycleRecord`-compatible evidence package including:
- information provenance;
- time to value;
- risk prediction;
- premium/terms;
- coverage decision;
- action authorization;
- execution evidence;
- observed outcome;
- repair/claim if any;
- burden bearer;
- actual vs predicted calibration error.

Operational telemetry remains hypothesis-generating until registered scientifically.

## 13. Demo success criteria

Minimum:
- 1 multi-party workflow
- 2+ distinct parties/agents/services
- 1 private contribution not disclosed to another party
- 1 frozen deterministic Vela envelope
- 1 Vela confidential risk/consequence computation
- 1 clear ACCEPTABLE / UNACCEPTABLE / UNRESOLVED branch
- 1 coverage/risk-transfer quote path
- 1 authorized execution or settlement path
- 1 causal receipt
- 1 observed outcome fed into Golden Cycle / Crystal evidence

Optional later demonstration: one independently admitted Horizen/cohort service or externally calibrated risk model. These are stretch goals, not baseline delivery gates.

## 14. Out of scope for v0.2

- operating as an unlicensed insurer;
- generalized insurance product issuance;
- portfolio catastrophe/correlation engine;
- full actuarial reserving;
- production claims adjudication;
- all-market asset coverage;
- LLM inside Vela;
- multi-WASM orchestration assumptions not confirmed by Vela;
- production deanonymization path;
- new token issuance.


## 15. Participation, allocation and decision rules

Evaluate each affected participant's mandate, including shared dependencies. The pool's aggregate outcome cannot override an individual constraint. If nonparticipant isolation is demonstrated, A may execute alone; if it fails, reject; if evidence is incomplete, return UNRESOLVED. Follow existing verdict precedence when known violations coexist with missing evidence.

Freeze capital allocations, profit/loss weights, service costs, premiums, repair obligations and recovery rules before execution. For the baseline, investment P&L and attributable service fees follow deployed capital; a premium is charged only to its explicitly accepting beneficiary. Recovery follows the specified covered loss and cannot duplicate compensation. Coverage is additional to action authority. A risk originator is not automatically a risk bearer.

For split amounts use integer arithmetic: floor each proportional share, then allocate remaining minor units by descending fractional remainder, ties by canonical transaction handle. Store weights and ordering in the envelope. Account separately for external counterparties, service fees and coverage payments so all ledger movements conserve value. Shared costs require explicit acceptance; no blanket mutualization.

## 16. Demonstration and build gates

1. Three contributor views show their own contribution/mandate and permitted collective fields. Operator demo data is explicitly synthetic.
2. A-only execution succeeds with verifiable zero unaccepted B/C exposure and reconciled gains/losses.
3. A shared-collateral variant fails B's mandate; missing dependency evidence produces UNRESOLVED.
4. C's required-coverage variant blocks without qualifying terms; simulated accepted terms permit only a simulated action.
5. Tampering with participation/terms/state after evaluation invalidates authorization; duplicate or concurrent spend is refused.
6. Synthetic process failure exercises bounded claim/repair accounting; no production claims adjudication.
7. Public outputs and another participant's receipts cannot reveal private contributions or mandates; evaluate aggregate inference separately.
8. Capture participant and collective time-to-value, net benefit and repair versus a hold baseline. Preserve simulation and evidence status.

Suggested six-week sequencing, conditional on actual accelerator access: weeks 1–2 reconcile types, establish synthetic fixtures and admission/mandate gates; weeks 3–4 implement allocation and privacy paths with local deterministic kernel; week 5 integrate supported Vela evidence and state lifecycle; week 6 demonstrate failure/settlement/calibration and document unresolved hardware/partner dependencies. Local completion is not hardware completion.

Baseline additions are participant records, one participation schedule, risk bindings and recipient receipts. Reuse the existing runtime and kernel. Bankr, live capital, new custody, portfolio optimization, tranching and real insurance capacity are not delivery dependencies.
