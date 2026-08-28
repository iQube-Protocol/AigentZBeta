# Constitutional Financial Services

**Artifact:** CFS-WHITEPAPER-OVERVIEW-2026-08-28  
**Subtitle:** Confidential execution, verifiable transparency, and risk-routed financial agency  
**Status:** WHITEPAPER OVERVIEW / PUBLIC DRAFT  
**Published through:** AgentiQ OS  
**As-of:** 28 August 2026

## Executive overview

Constitutional financial services are financial services in which every consequential action is governed by explicit, inspectable rules about personhood, authority, privacy, execution, evidence, and accountability.

The objective is not simply to place artificial intelligence on top of existing financial infrastructure. It is to create a financial operating environment in which people and agents can collaborate safely: a person can delegate a bounded financial task to an agent; the agent can act only within that delegation; sensitive information can remain confidential; transactions can be routed through an execution environment appropriate to their risk; and the resulting activity can be verified without exposing the underlying private data indiscriminately.

This model brings together four complementary capabilities:

- **Constitutional authority:** personhood, sponsorship, delegation, policy, expiry, revocation, and standing govern who or what may act.
- **Vela confidential execution:** sensitive financial intent, data, strategy, and computation can be handled within a protected layer rather than exposed to every participant or system.
- **Pulse and P&L transparency:** transactions, operational state, and financial results can produce permissioned, verifiable evidence rather than relying on unexamined claims or unrestricted access to raw records.
- **Risk-routed execution:** value, risk, price sensitivity, privacy, reversibility, and market impact determine whether an action can proceed automatically, requires human approval, must be executed inside a trusted execution environment, or must be held or denied.

The advanced end state is a consequence-aware financial service in which the route to execution is itself governed. A low-value, reversible payment may proceed through ordinary bounded automation. A high-value, privacy-sensitive, price-sensitive, or strategically consequential transaction may be automatically routed to a trusted execution environment (TEE), with attestation and stronger approval requirements. Unknown, prohibited, or insufficiently evidenced actions fail closed.

## 1. Why finance needs a constitutional layer

Financial systems traditionally make trade-offs between confidentiality and transparency, speed and control, automation and accountability. Agentic systems intensify those tensions. An autonomous service may be able to identify an opportunity, construct a transaction, move funds, generate a report, and communicate with counterparties. Capability alone, however, is not authority.

A safe financial agent must answer several questions before it acts:

1. Who is the principal behind this action?
2. What authority has been granted, by whom, for how long, and for which surfaces?
3. Which policies and limits apply to the proposed transaction?
4. What information may be disclosed, to whom, and for what purpose?
5. Which execution environment is appropriate to the transaction's value and risk?
6. What evidence proves what happened without unnecessarily disclosing private data?
7. How does the outcome affect the standing of the people, agents, and services involved?

Constitutional financial services treat these questions as part of the transaction itself, not as optional compliance added after execution.

## 2. What “constitutional” means

The constitutional layer is a system of enforceable boundaries. It does not depend on an agent merely stating that it behaved correctly. It separates identity, authority, execution, and evidence so that each can be independently examined.

### Personhood before financial agency

A persistent constitutional identity establishes the human or agent participating in the system. A wallet address, account, API key, or model identifier can support verification, but none is sufficient on its own to establish legitimate financial agency.

### Authority before action

Registration in an external service does not create internal authority. Authority is established through explicit sponsorship and delegation. A delegation is bounded by purpose, permitted actions, surfaces, value limits, duration, and revocation conditions.

### Least authority and reversibility

An agent receives the smallest useful capability for the shortest useful period. Where possible, actions remain reversible until the relevant checks and approvals are complete. Authority can expire or be revoked without changing the underlying identity of the agent.

### Evidence rather than assertion

Transactions and decisions generate receipts. These may record the governing policy, the authority used, the execution route, the outcome, and references to supporting proofs. Receipts allow later verification without treating a chat transcript or interface state as the system of record.

### Standing as accumulated consequence

Standing expresses the consequences of prior conduct. It is not a popularity score. It can reflect whether an actor operated within authority, produced valid evidence, reconciled outcomes, and responded appropriately when a transaction was blocked or disputed.

## 3. The constitutional financial-services stack

The architecture separates concerns that are often collapsed in conventional financial applications.

| Layer | Role |
|---|---|
| Personhood and Passport | Establishes the continuing participant and the constitutional identity under which they act. |
| Sponsorship and Delegation | Grants bounded authority to an agent or service; defines limits, expiry, and revocation. |
| MoneyPenny | Provides the financial-services interaction and orchestration layer: understanding intent, preparing proposals, and coordinating permitted financial actions. |
| Policy and Risk Router | Classifies a proposed action by value, risk, price sensitivity, privacy, reversibility, jurisdiction, market impact, and uncertainty. |
| Vela Confidential Layer | Protects sensitive intent, balances, positions, strategies, counterparties, and computation; supports selective disclosure. |
| Trusted Execution Environment | Executes designated high-risk or confidential computation inside an attested protected environment. |
| Pulse | Reports verifiable operational and transaction state: what is proposed, authorised, pending, executed, settled, reconciled, or blocked. |
| P&L Proof | Produces permissioned evidence about financial performance and reporting without requiring unrestricted disclosure of the underlying books or strategy. |
| Receipts and Standing | Preserve the evidence chain and translate verified conduct into accountable institutional memory. |

This separation allows confidentiality and transparency to coexist. The system can prove that an authorised action followed policy, executed in an appropriate environment, and produced a reconciled result without exposing every private input.

## 4. Vela as the confidential layer

Vela is the intended confidential-execution layer within this architecture. Its role is broader than encrypting data at rest. It provides a protected boundary for financial information and computation that should not be visible to every application component, infrastructure operator, agent, or counterparty.

Potentially protected material includes:

- transaction intent before it is approved;
- account balances, positions, liabilities, and liquidity constraints;
- pricing thresholds, trading strategy, and execution preferences;
- counterparty and beneficial-owner information;
- risk models and policy evaluation inputs;
- confidential P&L components and management reporting;
- credentials and short-lived execution capabilities.

Vela supports the principle of **selective disclosure**: disclose the minimum evidence necessary for a legitimate purpose. One participant may need to know that sufficient funds exist, another that a policy check passed, and another that a reported return reconciles to an authorised transaction set. None necessarily needs the full underlying dataset.

In the current programme, Vela represents the secure phase of the financial-services architecture and the target seam for protected execution. Production claims should follow live integration, attestation, and end-to-end rehearsal; the architectural role described here is the intended design contract.

## 5. Pulse: transaction and operational transparency

Pulse provides a verifiable view of transaction state. It is not merely a user-interface status indicator and it does not infer completion from an agent's statement.

A transaction can move through explicit states such as:

- proposed;
- policy-checked;
- awaiting operator approval;
- delegated and authorised;
- routed for confidential execution;
- executed;
- settled;
- reconciled;
- blocked, expired, or revoked.

This produces operational transparency for the principal, an authorised reviewer, or an institutional control function. Importantly, Pulse can report state without exposing confidential inputs. A viewer may be able to verify that a transaction was executed within a stated limit and reconciled successfully while remaining unable to inspect the private strategy that generated it.

Support for Pulse is distinct from Pulse being enabled for a particular actor or transaction. The system should maintain explicit states for capability, activation, disclosure permission, and proof availability. This prevents a supported integration from being mistaken for an authorised or completed one.

## 6. P&L: reporting transparency without indiscriminate disclosure

P&L proof extends the same discipline to financial reporting. Traditional reporting often presents a choice between trusting a summary and granting broad access to the underlying books. Constitutional reporting aims for a third option: verifiable, permissioned claims linked to authoritative transaction evidence.

A P&L proof may establish, subject to its disclosure policy, that:

- a reported period includes the correct authorised transaction set;
- gains, losses, fees, and adjustments were calculated under a specified method;
- balances reconcile to settlement evidence;
- a performance claim satisfies an agreed threshold;
- excluded or confidential items were handled according to policy;
- the reporting actor possessed the necessary authority.

The proof is not the raw ledger and is not a substitute for legally required reporting. It is a controlled evidence object that can support audit, investor communication, treasury oversight, agent evaluation, and research while preserving confidentiality.

Pulse and P&L therefore provide two related forms of transparency:

- **Pulse answers:** What is happening, and what state is the action in?
- **P&L answers:** What financial outcome followed, and what evidence supports that account?

## 7. Risk-routed transactions

The advanced service does not send every transaction through the same approval or execution path. It evaluates the consequences of the proposed action and selects a route consistent with constitutional policy.

### Routing factors

A routing decision may consider:

- **Value:** absolute amount and amount relative to available capital, budget, or delegated limit.
- **Risk:** credit, liquidity, market, operational, model, counterparty, legal, and reputational exposure.
- **Price:** price tolerance, volatility, spread, slippage, market impact, valuation uncertainty, and deviation from an approved bound.
- **Privacy:** sensitivity of the transaction, strategy, counterparties, and supporting data.
- **Reversibility:** whether the action can be cancelled, recalled, disputed, or economically unwound.
- **Time:** urgency, market window, expiry, and the cost of delay.
- **Authority:** the scope and remaining validity of the delegation being used.
- **Evidence quality:** whether the required identity, policy, pricing, and settlement proofs are available.
- **System uncertainty:** confidence in the model, data, and route selection itself.

Price should not be treated as a single trigger. A small transaction in an illiquid market may create more market impact than a larger transaction in a deep market. Routing should evaluate both nominal value and consequence.

### Illustrative routing classes

| Route | Typical characteristics | Constitutional response |
|---|---|---|
| Bounded automatic | Low value, low risk, reversible, within an active delegation, reliable price and evidence | Execute through ordinary bounded automation; emit Pulse and settlement receipts. |
| Supervised | Moderate value or risk, material policy sensitivity, or reduced reversibility | Prepare the action and require an operator approval or additional policy check before execution. |
| Confidential / TEE | High value, sensitive strategy or data, material market impact, strong confidentiality requirement, or elevated model uncertainty | Route automatically to an attested TEE; apply stronger approval, proof, and reconciliation requirements. |
| Hold or deny | Prohibited purpose, missing authority, stale price, insufficient evidence, failed attestation, or unclassifiable risk | Do not execute; record the reason and required remediation. |

## 8. Trusted execution as a governed route

A TEE provides an isolated environment in which sensitive computation can be executed with hardware-backed attestation. In constitutional financial services, the TEE is not a blanket claim of safety. It is one execution route selected by policy.

For a TEE-routed transaction, the system should be able to evidence:

1. the transaction was classified under a defined policy;
2. the relevant delegation permitted the proposed action;
3. the approved code and policy ran in an attested environment;
4. confidential inputs were not released outside the authorised boundary;
5. the execution output corresponded to the approved intent;
6. settlement and reporting were reconciled;
7. failure of attestation or secure execution caused the action to fail closed.

The routing decision itself should be receipted. This makes it possible to examine not only whether the trade or payment executed, but why it was allowed to use that execution path.

## 9. An end-to-end transaction lifecycle

An illustrative transaction follows this sequence:

1. **Intent:** A person asks MoneyPenny, or a delegated agent, to prepare a payment, investment, treasury action, or trade.
2. **Presence:** The system resolves the constitutional participant and the active Passport.
3. **Authority:** It resolves the applicable delegation, scope, expiry, and limits.
4. **Proposal:** MoneyPenny constructs a proposal without treating the proposal as permission to execute.
5. **Classification:** The risk router evaluates value, risk, price, privacy, reversibility, and evidence.
6. **Route:** The transaction is assigned to bounded automation, supervision, confidential TEE execution, or hold/deny.
7. **Execution:** The selected environment performs only the authorised act.
8. **Settlement:** The external payment or market outcome is observed and reconciled. Q¢ may serve as a denomination and settlement primitive in its supported Base or Bitcoin forms; it is not an equity or governance token.
9. **Pulse:** Authorised viewers receive evidence of the transaction's state and route.
10. **P&L:** The financial result is incorporated into a permissioned proof or report.
11. **Receipt:** The authority, policy, route, outcome, and proof references are preserved.
12. **Standing:** Verified conduct updates the accountable history of the participants and services involved.

## 10. Applications

This architecture can support several classes of financial service:

- agent-assisted payments and procurement;
- treasury and liquidity management;
- confidential investment and trading workflows;
- permissioned investor and management reporting;
- verifiable P&L for agents, funds, ventures, and experiments;
- constitutionally bounded commerce between agents;
- controlled access to sensitive financial research and models;
- financial-services marketplaces in which capabilities can be discovered without granting execution authority prematurely.

## 11. Programme state and development path

The programme can be understood in three phases:

### Phase 1 — Cross

Establish constitutional admission: wallet control, Passport, sponsorship, delegation, evidence, and Standing. The central invariant is that external registration does not equal internal authorisation.

### Phase 2 — Secure

Introduce Vela, confidential computation, TEE execution, selective disclosure, and secure handoff. This phase must prove the real hosting, session, origin, attestation, and failure mechanics rather than infer them.

### Phase 3 — Operate

Run constitutional financial services across payments, commerce, transactions, reporting, and trading. Additional agents can enter the runtime only after completing the relevant constitutional journey and receiving bounded authority.

The present architecture has established many of the required constitutional and evidence primitives, along with a clear service and research direction. The production-grade Vela/TEE integration, calibrated risk-routing policies, complete transactional logic, and live end-to-end rehearsals remain part of the work ahead.

## 12. Research agenda

The most consequential open questions are interdisciplinary:

- How should value, volatility, liquidity, privacy, and reversibility combine into a routing policy?
- Which transaction classes require TEE execution, and which would gain little from it?
- How should an attested execution be linked to settlement evidence and P&L without leaking private inputs?
- What level of explanation is required when a transaction is held, denied, or escalated?
- How should model uncertainty affect authority and routing thresholds?
- Which Pulse and P&L claims are useful to operators, counterparties, auditors, regulators, and researchers?
- How should standing reflect correct restraint—the decision not to transact—as well as successful execution?
- How can the system remain provider-neutral while preserving a consistent constitutional boundary?

## Conclusion

Constitutional financial services replace the question “Can the agent execute this transaction?” with a more rigorous set of questions: “Who authorised it, under what conditions, through which protected route, with what evidence, and with what consequences?”

Vela provides the confidential layer. Pulse provides transaction and operational transparency. P&L proof provides reporting transparency. Risk routing connects the nature of the transaction to the safeguards required for its execution. Together, these elements point toward a financial system in which privacy does not require opacity, transparency does not require indiscriminate disclosure, and automation does not require the surrender of human and institutional authority.
