# MoneyPenny Constitutional Coordination, Disclosure & Risk Architecture

**Version:** 0.2  
**Date:** 9 September 2026  
**Status:** Proposed architecture for the Financial Services Runtime / Vela accelerator

## 1. Architectural proposition

MoneyPenny should be treated as a **constitutional coordination and disclosure runtime for financial services**, not merely a financial assistant or transaction router.

It coordinates:
- parties;
- agents;
- services;
- information rights;
- disclosure scope;
- authority and mandate;
- risk apportionment;
- confidential computation;
- settlement;
- causal receipts.

The central pattern is:

> **Progressive disclosure collapse + progressive risk localization.**

Information moves from a potentially rich multi-party collaboration into the minimum necessary confidential execution payload. Risk moves from an undifferentiated transaction exposure into specific, attributable, priceable consequential units.

## 2. System boundaries

### metaMe
Constitutional/control plane:
- personhood continuity;
- identity/persona;
- Passport;
- authority;
- bounded delegation;
- mandate;
- Standing;
- receipts;
- cross-runtime constitutional state.

### MoneyPenny
Financial Services Runtime:
- financial intent;
- multi-party coordination;
- service discovery/orchestration;
- disclosure policy;
- risk-slice composition;
- consequence-envelope construction;
- confidential execution admission;
- settlement coordination;
- causal receipt binding.

### Factor
Economic engine / network expansion:
- discovers relevant agents, services and counterparties;
- recruits and prepares providers for registration/admission;
- assembles candidate transaction/service graphs;
- facilitates service discovery and economic coordination;
- may surface token-issuance or other economic capabilities when appropriate;
- does not independently grant constitutional admission, standing or execution authority.

Factor is useful to Use Case Zero but not a hard dependency for the first deterministic Vela kernel.

### Aegis
Independent trust/admission membrane:
- assesses agent/service provenance;
- evaluates evidence quality, reliability and risk-of-repair;
- supports admission decisions;
- remains separate from Factor's recruitment/economic role;
- assessment does not itself authorize execution.

### iQubes
Sovereign information objects:
- preserve provenance and policy;
- support bounded disclosure;
- permit private contribution of party-specific information;
- provide a basis for purpose, scope and recipient restrictions.

### CubeTalk
Collaborative information-sharing / negotiation surface:
- allows parties to disclose information intentionally to each other;
- can coordinate shared or negotiated context;
- may contribute an agreed subset of information into a later execution envelope.

### Vela
Verified confidential execution substrate:
- executes deterministic WASM logic over private inputs/state;
- provides TEE-attested execution in the hardware-backed environment;
- does not decide constitutional authority;
- does not prove that application logic/policy is correct;
- must receive external facts as part of a frozen input envelope because the guest has no network access.

## 3. Three-tier disclosure model

### Tier 1 — Collaborative Disclosure

Parties intentionally share information with one another.

Primary mechanisms:
- CubeTalk;
- shared iQube contexts;
- explicit disclosure rights;
- purpose/recipient constraints;
- provenance and consent evidence.

Use when collaboration itself requires counterparties to inspect information.

### Tier 2 — Bounded Confidential Collaboration

Parties contribute information to the transaction/runtime without necessarily disclosing it to one another.

Each party can supply a protected iQube payload under an explicit purpose.

MoneyPenny:
- preserves compartmentalization;
- determines which features/claims may be combined;
- records the authority for combination;
- prevents broad disclosure merely because data is needed for a computation.

### Tier 3 — Confidential Consequential Execution

MoneyPenny collapses the permitted contributions into a deterministic, minimum-necessary execution envelope.

Before Vela submission:
- direct identifiers are removed where not required;
- transaction-scoped strongly pseudonymous identifiers are used;
- external facts are frozen and provenance-bound;
- private model/risk parameters are supplied as confidential state/inputs rather than hard-coded secrets;
- exact action, mandate and consequence purpose are fixed;
- public metadata leakage is assessed.

Vela:
- decrypts the envelope/private state inside the enclave;
- runs deterministic TinyGo/WASM logic;
- returns updated encrypted state plus signed result;
- emits only the minimum public/confidential events required by the application.

MoneyPenny then:
- verifies Vela evidence;
- re-binds the result to the constitutional subject/parties outside the enclave;
- admits or refuses the next state transition;
- coordinates settlement;
- emits causal receipts;
- records realized consequence and risk outcome.

## 4. "Semi-anonymous" execution

metaMe terminology: **semi-anonymous** means strongly pseudonymous, not necessarily irreversibly anonymous.

The execution payload should distinguish:
- constitutional continuity outside the enclave;
- contextual identity where required;
- transaction-scoped pseudonym inside the confidential payload;
- authorized re-binding after result;
- disclosure rights for audit/regulatory purposes where applicable.

Claims must remain precise:
- content confidentiality is not metadata invisibility;
- pseudonymization is not absolute anonymity;
- re-identification paths must themselves be governed.

## 5. Risk decomposition

A complex transaction is represented as a sequence of **consequential transitions**.

Each transition may create a `RiskSlice` containing:

- `riskSliceId`
- `transitionId`
- `originActor/process`
- `controller`
- `principal`
- `mandateRef`
- `riskClass`
- `description`
- `probabilityEstimate`
- `severityEstimate`
- `exposureDuration`
- `repairProbability`
- `repairSeverity`
- `repairTime`
- `repairBearer`
- `expectedRepairBurden`
- `maximumExposure`
- `correlation/dependencyRefs`
- `mitigations`
- `currentBearer`
- `transferTerms`
- `coverageRef`
- `price/premium`
- `evidenceRefs`
- `model/version/confidence`
- `outcome`

Unknown fields remain unknown. They must not silently become zero.

## 6. Constitutional risk apportionment

The runtime should be able to answer:

1. What process introduced the risk?
2. Who controlled the process?
3. Under whose authority did it occur?
4. Who explicitly assumed the consequence?
5. Was risk transferred, mitigated, collateralized or insured?
6. Which risk remained unresolved at the next state transition?
7. What actually happened?
8. Who ultimately bore repair?

This produces a machine-legible responsibility graph without pretending that platform attribution automatically determines legal liability.

## 7. Constitutional settlement points

A material state transition may become a settlement point:

**state-in → proposed action → consequence/risk evaluation → risk allocation/coverage → authorization → execution → observed consequence → settlement/receipt → state-out**

Crypto/stable-value rails are useful because premium, collateral, fees, claim settlement and service settlement can occur at machine speed.

The settlement layer should remain constitutionally neutral:
- the rail does not confer authority;
- token issuance is not required for Use Case Zero;
- existing micro-stablecoin / stablecoin / supported settlement rails can be selected per pilot constraints;
- the constitutional record is independent of the specific asset.

## 8. First Vela application

**Do not deploy metaMe as the Vela application.**

Target:

> **MoneyPenny Constitutional Consequence & Settlement Kernel**

The kernel should be deliberately narrow:
- deterministic;
- no GPU;
- no network;
- TinyGo compatible;
- stateless guest pattern (prior encrypted state in; updated encrypted state out);
- private parameters separate from inspectable WASM;
- bounded outputs;
- evidence-rich, privacy-minimized.

Initial function family:
1. evaluate consequence/risk state;
2. produce `ACCEPTABLE`, `UNACCEPTABLE` or `UNRESOLVED` under existing precedence;
3. optionally derive bounded settlement/coverage instruction where explicitly authorized;
4. return signed result and evidence identifiers.

## 9. Architecture flow

**Parties / agents / services**  
↓  
**Factor discovery & assembly**  
↓  
**Aegis admission / evidence assessment**  
↓  
**metaMe authority + MoneyPenny mandate**  
↓  
**Tier 1: CubeTalk/iQube collaborative disclosure**  
↓  
**Tier 2: bounded confidential contributions**  
↓  
**MoneyPenny minimization + risk decomposition + frozen external-state snapshot**  
↓  
**Tier 3: semi-anonymous Consequence Envelope**  
↓  
**Vela MoneyPenny Kernel**  
↓  
**signed confidential verdict / updated private state / bounded instruction**  
↓  
**MoneyPenny authorization + execution/settlement**  
↓  
**causal receipt + risk outcome + Golden Cycle record**  
↓  
**Crystal / Invariant Intelligence calibration**

## 10. Architectural non-claims

This architecture does not claim:
- Vela validates the correctness of our risk logic;
- insurance coverage grants authority;
- technical risk apportionment automatically determines legal liability;
- transaction metadata is invisible;
- the deployed WASM is secret;
- operational telemetry is automatically scientific evidence.


## 11. Revised portfolio architecture — selective participation

One coordinated portfolio holds private participant accounts. Each action has a frozen participation schedule containing participant handle, deployed amount, authority/mandate evidence and maximum accepted exposure. The collective balance is a view, not authority to spend any contributor's assets.

Tier 1 shares the objective and agreed operating rules through CubeTalk/iQubes. Tier 2 receives contribution amounts, private mandates and output permissions. Tier 3 supplies the same narrow kernel with one confidential envelope retaining those distinctions. The baseline protects contributors from counterparties; MoneyPenny's authorized assembly path may see plaintext. Runtime-blind multi-sender assembly is a separate capability requiring Vela confirmation.

Evaluate every affected interest, including nonparticipants exposed through shared custody, collateral, liquidity, fees or settlement. Verified independence permits selective execution. A known breach is unacceptable; missing dependency evidence is unresolved. If the schedule changes, freeze a new envelope and obtain fresh evaluation and authorization. Never silently remove a participant from an already authorized action.

The kernel consumes concrete private operands and evidence already included in the request/state. References alone cannot supply values to a guest with no network. Identity re-binding stays outside the guest. Randomized private commitments must be used where low-entropy contribution/threshold hashes would permit guessing; exact commitment/signature mechanisms require adapter reconciliation.

Use fixed-point integer minor units, one asset and one snapshot. Reserve eligible capital against the state version before submission; prevent two asynchronous requests from spending the same balance. Timeout does not release funds until authoritative request state is reconciled. Settlement must recheck authority/freshness and match the approved schedule and state. Fail closed on stale state or unknown settlement outcome.

Outputs comprise an aggregate permitted verdict and private participant results, bound to one request, schedule, prior/new state and approved application version. Route each result through existing authorized disclosure mechanisms. A receipt hash alone does not prove its allocation is included in a signed result; verification must bind the delivered contents. Public totals, repeated queries and refusal reasons can reveal hidden contributions or thresholds, so suppress unauthorized detail and apply existing query controls.

Do not introduce new custody, a new cartridge or a second constitutional ledger. Factor/Aegis remain MoneyPenny specialists. Demonstrate isolation in a simulated ledger first; make no claim of real asset segregation without verified rail and custody behavior.
