# Vela Masterclass — Architecture Delta for MoneyPenny

**Version:** 0.2  
**Source:** Vela masterclass transcript supplied 8 September 2026, plus current public Vela documentation/repositories where consistent  
**Status:** Implementation refinement; uncertain points remain open for Vela office hours

## 1. Governing principle

The masterclass's central distinction is:

> **Verified execution, not verified logic.**

Vela can establish that expected code ran on genuine attested hardware and that later results came from the registered trusted execution identity.

Vela does not establish:
- that application logic is correct;
- that a mandate is legitimate;
- that a policy is appropriate;
- that the outcome is constitutionally acceptable;
- who should bear the resulting economic consequence.

This validates the existing Constitutional Computing/Vela split.

## 2. Vela's role

Vela is an off-chain confidential coprocessor with smart contracts as entry/exit coordination points.

For the accelerator architecture:

**metaMe constitutional plane → MoneyPenny runtime → Vela confidential kernel → on-chain signed result/settlement → MoneyPenny causal receipt**

The wider application does not migrate into Vela.

## 3. Hard runtime constraints to codify

The masterclass identified the following present constraints:

1. **No GPU access.**
2. **No network access from the enclave guest.**
3. **Deterministic execution required.**
4. **Guest WASM uses a stateless function pattern:** prior saved private state arrives as input and modified state is returned as output.
5. **Asynchronous execution:** manager polling plus chain inclusion/settlement latency; the masterclass described a default polling cadence around five seconds.
6. **No read-only API in the current runtime.**
7. **TinyGo guest constraint rather than unrestricted full Go.**
8. **External data must be obtained outside Vela and included in the request.**

### Required code implication

Introduce or harden a **Frozen Consequence Envelope**.

No Vela guest path should depend on:
- live market API;
- RPC;
- database;
- oracle fetch;
- LLM/model inference requiring GPU/network;
- mutable external state during execution.

## 4. Frozen Consequence Envelope

Before Vela execution, MoneyPenny should assemble a versioned envelope containing:

- exact proposed action;
- principal/authority reference;
- mandate reference;
- strongly pseudonymous participant handles;
- external facts required by the computation;
- provenance and timestamp/freshness of each external fact;
- private financial operands;
- applicable risk/policy parameters;
- relevant invariant/configuration versions;
- prior private-state commitment/reference;
- expected application/WASM identity;
- execution purpose;
- permitted output/disclosure class.

The envelope is immutable for one execution request.

Vela evaluates the snapshot, not "current reality."

## 5. Code confidentiality boundary

The masterclass made clear that the deployed WASM binary should be treated as inspectable by infrastructure operators.

Therefore:
- proprietary thresholds must not rely on WASM secrecy;
- proprietary pricing/risk rules that require confidentiality should be supplied as encrypted state or parameters where technically appropriate;
- the WASM should express deterministic evaluation machinery;
- private state/parameters should contain the secret values.

## 6. Attestation / PCR governance

The masterclass described:
- AWS Nitro as the hardware trust root;
- PCR measurements, with PCR0 relevant to the enclave image and other PCRs separately exposed;
- a Vela TEE authenticator that checks the expected measurement;
- on-chain registration of the trusted enclave signing identity;
- later result validation through signature checks.

It also surfaced an important governance issue:
- a trusted PCR value can be changed by an owner-controlled update mechanism;
- the base mechanism described in the class does not inherently require a timelock or multisig.

### Required platform implication

Treat **measurement change as a constitutional governance event**.

The metaMe/MoneyPenny receipt model should be capable of retaining:
- expected measurement/PCR;
- app/WASM hash;
- trusted signer identity;
- attestation status/evidence reference;
- measurement/config version;
- effective time;
- upgrade/approval authority reference.

Do not implement guessed production attestation parsing until the Vela team provides the supported accelerator interface.

## 7. Request/output lifecycle

Known flow:

1. Client encrypts payload to enclave public key.
2. Encrypted request enters the on-chain Processor/entry point; funds may be committed simultaneously.
3. Manager observes the request and forwards it to the executor.
4. Executor decrypts request/private state inside enclave.
5. WASM executes deterministically.
6. Updated state is re-encrypted and result is signed.
7. State update / exit contract verifies the registered TEE signer.
8. Only accepted signed output is allowed to drive subsequent settlement/events.

### Required implementation hardening

- Correlate request ID through the entire causal chain.
- Preserve idempotency and canonical completion state.
- Distinguish submission, TEE processing, signed result, on-chain acceptance, settlement, observation and validation.
- Never treat request submission as execution completion.
- Never treat successful protocol execution as hardware attestation unless attestation evidence supports it.

## 8. Metadata privacy

Vela hides confidential content; it does not hide the existence of computation.

The masterclass identified publicly observable/correlatable material such as:
- sender;
- application ID;
- request type;
- timestamp;
- value/deposit/withdrawal information;
- event topics/subtypes;
- transaction existence and timing.

Low transaction volume may make correlation particularly easy.

### Required privacy model

Classify separately:
1. **content confidentiality**
2. **metadata privacy**
3. **unlinkability**
4. **identity disclosure**
5. **authorized re-binding**

The system must not claim one category merely because another is provided.

The masterclass also described a seeded event-subtype mechanism intended to reduce straightforward cross-user linking. Exact production API/semantics should be confirmed before use.

## 9. Deanonymization / authorized disclosure

The masterclass described Vela as providing a mechanism for an authorized disclosure/deanonymization request while the application determines:
- what private history/state is stored;
- what can be reported;
- what legitimate authority means for the application.

Do not implement a universal admin disclosure path.

Future constitutional pattern:

**authorized disclosure request → authority/mandate/admissibility check → bounded report generation → disclosure receipt**

Open questions remain around:
- authority key/control;
- report scope;
- event/public-state requirements;
- revocation;
- logging;
- regulator/auditor roles.

## 10. Fuel / fee model

The masterclass described a `fuel` value representing work performed and a configurable price per unit, with application-level sizing/manual operation configuration possible.

Required action:
- keep fuel/max-fee parameters configurable;
- do not embed production economics before accelerator guidance;
- capture actual fuel/fee in execution telemetry for future price/time/risk research.

## 11. Trigger contracts and asset features

The masterclass indicated that trigger-contract support and token/facilitator features have recently advanced.

Current public materials are not fully synchronized:
- public limitations still describe single-app and ERC-20 as roadmap items;
- current repositories describe multi-app/isolated state and ERC-20/facilitator capabilities.

Do not choose an architecture based on one side of this discrepancy. Resolve the supported **accelerator build** with the Vela team.

## 12. First application decision

The first Vela workload should be:

> **MoneyPenny Constitutional Consequence & Settlement Kernel**

not:
- metaMe as a whole;
- the entire MoneyPenny runtime;
- Factor;
- Aegis.

This kernel fits the masterclass's strongest current application shapes:
- private scoring/verdict;
- operator-blind computation;
- confidential settlement;
- private credential/state evaluation.

## 13. Required tests after hardening

- deterministic replay: identical input + state + version → identical guest result;
- network-free guest: no hidden fetch/oracle/RPC dependency;
- confidential-parameter test: sensitive rule values not present in public outputs/logs/events;
- metadata classification regression;
- app/WASM/measurement version bound into evidence seam;
- submission vs execution vs settlement state separation;
- emulated TEE never promoted to hardware-attested status;
- missing evidence remains `UNRESOLVED`, not zero/acceptable.


## 14. Multi-party application delta (9 September revision)

These are application requirements, not newly verified Vela capabilities. The masterclass statements above retain their 8 September source date and remain subject to the authoritative accelerator build.

- Carry participant accounts, mandates, the proposed participation schedule, cost/return terms, dependency evidence and state version in one frozen request. One application suffices for the baseline; no multi-WASM dependency.
- Check authorization of contributing inputs outside Vela; bind their evidence and exact accepted terms to the confidential calculation. Confirm how Vela authenticates contributors when one coordinator submits.
- Explicitly serialize canonical integer amounts, ordering, units, policy versions and evaluation time. Guest determinism refers to the application result; randomized ciphertext and signatures need not be byte-identical.
- Add state-version conflict and replay protection around asynchronous execution; confirm Vela's actual state sequencing and settlement atomicity before hardware integration.
- Require per-recipient output authorization. Do not assume one signed output is privately decryptable by multiple parties; confirm supported encryption/key interfaces. Baseline may use authorized runtime-mediated receipt delivery.
- Treat total balances, low-entropy commitments, failure reasons and repeated eligibility probes as potential disclosures. Content encryption alone does not close these channels.
- Keep simulated funds, simulated coverage, local computation and hardware-attested computation as separately evidenced dimensions. None promotes another to live status.

Acceptance: A-only execution preserves B/C balances and obligations; unknown segregation blocks the action; changed schedules invalidate prior results; concurrent requests cannot double-reserve capital. No metadata or request topology assurance is claimed until confirmed.
