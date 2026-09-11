# Operation Chrysalis — DVN Spine Fast-Follow Backlog

**Status:** Backlog / fast follow — do not implement during current Horizen Pilot stabilization  
**Recorded:** 2026-08-08  
**Programme:** Operation Chrysalis / AgentiQ constitutional runtime  
**Trigger:** Horizen Pilot DVN integration and operationalization of DVN monitoring/reconciliation agents

## Decision captured

The DVN monitoring, reconciliation, state-transition and finality-propagation capability developed during the Horizen Pilot should be evaluated and elevated into a **first-class runtime primitive**, provisionally named the **DVN Spine**.

This work is intentionally deferred until the current Horizen Pilot / MoneyPenny end-to-end experiment is stable. The pilot should finish defining the empirical requirements before the abstraction is hardened.

## Architectural proposition

The platform increasingly has three complementary constitutional spines:

- **Persona / personhood spine** — establishes *who*, under whose authority, and to whose consequence an action belongs.
- **SmartTriad spine** — provides the affordances through which consequential action, transaction and interaction occur (including SmartWallet, SmartContent and SmartMenu).
- **DVN Spine** — establishes, monitors and propagates the evidentiary/finality state of consequential actions.

Provisional DVN Spine lifecycle:

`constitutional event`
→ `receipt created`
→ `commitment`
→ `DVN submission`
→ `DVN Pending`
→ `monitoring / reconciliation`
→ `DVN Minted`
→ `finality propagation`
→ optional `BTC Pending`
→ `BTC Anchored`
→ `reconciliation / audit`

## Finality invariant

The current operating model to preserve is:

`Created < DVN Pending < DVN Minted < BTC Anchored`

with:

- **DVN Minted** = default operational finality / normal downstream consumption boundary.
- **BTC Anchored** = stronger external finality, required only where a capability, agreement, policy or constitutional state transition explicitly requires Bitcoin anchoring.

Bitcoin anchoring must not become an implicit global prerequisite for DVN-dependent operation.

## Why this is a spine rather than a receipt utility

The emerging DVN capability is active infrastructure rather than passive storage. It is responsible for keeping consequential state coherent across services by:

1. receiving constitutional evidence;
2. committing and submitting it to the DVN;
3. monitoring asynchronous DVN state;
4. reconciling pending receipts;
5. establishing the DVN Minted threshold;
6. propagating that finality to dependent services;
7. independently monitoring stronger Bitcoin anchoring where required;
8. preserving an attributable audit trail across those transitions.

The important future design question is therefore not merely how receipts are stored, but how **DVN Minted becomes a canonical runtime signal** that dependent services can consume without each capability implementing its own polling, reconciliation and finality interpretation.

## Required integrations to assess

The fast-follow architecture pass should explicitly assess wiring the DVN Spine to:

- Persona/personhood spine and Polity Passport;
- bounded delegation and agent attribution;
- SmartTriad, including SmartWallet, SmartContent and SmartMenu;
- constitutional agreements and authorization;
- governed capability execution;
- Standing and consequence propagation;
- Horizen and other external verification services;
- receipt/evidence surfaces;
- transaction and settlement services;
- future PoTS / PoWP and other proof services;
- future trusted-execution infrastructure, including the planned Vela integration.

## Agent model

The DVN agents/processes currently responsible for monitoring and reconciliation should be treated as operators of the DVN Spine, not necessarily as the primitive itself.

The architecture pass should determine the correct durable separation between:

- the **DVN Spine** as constitutional/runtime infrastructure;
- the **DVN agents** as active monitors/reconcilers/operators;
- the underlying **DVN network/canisters** as the evidentiary substrate;
- **Bitcoin** as an optional stronger external anchoring substrate.

Avoid agent-specific or capability-specific implementations of DVN lifecycle management.

## Fast-follow acceptance questions

After the Horizen experiment stabilizes, answer and implement against these questions:

1. Is there one canonical API/event for a consequential action to enter the DVN Spine?
2. Is `DVN Minted` represented once and consistently across the runtime?
3. Can a dependent service subscribe/react to DVN Minted rather than independently poll receipt state?
4. Are persona, delegation and acting-agent attribution preserved end-to-end?
5. Can SmartTriad actions enter the same evidence/finality path without bespoke integration?
6. Are Bitcoin-required transitions explicitly declared rather than inherited accidentally?
7. Can monitoring/reconciliation agents recover pending work without recreating the underlying constitutional event?
8. Is the spine generic enough for Horizen, Vela and future verification/execution networks?
9. Can operators inspect the full transition from event → DVN Minted → optional BTC Anchored?
10. Does failure remain attributable and fail closed only for the affected consequential dependency rather than unnecessarily freezing unrelated services?

## Sequencing

**Now:** stabilize and prove the generic Horizen admission journey with Nakamoto and MoneyPenny, including correct receipt attribution, DVN Minted progression, P&L/Pulse verification and the legitimate current Standing outcome.

**Fast follow:** DVN Spine architecture + implementation pass.

**Then:** use the stabilized generic admission/runtime and DVN Spine as the foundation for Vela trusted-execution integration and subsequent agent cohorts.

## Scope guard

This backlog item is deliberately **not authorization to refactor the protected DVN pipeline during the current pilot**.

Do not allow this architectural work to derail the current experiment. The Horizen/MoneyPenny run should provide additional evidence about attribution, reconciliation, external-service gating, finality propagation and recovery; incorporate those findings into the DVN Spine design when this item is activated.

## Provisional invariant

> **The Persona Spine establishes whose authority and consequence an action belongs to; the SmartTriad Spine provides the affordances through which consequential action occurs; the DVN Spine establishes and propagates the evidentiary and finality state of that action.**
