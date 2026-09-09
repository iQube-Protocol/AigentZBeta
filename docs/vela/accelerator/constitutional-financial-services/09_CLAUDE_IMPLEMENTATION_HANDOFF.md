# Claude Implementation Handoff
## MoneyPenny / Vela Accelerator Hardening + Use Case Zero Preparation

**Date:** 9 September 2026  
**Instruction type:** architecture reconciliation and minimal implementation  
**Rule:** inspect current code first; do not guess Vela behavior; do not redesign the constitutional stack.

## Objective

Bring the existing Vela integration into alignment with the 8 Sep Vela masterclass and prepare the MoneyPenny runtime for Accelerator Use Case Zero:

> **Constitutional Risk — confidential programmable underwriting for agentic financial services**

This is not authorization to implement a speculative insurance platform. It is a bounded architecture/hardening increment.

## Canonical boundaries

- **metaMe** = constitutional/control plane.
- **MoneyPenny** = Financial Services Runtime/orchestrator.
- **Factor** = agent/service/counterparty discovery and economic coordination.
- **Aegis** = independent assessment/admission.
- **iQubes + QubeTalk** = disclosure and sovereign information-sharing plane.
- **Vela** = confidential deterministic execution substrate.

First Vela application/workload:

> **MoneyPenny Constitutional Consequence & Settlement Kernel**

Do not move metaMe or the full MoneyPenny runtime into Vela.

## Phase 0 — reconcile actual repo state

Before changing code:

1. Locate existing:
   - Vela provider/client implementation;
   - Vela WASM guest;
   - `ConsequenceProjection.public/.confidential`;
   - `CONFIDENTIAL_CONSEQUENCE_PROJECTION`;
   - Gate 2 / `capabilityInvocationGates`;
   - `deriveActionAuthorisation`;
   - bounded execution / observed consequence / causal receipt types;
   - Vela signer/privacy/attestation docs;
   - MoneyPenny orchestration;
   - Factor/Aegis current implementation;
   - iQube/QubeTalk primitives already available;
   - Risk, Value & Price Engine integration points;
   - Golden Cycle record / experiment telemetry if already coded.

2. Report exact current behavior and paths before modifying them.

3. Reuse existing types/services wherever possible. Do not create a second parallel constitutional or receipt model.

## Phase 1 — hard runtime constraints

Enforce/document the current Vela guest assumptions:

- no network access;
- no GPU;
- deterministic guest execution;
- TinyGo-compatible guest;
- state-in/state-out pattern;
- asynchronous request lifecycle;
- no dependency on a read-only private-state API.

Add tests where the current code does not make these assumptions explicit.

Do not implement fake network adapters inside the guest.

## Phase 2 — Frozen Consequence Envelope

Introduce or adapt the smallest existing type to represent a versioned, immutable execution snapshot.

Required semantic fields (map into existing types instead of duplicating):
- envelope ID/version;
- exact action;
- authority ref;
- mandate ref;
- strongly pseudonymous/semi-anonymous party handles;
- frozen external facts;
- provenance/freshness evidence refs;
- private financial operands;
- private risk/policy parameter refs or values;
- prior private-state ref/commitment;
- application/WASM identity;
- execution purpose;
- permitted output/disclosure class;
- timestamp/freshness boundary.

External data is fetched **before** envelope creation.

Once submitted, the envelope must not silently refresh market or contextual facts.

## Phase 3 — private parameter separation

Audit the current WASM guest.

If proprietary thresholds/risk/pricing values are hard-coded into the WASM and intended to be confidential:
- move them to the existing private state/config path or a minimal confidential parameter input;
- preserve deterministic replay;
- version/hash the parameter set where possible without exposing the parameter values.

Do not assume WASM binary secrecy.

## Phase 4 — evidence seam

Ensure a Vela execution can retain, when actually available:

- application ID;
- request ID;
- protocol version;
- chain/network ID;
- ProcessorEndpoint / TeeAuthenticator config identity;
- WASM hash/fingerprint;
- expected measurement/PCR reference;
- attestation state;
- attestation evidence/reference;
- registered enclave signer where available;
- prior/new state root/commitment where exposed;
- transaction hash;
- execution outcome;
- settlement/claim refs;
- config version.

Do not fabricate fields the current Vela environment does not expose.

Use optional/unresolved fields.

Preserve:
`LOCAL_EMULATED != HARDWARE_ATTESTED`

## Phase 5 — metadata/privacy audit

Trace:
- AppEvents;
- UserEvents;
- logs;
- errors;
- API responses;
- receipts;
- subgraph/indexed fields;
- transaction arguments;
- request metadata.

Classify each as:
- public;
- encrypted per user;
- enclave-only;
- runtime-private;
- constitutionally disclosed.

Ensure no confidential:
- balances;
- positions;
- thresholds;
- pricing parameters;
- counterparty terms;
- private mandate details;
- intermediate consequence state;
- risk model inputs

escape through plaintext events/logs/errors.

Record public metadata that cannot currently be hidden.

Do not claim anonymity where only pseudonymization/content confidentiality exists.

## Phase 6 — risk-slice / coverage seam

Do **not** build a full underwriting engine yet.

Create/reuse minimal data contracts capable of carrying:
- `RiskSlice`
- `CoverageQuote`
- `RiskOutcome`

Use `10_constitutional-risk-envelope.schema.v0.1.json` as a semantic reference, not a requirement to duplicate existing repo types.

Critical boundary:
- coverage does not authorize action;
- premium is not total risk;
- unknown risk evidence remains unknown;
- risk transfer is a separate consequential state.

## Phase 7 — Use Case Zero orchestration skeleton

Implement only enough orchestration to prove the path against a deterministic simulated provider if no external risk partner is wired yet:

1. select principal/action;
2. select/assemble participating services;
3. establish authority/mandate;
4. receive party contributions;
5. construct risk slice(s);
6. freeze external state;
7. minimize/semi-anonymize payload;
8. submit confidential consequence/risk request to Vela;
9. receive signed verdict;
10. produce `CoverageQuote` from a deterministic versioned provider;
11. require explicit acceptance if coverage is selected;
12. proceed through the existing constitutional execution path;
13. produce causal receipt;
14. record observed risk/value/time outcome.

Keep the simulated underwriting provider clearly labeled `SIMULATED` / `NON_BINDING`.

No regulated insurance claim.

## Phase 8 — P1–P4 / research instrumentation

Do not modify frozen experiment protocols.

Operationally capture Golden Cycle-compatible fields:
- disclosure tier;
- information volume;
- envelope volume;
- time-to-value;
- expected repair;
- risk bearer;
- premium;
- coverage;
- actual repair/claim;
- consequence;
- calibration error;
- invariant/config versions.

Label these records operational/hypothesis-generating unless a registered experiment says otherwise.

## Phase 9 — Vela questions / blockers

Do not implement assumptions for:
- accelerator multi-app support;
- current ERC-20/facilitator support;
- Nitro attestation parser;
- PCR upgrade governance;
- authorized disclosure/deanonymization;
- state migration across enclave versions;
- shared-testnet addresses;
- production fuel/fees;
- licensing.

Instead, produce a `VELA_ACCELERATOR_OPEN_QUESTIONS.md` or update the existing handoff with exact code points affected by each answer.

## Tests

At minimum, add/verify tests for:

1. identical envelope + state + version produces identical guest result;
2. external facts cannot mutate after envelope freeze;
3. emulated execution cannot become hardware-attested;
4. missing attestation/risk evidence remains unresolved;
5. sensitive private parameters do not appear in public output/events;
6. request submission != signed execution != settlement != observed consequence;
7. coverage quote does not bypass action authorization;
8. risk transfer requires explicit terms/acceptance;
9. actor/task/environment isolation survives concurrent requests;
10. replay/idempotency for same constitutional action/request;
11. simulated coverage is visibly non-binding;
12. Golden Cycle telemetry does not mutate scientific experiment status.

## Do not do

- no full MoneyPenny rewrite;
- no new metaMe constitutional model;
- no speculative multi-WASM implementation;
- no LLM inside Vela;
- no network inside guest;
- no new token issuance requirement;
- no new custody surface;
- no deanonymization admin backdoor;
- no hard-coded production PCR/addresses;
- no claim that Vela proves policy correctness;
- no claim that pilot telemetry proves P1–P4.

## Deliverable / report

Return:
- repo baseline found;
- files changed;
- architectural reconciliations;
- tests and results;
- privacy leaks/unsafe assumptions found;
- exact open questions requiring Vela answers;
- whether current code can accept accelerator endpoint/attestation/config without redesign;
- remaining blockers for Use Case Zero;
- commit SHA if committed.

Commit only clean, scoped, tested changes. Do not merge unrelated work.


## Revision: build the selective-participation portfolio baseline

Use Case Zero is now one coordinated liquidity portfolio with three private contributor accounts, one proposed action and action-specific risk/return allocation. The numbered documents' filenames are retained for reference stability; their internal revisions and manifest identify the update.

Reconcile the schema's `portfolioSnapshot`, `participationSchedule`, `participantResults` and risk allocation extensions with existing types. One top-level principal/mandate cannot represent all contributors' authority. Resolve concrete operands before freeze; the guest cannot dereference runtime URLs or database refs.

Implement in this order:
1. Synthetic A/B/C accounts and private mandates; baseline amounts and outcomes are specified in document 05.
2. Explicit proposed participation schedule and accepted cost/return rules. Candidate selection stays outside the guest; the kernel validates a concrete schedule.
3. Affected-interest checks across shared custody, collateral, liquidity, fees and repair. Excluded parties require evidence of separation, not just zero deployment entries.
4. Atomic reservation/state-version validation through existing facilities; reconcile pending requests before releasing balances.
5. Deterministic fixed-point allocations, risk-slice assumption evidence and coverage conditions. Simulated quotes never unlock live paths.
6. Aggregate and per-participant receipt delivery under existing disclosure controls, with verifiable binding to evaluated inputs/results.
7. Per-party and collective comparison with hold, plus synthetic failure/repair evidence.

Tests must exercise A-only success; B shared-exposure refusal; unknown isolation; insufficient eligible funds; C coverage requirement; altered schedule; expired mandate/facts; replay; concurrent double reservation; deterministic rounding; conservation including external fees/recoveries; private receipt access; aggregate inference; simulation/live firewall. Higher appetite with unchanged deployment/assumption must not change entitlement.

Do not implement tranching, first-loss markets, new custody, live portfolio optimization or new insurance issuance. A single simulated underwriting provider and financial action provider suffice. Factor/Aegis use existing specialist surfaces within MoneyPenny; Bankr is optional. Real hardware evidence and settlement isolation remain separate acceptance gates.

Before repository placement, inspect AGENTS.md and existing research, MoneyPenny, Vela and Venture Studio conventions. The operator authorized publication in iQube-Protocol/AigentZBeta on 9 September 2026. This does not authorize new public runtime routes or changes to research-cohort access gates. Preserve candidate status and P1–P4 scientific boundaries. Updating this bundle is not evidence that code is deployed or files committed.

## Repository reconciliation at publication

Baseline inspected: `d12f55b54` on `origin/dev` (9 September 2026). This is a documentation commit, not implementation of the proposed pilot.

| Existing repository surface | Reuse / extension boundary |
|---|---|
| `services/vela/velaTypes.ts` | Existing wire types and five request opcodes, including TRUSTPROCESS; confirm accelerator compatibility rather than inventing an enum. |
| `services/vela/velaProjectionProvider.ts` | Existing domain/wire boundary and coarse three-valued verdict; preserve separation from action authorization. |
| `services/vela/wasm/projector/app/app.go` | Existing private-input projector, encrypted PlainEvent verdict and no balances/fund movement. Multi-party schedules and participant outputs are proposed extensions, not existing capabilities. |
| `services/venture/trading/serviceLedger.ts` | Existing deterministic simulated service obligations and explicit liability timing. Reconcile reusable accounting patterns without changing its registered compensation treatment or claiming real settlement. |
| `docs/vela/VELA-PRIVACY-BOUNDARY-001.md` | Existing privacy boundary remains authoritative; richer participant receipts require an explicitly reviewed extension. |

The proposed schema is a semantic design aid, not a replacement for canonical types. Implementers must re-inspect the then-current branch. Do not describe the existing projector as a custody or settlement engine, and do not put rich participant results into its existing coarse-verdict channel.
