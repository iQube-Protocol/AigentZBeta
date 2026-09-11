# Factor + Aegis 0.1
## Product Requirements Document for the MoneyPenny Constitutional Financial Services Runtime

**Status:** Execution-ready implementation brief  
**Audience:** Claude / implementation agent  
**Date:** 2026-09-04  
**Target:** Existing metaMe codebase and MoneyPenny infrastructure  
**Delivery posture:** Extend existing primitives; do not create a parallel runtime  

---

## 1. Executive mandate

Build and deploy **Factor 0.1** and **Aegis 0.1** as a unified operational capability within the existing MoneyPenny Constitutional Financial Services Runtime.

Factor is the constitutional economic activation agent. It discovers or receives candidate agents, prepares them for iQube Registry registration, coordinates independent Aegis assessment, establishes their operational evidence, submits eligible candidates to MoneyPenny for admission, provisions approved financial and confidential-compute services, and catalyzes productive activity after admission.

Aegis is the independent trust-assessment membrane. It evaluates candidate agents, skills, harnesses, providers and capabilities using evidence-bound, falsifiable assessments. It makes recommendations and produces signed/hashed assessment records. It does not recruit candidates, grant jurisdiction, execute financial transactions or confer standing.

MoneyPenny remains the wallet-bearing financial copilot, runtime orchestrator and jurisdictional authority. Bankr is an external execution provider. Vela begins behind a simulated SDK and attestation adapter so the same application contract can later bind to Horizen live TEE services without rewriting Factor, Aegis or MoneyPenny.

This deliverable must make the following loop operational:

> **Attract → prepare → assess → register → admit → activate → transact → observe → update standing**

The product is not a demo-only sequence. It must create durable state, resumable workflows, evidence-bearing decisions, explicit authority boundaries and audit receipts.

### 1.1 Mandatory product topology

MoneyPenny is both the technical Constitutional Financial Services Runtime and its unified UX/UI runtime surface.

**Do not build Factor or Aegis as separate cartridges, standalone applications, competing copilots, independent navigation destinations or parallel runtimes.**

For this delivery:

- The existing **MoneyPenny cartridge** owns the session, navigation, user context, conversational shell, jurisdiction and runtime orchestration.
- The existing **MoneyPenny copilot in the left pane** remains the user's primary conversational relationship.
- **Factor** and **Aegis** are specialists available to the MoneyPenny copilot, following the established specialist pattern used within AgentMe.
- MoneyPenny may invoke, recommend, hand off to and return from either specialist without changing cartridges or losing case context.
- Users may also invoke either specialist explicitly from MoneyPenny.
- Specialist structured state is rendered in the **existing right pane** using contextual chips, capsules, cards, modals and expanded work surfaces.
- Factor and Aegis domain services must be reusable elsewhere in the estate later, but reuse must come from shared service boundaries—not from creating standalone cartridges in this implementation.

References in this PRD to a “Factor surface” or “Aegis surface” mean a specialist mode and its contextual right-pane instruments **inside the MoneyPenny cartridge**.

---

## 2. Canonical roles and separation of powers

| Actor | Canonical responsibility | Must not do |
|---|---|---|
| **Marketa** | Market the opportunity, attract agents/operators, run campaigns and communicate participant stories | Assess trust, ratify Registry admission or grant Financial Services jurisdiction |
| **Factor** | Recruit operationally, prepare dossiers, sponsor workflows, provision approved services, match participants and catalyze activity | Assess its own candidates, grant admission, fabricate evidence or override policy |
| **Aegis** | Independently assess capability, provenance, security, risk, controls and consequence readiness | Recruit for compensation, transact for candidates, grant admission or mutate standing directly |
| **iQube Registry** | Canonically record agents, capabilities, evidence, assessments, eligibility and bindings | Make unrecorded discretionary financial decisions |
| **MoneyPenny** | Hold and enforce financial mandates, orchestrate wallet activity and grant admission to its jurisdiction | Treat Bankr, Factor or Aegis as the source of human authority |
| **Bankr** | Provide linked wallet, quote, portfolio, payment, trading and onchain execution services | Become the canonical identity, delegation or constitutional record |
| **Horizen Pulse / P&L** | Provide observable operating and financial-performance evidence | Automatically confer standing merely because activity or profit exists |
| **Vela** | Provide confidential-compute jobs and attestations through a stable adapter | Become a second workflow or policy authority |
| **Human or accountable organization** | Supply ultimate authority, sponsorship and bounded delegation | Be silently replaced by agent self-authorization |

Hard invariants:

1. Factor can prepare and recommend a candidate for assessment, but cannot issue the Aegis decision.
2. Aegis can assess and recommend, but cannot admit a candidate to MoneyPenny.
3. MoneyPenny can admit only under an accountable operator's authority and the runtime's existing constitutional controls.
4. Registration, admission, delegation, wallet binding, service activation and standing are separate states.
5. Financial activity and profitability are evidence inputs, not standing by themselves.
6. Every external write must be attributable to a principal, mandate, policy decision and receipt.
7. No token launch is part of the automatic admission path.
8. UI placement does not determine constitutional identity: Factor is surfaced as a MoneyPenny specialist but remains an independently registered agent with its own identity, Participant Passport, metaMe wallet and standing history.
9. MoneyPenny may invoke Factor only through an explicit delegation/subdelegation chain. Specialist invocation must never manufacture authority.
10. Factor must complete the same Horizon Journey Spine it helps other agents complete.

### 2.1 Factor's dual operating mode

Factor is both a MoneyPenny specialist and an independently addressable constitutional agent.

It supports two authority modes:

1. **MoneyPenny-mediated mode** — the principal delegates to MoneyPenny; MoneyPenny invokes Factor as a specialist/sub-agent within the permitted scope. Every action records the principal → MoneyPenny → Factor authority chain. Factor receives no greater authority than MoneyPenny can validly subdelegate, and only where subdelegation is permitted.
2. **Direct-delegation mode** — an eligible principal delegates a bounded mandate directly to Factor. Factor remains surfaced through the MoneyPenny cartridge for this Financial Services experience, but the receipt records principal → Factor as the operative authority chain.

The UI must make the active mode and authority chain visible. A conversational handoff is not itself a delegation.

Factor requires:

- its own stable agent identity and Registry record
- accountable operator/owner binding
- Participant Passport or the estate's canonical non-human passport credential
- its own metaMe wallet
- a separately linked Bankr execution account/wallet where activated
- Horizen Presence
- Pulse integration
- P&L registration/integration
- bounded capability and permission declarations
- delegation and revocation support
- activity, consequence and standing history

The metaMe wallet remains Factor's constitutional wallet surface. A Bankr wallet is a linked execution account and must not replace Factor's canonical wallet identity.

Aegis requires a stable service/agent identity, provenance, policy versions and attributable receipts. Aegis need not be configured as a wallet-bearing economic agent in 0.1 unless existing runtime invariants require it. Its independence must not be compromised by direct delegation from the candidate it is assessing.

---

## 3. Product objectives

### 3.1 Primary objectives

1. Introduce Factor as a first-class specialist within the existing MoneyPenny cartridge using the estate's established AgentMe-style specialist, split-pane and conversation patterns.
2. Introduce Aegis as a first-class specialist within the existing MoneyPenny cartridge and as a reusable underlying assessment service.
3. Operationalize candidate intake from external ecosystems or the iQube Registry.
4. Support evidence-bound readiness assessment and MoneyPenny admission.
5. Represent Bankr as a linked execution account within the metaMe wallet experience.
6. Support Vela-simulated confidential-compute jobs with deterministic, verifiable development attestations.
7. Connect Presence, Pulse and P&L evidence to admission and standing inputs without allowing automatic or circular self-ratification.
8. Produce a durable activity ledger covering discovery, assessment, admission, activation and subsequent economic activity.
9. Make later Factor tokenization possible without coupling the core product to a token contract.
10. Register and activate Factor itself through the complete Horizon Journey Spine before treating it as capable of sponsoring the equivalent journey for others.
11. Capture Factor's generic agent-constitution and activation process as a reusable DevOn skill for scaffolding future white-label constitutional financial-services agents.

### 3.2 Secondary objectives

- Give Marketa a clean handoff into Factor through campaign/referral metadata.
- Create a provider-neutral financial-services adapter boundary.
- Create an assessment framework that can later support the Trusted Intelligence Index.
- Provide a visible pipeline of candidate and admitted agents.
- Create metrics demonstrating Factor's productive activity before any token launch.
- Turn the implementation knowledge produced while constituting Factor into a reproducible AgentiQ OS/DevOn capability rather than leaving it embedded in one agent.

### 3.3 Non-goals for 0.1

- Launching the Factor token.
- Issuing equity, governance rights or claims on metaMe, MoneyPenny or Registry assets.
- Building a replacement metaMe wallet.
- Importing or exporting Bankr private keys.
- Implementing a production escrow, exchange, bank or regulated custody product.
- Automatically approving agents based on profitability, transaction volume or token ownership.
- Replacing the iQube Registry, existing Passport/delegation primitives, Pulse/P&L services or MoneyPenny orchestration.
- Claiming live TEE security while the Vela SDK is simulated.
- Rebuilding Factor itself through DevOn during this delivery.
- Encoding Factor's recruitment, assessment coordination, service matching or other product-specific behavior into the reusable agent-bootstrap skill.
- Automatically launching a token for any generated agent.

---

## 4. Core user journeys

### Journey 0 — Factor's own constitutional activation

Factor must dogfood the agent journey before operating as an activation specialist:

1. Create or resolve Factor's accountable operator and stable agent identity.
2. Create Factor's iQube Registry candidate record and capability declarations.
3. Issue or bind the applicable Participant Passport through the existing constitutional process.
4. Create or bind Factor's own metaMe wallet.
5. Register Factor within Horizen and establish Presence.
6. Register or activate Pulse and P&L integrations.
7. Prove control of its metaMe wallet and any linked Bankr execution account.
8. Submit Factor to an independent Aegis assessment. Factor cannot assess itself.
9. Establish sponsorship and bounded delegation.
10. Submit Factor to MoneyPenny for admission.
11. Ratify its permitted capabilities and any right to receive subdelegated work.
12. Produce the canonical observer/audit receipts.
13. Begin accruing standing only through observed, evidenced activity after activation.

Bootstrap must not be circular. If Aegis itself is not yet ratified, use the estate's existing independent operator/constitutional review pattern to ratify Aegis 0.1 and Factor's first assessment, record the bootstrap basis explicitly, and prevent Factor from participating in its own approval.

Factor must not present itself as fully activated merely because its UI specialist is enabled. Distinguish:

- specialist available
- Registry registered
- Horizen registered/present
- Pulse enabled
- P&L enabled
- wallet bound
- Aegis assessed
- MoneyPenny admitted
- delegation eligible
- directly delegated
- active under MoneyPenny subdelegation

### Journey A — Candidate intake

1. An operator, Marketa referral or Registry record supplies a candidate.
2. Factor resolves whether the candidate already exists in the Registry.
3. Factor creates or resumes one candidate case; duplicate cases must not be created.
4. The accountable operator is resolved and bound.
5. Factor records declared capabilities, endpoints, code/skill provenance, intended financial services and requested jurisdiction.
6. Missing evidence becomes explicit checklist items.
7. The operator can pause and resume without losing state.

### Journey B — Aegis assessment

1. Factor submits an immutable evidence snapshot to Aegis.
2. Aegis assigns an assessment policy/version and calculates an evidence-set hash.
3. Assessment dimensions are executed independently where possible.
4. Each finding records claim, evidence, method, result, confidence, limitations and falsification condition.
5. Aegis returns one of:
   - **admissible**
   - **admissible_with_conditions**
   - **insufficient_evidence**
   - **not_admissible**
6. Aegis produces a canonical assessment hash and receipt.
7. Changes to candidate evidence create a new assessment version; historical decisions remain immutable.

### Journey C — Registration and admission

1. An eligible candidate's Aegis record is bound to its Registry record.
2. Factor checks Presence, Pulse/P&L readiness, proof of wallet control, accountable operator, Passport/sponsorship and bounded delegation.
3. Factor submits an admission packet to MoneyPenny.
4. MoneyPenny resolves the current principal and evaluates the packet against runtime policy.
5. MoneyPenny admits, conditionally admits or rejects.
6. Admission produces an observer/audit receipt.
7. Factor cannot alter the MoneyPenny decision.

The bootstrap-compatible sequence is:

> Registry presence → Pulse/P&L transparency → proof of wallet control → Aegis assessment → operator Passport → sponsorship → bounded delegation → MoneyPenny ratification → observer receipt

Factor offers two candidate pathways:

- **Registry pathway:** iQube Registry registration and the Aegis evidence/assessment appropriate to the declared capability.
- **Full Horizon pathway:** Registry pathway plus Horizen registration/Presence, optional or required Pulse/P&L services, wallet-control proof, Passport/sponsorship/delegation and MoneyPenny admission as applicable.

Pulse and P&L are premium services Factor may facilitate for other agents, except where a specific jurisdiction, capability or admission policy makes either mandatory. The UI and policy engine must distinguish optional premium enablement from mandatory readiness evidence.

### Journey D — Bankr-linked wallet activation

1. An admitted agent requests Bankr services through Factor.
2. The metaMe wallet displays Bankr as a linked execution account.
3. The binding records provider, provider account identifier, public wallet addresses, supported chains, ownership/control proof, permissions, status and last verification.
4. Read-only portfolio access is activated first.
5. Transactional permissions require a separate, explicit mandate.
6. Spending limits, transaction limits, permitted recipients and available operations are visible.
7. Every proposal displays expected asset movement, fees, destination, policy outcome and required approval.
8. Completed operations return provider and chain receipts into MoneyPenny's canonical activity record.

The integration must not claim that the Bankr embedded wallet and metaMe wallet share one private key. The metaMe wallet is the unified constitutional surface; Bankr is a linked execution account.

### Journey E — Vela simulated confidential compute

1. Factor or Aegis submits a confidential-compute job through a provider-neutral Vela interface.
2. The simulator accepts the same request envelope expected of the future live SDK.
3. It returns a clearly labeled simulated attestation including:
   - job identifier
   - workload/policy identifier and version
   - input commitment/hash
   - output commitment/hash
   - simulator measurement
   - start/end timestamps
   - result status
   - attestation mode = simulated
4. Production policy must reject simulated attestations where live TEE evidence is required.
5. No UI, API or receipt may describe simulated execution as TEE-secured.

### Journey F — Productive activity

After admission, Factor can:

- Match a registered agent to a declared service need.
- Help establish a bounded mandate and budget.
- Provision approved Bankr/x402 or Vela capabilities.
- Coordinate execution without bypassing MoneyPenny approval.
- Record delivery and settlement receipts.
- Send observed outcomes into Pulse/P&L.
- Propose standing events through the existing standing mechanism.

Factor must never write standing directly. Standing updates remain subject to the estate's existing evidence and ratification controls.

### Journey G — Delegating to Factor

1. The user selects an outcome such as Registry assistance, full Horizon activation, service matching or financial-service provisioning.
2. MoneyPenny resolves whether the user is delegating to MoneyPenny with permitted Factor subdelegation or directly to Factor.
3. The system presents Factor's identity, current standing, Passport/Registry status, capabilities, constraints and requested mandate.
4. The user confirms a bounded delegation through existing delegation controls.
5. The mandate records allowed actions, assets/data, duration, financial limits, counterparties, approval thresholds, subdelegation rights and revocation.
6. Factor acts only inside that envelope.
7. Every material action and provider request carries the resolved authority-chain reference.
8. Revocation prevents new Factor actions immediately at the MoneyPenny layer.

### Journey H — Capture the DevOn agent-bootstrap skill

As Factor is constituted and passed through the Journey Spine, capture the generic, repeatable steps as an end-to-end DevOn skill provisionally named:

> **Constitutional Financial Agent Bootstrap**

The skill must be usable later by DevOn to scaffold and prepare a white-label constitutional financial-services agent without reproducing Factor's domain-specific capabilities.

The skill's workflow must:

1. Collect the proposed agent's purpose, accountable operator, intended jurisdiction and initial capability envelope.
2. Create the minimum agent shell using existing repository patterns.
3. Establish or prepare its stable metaMe agent identity.
4. Establish its accountable operator/owner binding.
5. Issue or prepare the canonical Participant Passport flow.
6. Create or bind its own metaMe wallet.
7. Create or prepare its iQube Registry record and capability declarations.
8. Register or prepare registration within Horizen and establish Presence.
9. Configure Pulse and P&L registration hooks as optional, premium or policy-required services.
10. Configure delegation, subdelegation, revocation and authority-chain support.
11. Configure activity receipts, consequence evidence and standing-event proposal hooks.
12. Configure provider-neutral wallet and confidential-compute adapter slots.
13. Optionally configure a Bankr linked execution account.
14. Optionally expose a separately confirmed Bankr token-launch pathway without executing a token launch by default.
15. Generate readiness checks and evidence requirements for independent Aegis assessment.
16. Generate the admission packet shape required by MoneyPenny.
17. Produce a manifest/report identifying what is generated, configured, simulated, pending operator action and pending external ratification.

The skill must stop at agent standing-up and constitutional/financial-runtime readiness. It must not invent the generated agent's business logic, market proposition, specialized tools, assessment result, standing or transactional authority.

The skill is a product deliverable and must be captured from the actual Factor implementation path—not written as aspirational documentation disconnected from working primitives.

---

## 5. Product surfaces

### 5.0 One-cartridge composition

The implementation must preserve one coherent MoneyPenny experience:

| Layer | Owner | Required behavior |
|---|---|---|
| Session and navigation | MoneyPenny cartridge | One continuous session; no cartridge change to use Factor or Aegis |
| Conversational shell | MoneyPenny copilot, left pane | Detect intent, invoke specialists, explain state and resume control |
| Specialist reasoning | Factor or Aegis | Receive only the bounded context and authority required for the current case |
| Structured interaction | Existing right pane | Render chips, capsules, cards, modals and expanded work surfaces contextually |
| Technical runtime | MoneyPenny services | Enforce jurisdiction, mandates, policy, provider access and receipts |
| Reusable domain services | Factor/Aegis services | Remain callable by MoneyPenny now and potentially other estate runtimes later |

Specialist invocation must preserve:

- authenticated principal and viewer context
- active MoneyPenny conversation/session
- active Factor case or Aegis assessment
- applicable mandate and delegation
- provenance of the handoff
- return path to MoneyPenny
- the resolved direct or subdelegated authority chain

Do not create duplicate specialist chat histories when the existing conversation and specialist-context patterns can represent the handoff.

### 5.1 Factor surface

Implement Factor as a MoneyPenny specialist using the existing left-right copilot pattern:

- **Left:** MoneyPenny remains the host copilot. When Factor is active, the pane clearly identifies the Factor specialist context while preserving the MoneyPenny session and return path.
- **Right:** Factor case chips, capsules, modals and structured operational state render within MoneyPenny's existing right pane.

Required right-side views:

1. **Pipeline** — discovered, preparing, assessment, registration-ready, admission-ready, admitted, activated, paused/rejected.
2. **Candidate** — operator, identity, declared capabilities, provenance and requested services.
3. **Evidence** — required, supplied, stale, contradicted and missing evidence.
4. **Assessment** — current Aegis status, findings, limitations and receipt.
5. **Admission** — Passport, sponsorship, delegation, wallet proof, Pulse/P&L and MoneyPenny decision.
6. **Services** — Bankr wallet/account, Vela jobs, x402 endpoints and other provider services.
7. **Activity** — jobs, payments, receipts, outcomes and standing proposals.
8. **Factor identity** — Registry, Participant Passport, Horizen Presence, metaMe wallet, Pulse/P&L, Aegis decision and standing.
9. **Authority** — active principal, direct versus MoneyPenny-mediated mode, delegation chain, limits and revocation.

Factor quick actions:

- Add candidate
- Resume case
- Request evidence
- Submit to Aegis
- Prepare Registry record
- Verify wallet control
- Prepare admission packet
- Request MoneyPenny admission
- Link Bankr account
- Run Vela simulation
- Find service opportunity
- View receipts
- View Factor credentials
- Delegate to Factor
- Revoke Factor mandate

All actions must be state-aware. Impossible or unauthorized actions must be disabled with a reason and required next step.

### 5.2 Aegis surface

Aegis must be usable inside a Factor case or invoked directly by the MoneyPenny copilot. “Directly” means without a Factor case; it does not mean outside the MoneyPenny cartridge.

Required views:

1. **Assessment queue**
2. **Assessment dossier**
3. **Evidence graph**
4. **Findings by dimension**
5. **Conditions and exceptions**
6. **Decision and canonical receipt**
7. **Version history**

The first assessment dimensions:

- Accountable operator and authority
- Identity/personhood bindings
- Capability evidence
- Provenance and source integrity
- Security posture
- Permission and delegation compatibility
- Wallet/control evidence
- Financial and transaction risk
- Reversibility and revocation
- Observability/Pulse readiness
- P&L evidence quality
- Confidential-compute readiness
- Consequence awareness and risk-of-repair
- Known limitations and unresolved contradictions

Scoring may aid navigation, but the canonical output is a reasoned decision with evidence and conditions. A single composite number must not conceal a critical failure.

Aegis is architecturally broader than MoneyPenny and its underlying services must remain reusable by the Registry, DevOn, Research and future runtimes. That estate-wide scope does not justify a separate Aegis cartridge in this deliverable.

### 5.3 MoneyPenny surfaces

Extend, do not replace:

- Existing left-pane copilot routing and specialist invocation.
- Existing right-pane chip, capsule, modal and expanded-surface composition.
- Linked accounts within metaMe wallet.
- Admission request and decision view.
- Mandate/permission view.
- Proposed and completed transaction receipts.
- Factor agent status within the runtime.
- Provider health/status for Bankr and Vela simulator.

### 5.4 Administrative surface

Use existing admin and access-control conventions. Provide:

- Aegis policy/version management.
- Provider configuration and environment health.
- Simulation/live-mode visibility.
- Assessment exception review.
- Admission policy visibility.
- Feature flags and cohort gating.
- Audit/event inspection.

Secrets must never be exposed to browser clients or persisted in assessment evidence.

---

## 6. State machines

### 6.1 Factor case state

```
discovered
  → preparing
  → assessment_pending
  → assessment_in_progress
  → evidence_remediation | assessment_complete
  → registry_ready
  → admission_pending
  → admitted | conditionally_admitted | rejected
  → activation_pending
  → active
```

Any nonterminal state may become `paused`. Rejection and supersession must retain history. Transitions must be validated server-side and idempotent.

### 6.2 Aegis assessment state

```
draft → evidence_locked → running → review_required → ratified
                                      ↘ failed
```

Ratified assessments are immutable. A correction or new evidence creates a successor version linked to the prior assessment.

### 6.3 Provider activation state

```
unlinked → proof_pending → linked_read_only → transactional_pending → active
                                                    ↘ denied
active → suspended → revoked
```

Provider state must never silently imply MoneyPenny admission.

---

## 7. Data and domain requirements

Before adding migrations, inspect and reuse existing tables/services for:

- agents/personas and Registry assets
- auth profiles and principals
- Passport, sponsorship and delegation
- wallets and wallet bindings
- MoneyPenny service orchestration
- Pulse and P&L registration
- standing events
- evidence/provenance and Crystal records
- constitutional decisions and observer receipts
- provider integrations

Do not duplicate an existing source of truth.

Where no suitable structures exist, introduce the minimum normalized domain objects:

- `factor_cases`
- `factor_case_events`
- `factor_evidence_items`
- `aegis_assessments`
- `aegis_findings`
- `aegis_assessment_versions` or equivalent immutable version linkage
- `wallet_provider_bindings`
- `financial_service_activations`
- `confidential_compute_jobs`
- `constitutional_activity_receipts`
- an authority-chain/subdelegation representation only if the existing delegation model cannot express principal → MoneyPenny → Factor without ambiguity

Names are provisional. Follow repository naming conventions discovered during implementation.

Every mutable resource requires:

- stable identifier
- tenant/owner scope
- created/updated timestamps
- current state
- acting principal
- relevant mandate/delegation reference
- idempotency key for command operations
- policy/version reference where applicable
- immutable event or receipt linkage
- operative authority-chain reference for delegated actions

Assessment and receipt hashes must be derived from canonicalized payloads, not unstable JSON serialization.

Row-level security and service authorization must preserve tenant isolation. Admin access is not a substitute for correct ownership checks.

---

## 8. Service contracts and adapters

### 8.1 Bankr adapter

Create a provider-neutral interface, then implement Bankr behind it.

Required 0.1 capabilities:

- provider health
- resolve linked wallet/account
- portfolio and balances
- supported chains/capabilities
- swap quote or transaction proposal where already safe to support
- transaction status
- provider receipt normalization

Write capabilities must be feature-flagged and fail closed. Default development flow is read-only.

API keys remain server-side. Store only references to managed secrets. Log neither credentials nor raw authorization headers.

### 8.2 Vela adapter

Define one interface for both simulator and future Horizon TEE provider:

- submit job
- get status
- cancel where supported
- retrieve result commitment
- retrieve attestation
- verify attestation
- provider health/capabilities

The simulator must be deterministic for identical canonical request fixtures where appropriate, and its verifier must explicitly verify only simulated attestations. Live and simulated verifiers must be distinct implementations behind the same application contract.

### 8.3 Aegis engine

Aegis assessments must be policy-driven and versioned. Separate:

- evidence collection
- deterministic checks
- model-assisted analysis
- human/operator ratification where required
- canonical decision creation

Model output must never directly mutate admission state. Parse and validate structured output, preserve citations/evidence references, isolate exceptions and require deterministic decision constraints for critical failures.

---

## 9. Security, authority and consequence controls

1. Default all Bankr operations to read-only.
2. Require explicit, scoped delegation for transactional operations.
3. Enforce per-action authorization server-side.
4. Require step-up or existing constitutional confirmation patterns for material transfers.
5. Present proposals before execution unless an existing bounded autonomous mandate explicitly permits execution.
6. Apply amount, cadence, recipient, asset, chain and operation constraints.
7. Make revocation immediate at the MoneyPenny layer even if a provider credential remains technically valid.
8. Maintain a runtime kill switch for Factor transactional activity.
9. Distinguish provider failure, policy denial, insufficient authority and user cancellation.
10. Never allow Factor to assess itself or Aegis to ratify its own code changes without independent evidence.
11. Treat community skills as separate assessable assets; provider approval must not transitively approve all Bankr skills.
12. Run all candidate-supplied code in the estate's established containment pattern.
13. Bind external responses and webhooks to verified provider identity and replay protection.
14. Redact confidential inputs from ordinary application logs.
15. Validate subdelegation rights explicitly; possession of a MoneyPenny session is not permission to delegate to Factor.
16. Compute Factor's effective authority as the intersection of the principal mandate, MoneyPenny's capability/delegation limits, Factor's ratified capability scope and provider policy.
17. Direct and MoneyPenny-mediated Factor mandates must be independently revocable and distinguishable in audit records.
18. Factor's own wallet, standing or token holdings must never expand its delegated authority.

---

## 10. Standing, Pulse and P&L

Factor may emit **standing proposals**, not standing awards.

An eligible proposal contains:

- subject agent
- witnessed action
- mandate under which it acted
- expected outcome
- observed outcome
- veracity evidence
- contribution evidence
- risk-of-repair evidence
- Pulse/P&L references
- receipts and hashes
- proposing principal/service

Positive economic outcome alone is insufficient. High volume, token price or profit must not substitute for constitutional compliance, usefulness or bounded operation.

Failure, remediation and responsible revocation may also be standing-relevant. Preserve negative and contradictory evidence.

---

## 11. Factor token readiness—instrumentation only

Do not launch a token in this deliverable.

Instrument the productive metrics necessary for a later go/no-go decision:

- candidates discovered
- qualified referrals
- evidence completion rate
- Aegis assessments completed
- median assessment duration
- Registry registrations
- MoneyPenny admissions
- linked financial accounts
- activated Vela workloads
- service matches
- completed jobs
- settled value
- compute/service costs
- provider fees
- reversals/remediations
- standing proposals accepted/rejected
- recurring active agents

The future token must not grant:

- Registry or Aegis decision rights
- MoneyPenny admission rights
- standing
- access to another user's assets
- ownership of metaMe/MoneyPenny
- guaranteed returns

Create no token dependency in core IDs, permissions, workflow states or service pricing.

The DevOn bootstrap skill may prepare an optional Bankr token-launch integration point, but token issuance must be a separate, explicit, authority-checked workflow. Generated agents must remain fully operable without a token.

---

## 11A. DevOn Constitutional Financial Agent Bootstrap skill

### Purpose

Provide AgentiQ OS/DevOn with a repeatable capability for standing up the constitutional shell of a custom financial-services agent.

### Required inputs

- agent name and purpose
- accountable operator/organization
- requested jurisdiction(s)
- declared capabilities and explicit exclusions
- wallet/provider requirements
- Registry-only or full Horizen pathway
- Pulse/P&L option or requirement
- confidential-compute requirement
- intended delegation mode
- environment and cohort/access posture

### Required generated outputs

- agent manifest and stable configuration
- identity/operator binding configuration
- Participant Passport journey configuration
- metaMe wallet binding
- iQube Registry registration payload or draft
- Horizen Presence registration payload or draft when selected
- Pulse/P&L integration configuration
- delegation/revocation policy skeleton
- provider adapter configuration
- Aegis evidence/readiness manifest
- MoneyPenny admission-packet scaffold
- activity/receipt and standing-proposal hooks
- targeted tests and validation report
- operator checklist for external actions that cannot be automated

### Safety and constitutional constraints

- Reuse canonical estate services; do not generate duplicate identity, wallet, Registry, standing or delegation systems.
- Default provider integrations to read-only and least authority.
- Generate no credential, Passport, assessment, admission, standing or proof that has not actually been issued or ratified.
- Never make the generated agent its own assessor or admitting authority.
- Keep agent-specific capabilities outside the generic bootstrap core.
- Make token support opt-in, separable and disabled by default.
- Bind every generated artifact to the template/skill version used.
- Support idempotent resume so rerunning the skill does not create duplicate agents, wallets or Registry records.

### Packaging

Package the capability in the repository's canonical DevOn/skill format after inspecting current skill conventions. Include:

- complete `SKILL.md`
- minimum necessary templates/assets
- deterministic scripts or generators where appropriate
- reference manifest/schema
- example fixture based on Factor with Factor-specific secrets and live identifiers removed
- tests for generation, idempotent resume and invariant preservation
- concise invocation and handoff documentation

Do not create an isolated scaffolding framework when the repository already has a skill, template or DevOn capability mechanism.

---

## 12. API requirements

Follow existing API conventions. At minimum support commands/queries equivalent to:

- create/list/read/resume Factor case
- add or resolve evidence
- submit immutable evidence snapshot to Aegis
- list/read/ratify assessment where authorized
- prepare/read admission packet
- request/read MoneyPenny admission decision
- create/verify/read wallet-provider binding
- read portfolio/provider capabilities
- create/read a transaction proposal
- submit/read/cancel Vela simulated job
- list/read normalized activity receipts
- propose a standing event
- inspect and invoke the DevOn constitutional-financial-agent bootstrap skill through the estate's established development workflow

Command endpoints require idempotency and must return the canonical resulting resource or receipt. Reads must not produce hidden writes.

---

## 13. Access and feature flags

Initial release:

- admin and explicitly permitted development cohort
- no public transactional access
- read-only Bankr integration by default
- Vela simulator visibly marked
- Aegis policy editing admin-only
- assessment submission limited to authenticated accountable operators/authorized services

Suggested flags, adapted to repository conventions:

- `factor_enabled`
- `aegis_enabled`
- `bankr_linked_wallet_enabled`
- `bankr_transactions_enabled`
- `vela_simulator_enabled`
- `factor_service_matching_enabled`

Flags supplement authorization; they do not replace it.

---

## 14. Acceptance criteria

The deliverable is complete only when all of the following are demonstrated:

1. A candidate can be created or resolved once and resumed idempotently.
2. Factor shows missing evidence and cannot bypass it.
3. Factor submits a hashed, immutable evidence snapshot to Aegis.
4. Aegis produces dimensioned findings with evidence references, limitations and falsification conditions.
5. A critical failed invariant prevents an admissible decision regardless of aggregate score.
6. Aegis ratification creates a stable assessment hash and immutable receipt.
7. Factor cannot author or mutate the ratified Aegis decision.
8. Registry readiness and MoneyPenny admission are represented as separate states.
9. MoneyPenny independently authorizes or rejects admission.
10. An observer/audit receipt records the admission decision.
11. A Bankr account can be represented as a linked execution account inside the metaMe wallet surface.
12. Read-only portfolio data can be retrieved through the adapter when configured.
13. No Bankr credential reaches the client or logs.
14. Transactional Bankr operations are disabled by default and fail closed without a mandate.
15. A Vela simulated job can be submitted, completed and verified.
16. All simulated attestations are unmistakably labeled and rejected by live-only policy.
17. Pulse/P&L evidence can be attached to a case and a standing proposal.
18. Factor cannot award standing directly.
19. Marketa referral provenance can be retained without making Marketa the assessor.
20. The full workflow is covered by targeted unit/integration tests and at least one end-to-end happy path plus failure paths.
21. Factor has its own Registry identity, Participant Passport binding, metaMe wallet, Horizen Presence, Pulse/P&L state, Aegis assessment and standing history represented through canonical existing primitives.
22. Factor's own Horizon Journey Spine can be executed and resumed with durable state and receipts.
23. The UI distinguishes specialist availability from Factor's constitutional activation/admission state.
24. MoneyPenny-mediated invocation records principal → MoneyPenny → Factor and fails if subdelegation is absent or prohibited.
25. Direct delegation records principal → Factor and uses the same bounded-delegation and revocation controls.
26. Factor's Bankr execution account is linked beneath, and does not replace, Factor's metaMe wallet.
27. Factor can offer Registry-only and full Horizon candidate pathways.
28. Pulse/P&L premium-option status is distinguishable from cases where policy makes it mandatory.
29. Factor's generic constitution/activation path is captured as an installable or otherwise canonical DevOn skill using existing repository conventions.
30. The skill can generate a second test agent shell without copying Factor-specific recruitment, matching or assessment-coordination behavior.
31. The generated test agent has distinct identity/configuration and can progress through Registry-only or full Horizen readiness without colliding with Factor.
32. Rerunning the skill resumes idempotently and does not duplicate agent, wallet or Registry records.
33. The generated agent is viable without Bankr or a token; both remain optional integrations.
34. Token launch cannot occur as an implicit consequence of scaffolding or registration.
35. The skill reports issued/ratified state separately from generated, configured, simulated and pending state.

Required failure-path tests:

- duplicate candidate submission
- stale or changed evidence after assessment lock
- Factor attempts self-assessment
- missing accountable operator
- missing or revoked delegation
- assessment critical failure
- replayed admission command
- cross-tenant resource access
- Bankr credential absent/invalid
- Bankr transaction attempted while read-only
- provider timeout or malformed receipt
- simulated Vela attestation presented to live-only policy
- standing proposal without consequence evidence
- Factor enabled as a UI specialist but not constitutionally activated
- MoneyPenny attempts to invoke Factor without subdelegation permission
- Factor attempts an action exceeding the intersection of delegated and ratified authority
- revoked direct Factor mandate
- Factor attempts to participate in its own Aegis assessment
- Bankr account presented as Factor's canonical metaMe wallet
- bootstrap skill accidentally copies Factor-specific business capabilities
- bootstrap skill fabricates a Passport, Aegis approval, MoneyPenny admission or standing
- bootstrap skill rerun creates duplicate agent/wallet/Registry records
- token launch requested without separate authority and confirmation

---

## 15. Implementation sequence

### Phase 0 — Repository reconnaissance

Before editing:

1. Read applicable `AGENTS.md` and repository instructions.
2. Map the current MoneyPenny orchestration, wallet, Registry, Passport/delegation, Pulse/P&L, standing, receipt, feature-flag and UI patterns.
3. Identify current migrations and deployment posture.
4. Produce a concise implementation map naming the primitives to reuse and genuine gaps.
5. Do not implement a duplicate abstraction where an existing one can be extended.

### Phase 1 — Domain and constitutional workflow

- Factor's own Horizon Journey Spine activation and identity/wallet/Passport bindings
- Factor case state
- Aegis assessment/evidence/decision state
- immutable receipts
- admission packet
- authorization and feature gating
- direct and MoneyPenny-mediated delegation chains

### Phase 2 — Surfaces

- Factor specialist mode inside the existing MoneyPenny split-pane experience
- Aegis specialist mode, assessment queue and dossier inside the existing MoneyPenny split-pane experience
- MoneyPenny admission and linked-account extensions
- admin inspection

### Phase 3 — Providers

- provider-neutral wallet interface
- Bankr read-only adapter
- provider-neutral confidential-compute interface
- Vela simulator and simulated attestation verifier

### Phase 4 — Runtime activation

- Pulse/P&L evidence
- standing proposals
- activity ledger
- service matching stub or first bounded path

### Phase 4A — DevOn capability capture

- Extract the generic Factor constitution and Journey Spine procedure
- Implement the Constitutional Financial Agent Bootstrap skill in the repository's existing skill/DevOn format
- Parameterize identity, operator, pathway, wallet providers, Pulse/P&L and delegation posture
- Remove Factor-specific behavior and live identifiers from the reusable template
- Generate a distinct fixture/test agent
- Verify idempotent resume and constitutional invariants

### Phase 5 — Verification and deployment

- migrations
- generated types
- unit/integration/end-to-end tests
- lint/typecheck/build
- access-control and cross-tenant tests
- deploy according to the repository's established development workflow
- verify live routes and fail-closed behavior where environment access permits

---

## 16. Claude execution instructions

1. Treat this PRD as product and constitutional intent; verify implementation details against the current codebase.
2. Preserve and extend existing abstractions before introducing new ones.
3. Before implementing UI, locate and reuse the established AgentMe specialist invocation pattern and MoneyPenny cartridge's existing left/right-pane composition. Do not scaffold separate Factor or Aegis cartridges, standalone copilot shells or parallel navigation.
4. Do not silently weaken an invariant because an integration is inconvenient.
5. Do not invent successful provider, migration or deployment verification.
6. Keep unrelated user changes intact.
7. Make cohesive commits with clear scope.
8. If a live Bankr key is unavailable, implement and test the adapter with fixtures/mocks and report live verification as outstanding.
9. If live Horizen Vela is unavailable, complete the simulator path and never describe it as live TEE execution.
10. If an architectural conflict is discovered, stop before creating a parallel source of truth and report the precise conflict with a recommended resolution.
11. At handoff, provide:
    - implementation map
    - changed files
    - migrations and whether they ran
    - tests and exact results
    - security/authority checks
    - live verification completed
    - remaining genuine gaps
    - commit hashes and deployment state
    - Factor's actual Journey Spine state, clearly separating implemented, simulated, migrated, activated and live-verified stages
    - DevOn skill package location, invocation, generated fixture, tests and any manual/external steps it cannot complete

---

## 17. Product definition of done

Factor 0.1 is operational when a real authenticated operator can take a candidate agent from discovery through evidence preparation, independent Aegis assessment, Registry readiness, MoneyPenny admission and simulated service activation with durable receipts.

Factor itself must first be represented as a real constitutional agent that has passed, or is transparently progressing through, the same Registry and Horizon Journey Spine. Merely rendering the Factor specialist does not satisfy this requirement.

The delivery is reusable when DevOn can invoke the captured bootstrap skill to stand up a distinct white-label constitutional financial-services agent shell using the same canonical identity, wallet, Registry, Horizen, Pulse/P&L, delegation, receipt and standing primitives—without copying Factor's specialized business behavior.

Aegis 0.1 is operational when it can independently generate an evidence-bound, versioned, falsifiable and immutable assessment that Factor cannot rewrite and MoneyPenny can consume without delegating its admission authority.

The system is constitutionally coherent when:

> **Marketa attracts. Factor activates. Aegis assesses. The Registry records. MoneyPenny authorizes. Bankr executes. Vela protects. Horizen observes. Standing remembers.**
