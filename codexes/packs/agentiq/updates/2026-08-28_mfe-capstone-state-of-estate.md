# MFE Capstone — State of the Estate

**Artifact:** MFE-CAPSTONE-ESTATE-2026-08-28  
**Audience:** Lehigh Master of Financial Engineering capstone students — Risk Management, Pricing and Value  
**Status:** STUDENT BRIEFING / EVIDENCE-BACKED  
**As-of:** 28 August 2026  
**Comparison window:** 31 May–28 August 2026

## The short version

When the cohort left at the end of May, the revised iQube Registry and contract work had just been completed. The estate was still principally a sovereign experience platform: metaMe Runtime and Studio, aigentMe, Experience Composing/Vibing, the early Q¢ economic substrate and a body of research around sovereignty.

You return to an operational **Constitutional Computing** platform with a dedicated Financial Services Runtime. The decisive change is not simply that more financial features were added. The platform now distinguishes capability from authority, proposal from execution, confidential information from verifiable disclosure, execution from settlement, and settlement from financial reporting.

The repository comparison used for the companion CS report records **4,183 commits** between the 31 May baseline and the 25 August comparison head. GitHub returned only its first 300 changed files; those files alone contain **15,284 additions and 1,892 deletions**—a **17,176-line lower bound**, not a complete lines-of-code total. The final three days add further work, so those figures remain a conservative shared baseline rather than an inflated claim.

## What changed

| Period | Major development | Why it matters to you |
|---|---|---|
| End of May | Revised iQube Registry and contract stack; metaMe Runtime; Experience Vibing; early Q¢ rails | This is the technical and financial baseline you last saw. |
| June | Development Composing, the Intent-to-Registry Gap, Reuse → Extend → Create, DevOn and Consequence Engineering | Financial-system development became a search for the smallest unresolved and consequential gap, not a licence to rebuild the stack. |
| Early July | Invariant Intelligence emerged | Risk rules, authority boundaries and reporting claims could be expressed as falsifiable conditions rather than prose-only policy. |
| July | Constitutional Computing, personhood, Polity Passport, bounded delegation, IDE 2.0/DCIR/Crystal and the Invariant Research Lab | A financial agent could be separated from the person or institution authorising it, while remaining attributable and governed. |
| August | MoneyPenny Financial Services Runtime, Horizen pilot, Vela confidential consequence work, Pulse/P&L proof paths, four bridges and Crystal vP2 | The architecture moved into financial-services proving grounds involving privacy, execution, reporting, risk and value. |

## The constitutional financial-services transition

At the end of May, the central proposition was that useful financial agency would require privacy, trust and accountability in addition to technical capability. The current architecture makes that proposition operational through five linked controls:

1. **Personhood and presence** establish the continuing participant.
2. **Sponsorship and bounded delegation** determine what an agent is allowed to do, for whom, on which surfaces, for how long and within which limits.
3. **MoneyPenny** interprets financial intent, prepares proposals and orchestrates permitted financial services without treating conversation as execution authority.
4. **Vela and trusted execution** protect sensitive data and computation where confidentiality or consequence requires a stronger execution boundary.
5. **Pulse, P&L proofs, receipts and Standing** make transaction state and financial outcomes verifiable without indiscriminately exposing private books, positions or strategy.

The governing rule is simple:

> Registered externally does not mean authorised internally.

An agent may possess an Agent Card, wallet or external payment capability and still lack constitutional authority to transact. Authority is activated only by the relevant Passport, sponsorship, delegation, policy and Standing gates.

## Where the financial estate is now

### MoneyPenny and the Financial Services Runtime

MoneyPenny has evolved from a financial-services concept into the interaction and orchestration layer of a wider runtime. The estate now includes agent admission, AigentQube records, governed service invocation, consequence projection, chain and wallet operations, partner-specific pilot paths, and a clearer separation between the catalogue where a service is discovered and the native surface where it is operated.

The boundary matters: MoneyPenny may prepare and explain a transaction, but a persuasive response is not proof that the action was authorised, executed, settled or reconciled.

### Horizen proof path

The Horizen work provides a concrete external proving path:

`test agent → Agent Card → verifiable P&L proof → retrieval and validation → metaMe constitutional evidence → DVN receipt → operator/delegation attribution → workspace`

The first implementation uses REST polling where appropriate. Event indexing can follow once the authoritative state and evidence chain are stable.

### Vela confidential consequence layer

Vela is the intended confidential layer for financial intent, balances, positions, counterparties, pricing thresholds, strategy, risk inputs and private reporting components. August work established confidential consequence projection and composed public/confidential decisions through the governed invocation path.

This is not yet a blanket production claim. The remaining work must prove the actual hosting, session, attestation, origin, disclosure and failure mechanics of protected execution.

### Pulse and P&L

Pulse and P&L now have distinct roles:

- **Pulse** reports verifiable operational and transaction state: proposed, authorised, routed, pending, executed, settled, reconciled or blocked.
- **P&L proof** reports a permissioned financial outcome linked to an authorised transaction set and reconciliation method.

Support, activation, disclosure permission and proof availability are separate states. A supported Pulse or P&L integration must not be represented as active or verified until the relevant operator act and proof exist.

### Risk-routed execution

The advanced runtime does not send every transaction through one path. A policy router can classify a proposed action using:

- absolute and portfolio-relative value;
- market, liquidity, credit, counterparty, operational, legal and model risk;
- price tolerance, volatility, spread, slippage, valuation uncertainty and market impact;
- confidentiality and data sensitivity;
- reversibility and settlement finality;
- delegation limits and evidence quality.

The resulting route may be:

| Route | Constitutional response |
|---|---|
| Bounded automatic | Execute a low-value, low-risk, reversible action within an active delegation and emit evidence. |
| Supervised | Prepare the action but require operator approval or an additional policy check. |
| Confidential / TEE | Route a high-value, privacy-sensitive or high-consequence action to an attested trusted execution environment with stronger approval and reconciliation. |
| Hold or deny | Do not execute when authority, price, evidence, policy or attestation is missing or invalid. |

Price is not a single trigger. A small order in an illiquid market may create more consequence than a larger order in a deep market. The research challenge is to model consequence, not merely nominal transaction size.

### Q¢ settlement boundary

Q¢ is constrained to denomination and settlement in its supported Base and Bitcoin forms. It is not an equity or governance token. This keeps settlement utility separate from ownership and constitutional authority.

### Crystal vP2 and the research corpus

Crystal vP2 is focused on financial-risk and value systems. It provides a governed research corpus in which candidate invariants can be discovered, tested, reviewed and frozen without allowing a prior Crystal generation to satisfy the evidence requirements of its successor.

## What is established, in pilot and still open

| Area | Current position |
|---|---|
| Personhood and bounded delegation | Established architecture with working system primitives and live journey surfaces. |
| MoneyPenny role | Established proposal and orchestration boundary; full transaction coverage is still developing. |
| Financial Services Runtime | Operational architecture with agent admission, service orchestration and partner pilot paths. |
| Pulse state model | Explicitly modelled; additional live integrations and reconciliation rehearsals remain. |
| P&L proof path | Pilot-ready architecture; proof definitions, data lineage and reporting policy require further validation. |
| Vela confidential layer | Confidential consequence path demonstrated; production hosting and attestation mechanics remain to be proven. |
| Risk/price/value router | Advanced target architecture requiring quantitative calibration and simulation. |
| TEE execution | Governed end-state route; live execution, attestation and fail-closed tests remain open work. |
| Crystal vP2 | Active financial-risk/value research programme. |
| Multi-agent runtime | Programme objective: additional agents enter only through constitutional admission and bounded authority. |

## Your MFE capstone now

The repository already registers the **MFE Capstone — Master of Financial Engineering** cohort and three student-project workspaces:

1. **Risk Management** — risk research and risk-management artefacts.
2. **Pricing** — pricing research and pricing artefacts.
3. **Value** — value definition, measurement, realisation and evidence artefacts.

All three begin at the shared **Brief** stage and use the common capstone lifecycle:

`Brief → Research Plan → Source/Data Review → Build or Analysis → Review → Revision → Submission → Demonstration → Archive/Commons`

### Risk Management project

Develop an interpretable transaction-routing model covering value, tail risk, liquidity, counterparty exposure, operational failure, model uncertainty, reversibility and delegated limits. Test normal, stressed and prohibited cases. The objective is not a universal risk score; it is a defensible policy for deciding what may automate, what must be supervised, what belongs in a TEE, and what must stop.

### Pricing project

Develop price-quality and execution tests covering quote staleness, spreads, volatility, liquidity, slippage, valuation uncertainty and market impact. Connect price confidence to route selection and operator escalation. Demonstrate why nominal value alone is insufficient.

### Value project

Define and test how the system recognises, measures and preserves value. Connect intended value to realised outcome, risk-adjusted return, time-to-value, cost, repair risk, Pulse, P&L and evidence. Distinguish nominal transaction value from consequential benefit, and specify how a verified value claim enters the constitutional record.

## Suggested shared deliverables

Each team should produce testable artefacts rather than only a narrative report:

1. a precise problem, actor and threat model;
2. a declared dataset or synthetic scenario set;
3. an IRG analysis and reuse / extend / create decision;
4. a model, control or policy specification;
5. measurable acceptance and failure criteria;
6. simulations or executable tests;
7. an operator explanation and remediation design;
8. an evidence, Pulse and reporting schema;
9. findings, limitations and recommendations;
10. a demonstration covering at least one ordinary case, one stressed edge case and one fail-closed case.

## Submit through the IRL OS Workspace

Enter the **IRL OS Workspace** and select **MFE Capstone** in the left navigation. The cohort and its Risk Management, Pricing and Value projects are already registered there.

- [IRL OS Workspace](https://dev-beta.aigentz.me/triad/embed/codex/irl-os-cartridge?tab=irl-os-workspace)
- [Workspace Overview](https://dev-beta.aigentz.me/triad/embed/codex/irl-os-cartridge?tab=irl-os-workspace-overview)
- [Pipeline](https://dev-beta.aigentz.me/triad/embed/codex/irl-os-cartridge?tab=irl-os-workspace-pipeline)
- [Working Materials](https://dev-beta.aigentz.me/triad/embed/codex/irl-os-cartridge?tab=irl-os-workspace-materials)
- [QubeTalk](https://dev-beta.aigentz.me/triad/embed/codex/irl-os-cartridge?tab=irl-os-workspace-qubetalk)
- [Activity and receipts](https://dev-beta.aigentz.me/triad/embed/codex/irl-os-cartridge?tab=irl-os-workspace-evidence)
- [Participation and Standing](https://dev-beta.aigentz.me/triad/embed/codex/irl-os-cartridge?tab=irl-os-participation-standing)

Working Materials are mutable and are never the constitutional record. Reviewed, frozen or authoritative artefacts enter the appropriate record or Commons path; nothing becomes public or canonical merely because it was uploaded.

## Constitutional credit

University grading and constitutional contribution remain separate.

- Faculty may grade the capstone; faculty cannot directly grant Standing.
- Submission volume, commit count, hours and pages do not earn Standing.
- A verified, evidenced contribution can pass the shared Standing admission gate.
- Attribution uses a public persona commitment rather than exposing the raw persona identifier.
- The contribution can persist beyond the course and workspace as part of the platform's lineage.

One implementation boundary remains open: admitted research-contribution signals do **not yet automatically accrue into Standing lanes**. Until that wiring is completed, IRL receipts and admission decisions preserve attribution and eligibility but must not be represented as an already-issued Standing score.

## Questions to keep asking

- Is the agent capable, and is it authorised?
- What is the financial consequence if the model is wrong?
- Does the route reflect liquidity and market impact as well as nominal value?
- What information must remain confidential, and what minimum proof may be disclosed?
- Does the system distinguish execution, settlement, reconciliation and reporting?
- Can the transaction fail safely when authority, price, proof or attestation is missing?
- Does the evaluation reward prudent restraint as well as profitable execution?

## Repository evidence

- [MFE cohort and project workspaces](https://github.com/iQube-Protocol/AigentZBeta/blob/dev/services/research/researchWorkspace.ts)
- [Capstone lifecycle](https://github.com/iQube-Protocol/AigentZBeta/blob/dev/services/experiments/workspaceLifecycle.ts)
- [Workspace surfaces and role visibility](https://github.com/iQube-Protocol/AigentZBeta/blob/dev/services/research/researchWorkspaceViews.ts)
- [Student role authority](https://github.com/iQube-Protocol/AigentZBeta/blob/dev/services/research/researchWorkspaceRoles.ts)
- [Financial Services catalogue and operating destination](./2026-08-24_financial-services-catalogue-operate-destination.md)
- [MoneyPenny Financial Services Runtime](./2026-08-22_phase3-moneypenny-financial-services-runtime.md)
- [Vela unified consequence projection](./2026-08-22_vela-001-slice-2e-unified-consequence-projection.md)
- [Horizen pilot closure](./2026-08-24_horizen-fs-pilot-closure-001.md)
- [June–August Venture Lab internal report](./2026-08-26_venture-lab-internal-report-june-august.md)

## Closing perspective

The programme has moved from a financial-agency proposition to a testable constitutional-financial-services architecture. Your task is not to rebuild the platform. It is to make one consequential part of its financial logic more rigorous, measurable and safe: risk management, pricing or value.

The objective is financial service that can operate at machine speed without abandoning human authority, confidentiality, verifiability, value or consequence.
