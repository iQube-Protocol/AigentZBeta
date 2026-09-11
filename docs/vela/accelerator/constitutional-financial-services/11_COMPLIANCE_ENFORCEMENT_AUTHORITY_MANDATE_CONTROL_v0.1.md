# Compliance enforcement through authority, mandate and control

Version: 0.2
Date: 9 September 2026
Status: proposed application of the existing operating model; implementation requirements, not a legal opinion or certification of compliance.
Scope: MoneyPenny / Factor / Aegis / Vela Use Case Zero, including MetaProof and every participating principal, provider and agent.

## 1. Proposition

Compliance enforcement is an application of the existing authority, mandate and control framework throughout the consequential chain. It does not require a second constitutional system. External legal permissions and firm policies become evidenced constraints within the same framework that already governs delegated action.

Authority establishes the legitimate basis and scope for an activity. Mandate specifies the particular assignment and its limits. Control applies authority and mandate to the live execution perimeter: whether the proposed action may proceed under the conditions that actually hold now. Operational ownership and supervision identify who maintains those controls; they are not the definition of control. These are working mappings to existing constructs, not replacement canonical definitions.

A pilot can demonstrate enforcement of specified, evidenced requirements. Passing that demonstration does not prove that every applicable legal obligation has been identified or satisfied. Policy correctness, evidence completeness and the actual operating arrangement require separate review.

## 2. Apply the framework to everyone

| Actor | Authority and mandate | Operational responsibility and execution control |
|---|---|---|
| MetaProof | Contracted technology scope and permissions appropriate to its actual activities | Control its software, service conduct, data access and compensation; do not assume a software label excludes advisory or intermediary obligations. |
| Client principal | Authority over its own assets/interests and lawful delegation | Set objectives, scope, liquidity/risk limits and revocation rights. |
| Regulated firm | Evidenced permission for the particular activity, jurisdiction, client and asset | Own the professional policies, supervise its delegate and retain applicable responsibilities. |
| Firm's agent | Explicit grant from a verified controlling firm | Operate only within scope, limits, approved configuration and escalation conditions. |
| Factor | Delegated resource discovery and workflow assembly | Match eligible capital, information, services and risk capacity; do not infer permission to solicit or advise from permission to search. |
| Aegis | Independent assessment remit | Verify evidence and report admissibility findings; do not grant licenses, admit candidates or authorize execution. |
| MoneyPenny | Coordination and invocation authority | Route each activity through the appropriate grants and existing admission/authorization gates. |
| Vela | Approved confidential computation request | Execute bounded deterministic logic; attestation does not confer professional authority or establish legal correctness. |

Use “agent of a regulated firm.” Registry registration, identity, Standing and a professional license are distinct facts. A license does not automatically permit every product, jurisdiction or activity, and does not automatically extend to every delegate.

## 3. The threshold is activity-specific

Apply checks before the activity requiring authority, not only before funds move. Distinguish information retrieval, personalized recommendation, solicitation, negotiation, insurance placement, execution, custody, reporting and remuneration. Determine classification from actual conduct and reviewed policy; do not let an agent self-label an activity to bypass controls.

A compensated personalized securities recommendation may itself be advisory activity, including when supplied to another agent. The SEC describes compensated advice and securities reports/analyses as within the investment-adviser definition. A downstream execution partner does not automatically remove the upstream provider's obligations. [SEC investment-adviser guidance](https://www.sec.gov/resources-small-businesses/capital-raising-building-blocks/investment-advisers).

FINRA states that securities-law and supervisory obligations continue to apply when member firms use AI agents. A delegated agent must operate within a substantive supervisory arrangement; a signature or nominal partner relationship is insufficient. [FINRA observations on AI agents](https://www.finra.org/media-center/blog/observations-on-ai-agents).

The applicable US perimeter must be reviewed for the exact activities, assets, states, clients, fund structure, control rights and fee arrangements. This note does not conclude that MetaProof is exempt from registration.

## Execution-perimeter control — operator clarification

Authority: on what legitimate basis may this actor act? Mandate: which assignment and limits govern it? Control: may this exact act proceed now, given current conditions at the execution perimeter?

A robot authorized and mandated to move a box from A to B must inhibit or safely stop movement when a human enters the protected zone. Authority and mandate can remain valid while control denies execution. Clearance requires fresh evaluation; it does not automatically justify blind resumption.

In the financial pilot, a changed balance, consumed reservation, expired quote, adverse price movement beyond the mandate, lost provider readiness or changed shared exposure can block an otherwise authorized act. These are execution conditions, not merely questions of organizational supervision.

Vela evaluates a frozen snapshot with no live network lookup. The execution adapter must obtain relevant fresh facts outside Vela and compare state/version, validity bounds and control predicates immediately before commitment. Material changes to confidential operands require a new frozen envelope and confidential projection. Never relabel the old signed result as covering new facts.

Record the control observation time, evidence freshness, predicates evaluated, action/input/state binding, decision and reason reference. Unknown or stale essential state prevents execution. Use atomic reservations or conditional execution where supported to close the check-to-act race; where unavailable, explicitly bound and evaluate the remaining risk. Do not claim a software check makes external settlement atomic.

For long-running or staged actions, control applies at subsequent consequential boundaries and during execution where the actuator supports monitoring and safe interruption. Halt must respect the physical or financial action's reversibility. Separate authority revoked, mandate exceeded, control inhibited, and evidence unresolved in the causal record, while mapping to existing canonical statuses.

Add pilot tests where authority and mandate remain valid but context changes between projection and invocation; assert no execution, preserved reason/evidence, and fresh evaluation before any retry. This is an application of the existing model, not a replacement authorization engine.

## 4. Evidence mapped into existing authority records

For each relevant activity retain references to:

- Legal entity and controlling principal identity; agent identity and verifiable firm-to-agent binding.
- Official permission/registration source, identifier, checked scope, restrictions, verification time and expiry/refresh policy. Registration is not regulator endorsement.
- Client authority and contract; firm delegation; permitted subdelegation; exact activity, asset, jurisdiction and client class.
- Mandate limits, required approvals, supervisory owner, approved agent/tool configuration and policy version.
- Revocation state, evidence validity interval, review decisions and uncertainty.
- Exact proposed action, participant schedule, financial snapshot and permitted output recipients.

Use authoritative records and appropriate firm attestations together. A public registry entry alone usually cannot establish the firm's agent-control arrangement or transaction mandate. Conflicts, missing evidence or unavailable sources remain explicit. Freshness checks must have bounded validity periods; do not claim continuous real-time registry verification where no such interface exists.

Keep semantic extensions inside existing authority/evidence seams after reconciliation. No new standalone licensing registry or second authorization engine is specified.

## 5. Enforcement sequence

1. Classify the proposed activity using reviewed, versioned requirements.
2. Factor identifies candidates whose evidenced capabilities and permissions fit it.
3. Aegis assesses source evidence, identity linkage, scope and uncertainty; existing MoneyPenny admission authority decides admission.
4. Bind client authority, firm authority, agent delegation and actual control to the exact activity. An admitted provider still needs action-specific authorization.
5. Evaluate affected participant mandates and shared dependencies. Selective participation requires genuine economic separation.
6. Freeze the action, allocation schedule, evidence versions, private operands and disclosure policy into the existing consequence request.
7. Obtain public/confidential projections and derive action authorization through existing gates. Aegis approval, insurance or a Vela signature cannot substitute for authorization.
8. Revalidate expiry, revocation, scope, state and required approvals immediately before the relevant consequential step. Changed terms require new evaluation.
9. Execute only through the authorized provider surface; reconcile outcomes and issue bounded causal receipts.
10. Stop new activity on revocation. For an in-flight act, reconcile its authoritative status and perform only permitted cancellation/remediation. Revocation cannot be represented as reversal of an already irreversible act.

A known prohibition refuses the activity. Missing necessary evidence prevents authorization and remains unresolved. Preserve existing precedence and the distinction between an unacceptable projection, an unresolved projection and a refused authorization.

## 6. Confidentiality and attribution

QubeTalk and iQubes govern collaborative and private contribution. Vela receives only the minimum private state necessary for the agreed calculation. Strongly pseudonymous transaction handles retain governed re-binding outside the guest.

Do not leak private mandates, identities or rejection reasons through public events. Provide participants, supervisors and auditors only the fields their authority permits. Receipts must bind the activity, principal/firm/agent, delegation, policy/evidence versions, input commitment, verdict, authorization and execution outcome without indiscriminate disclosure.

Evidence retention and authorized reporting require an explicit policy. Confidentiality does not remove a firm's recordkeeping or reporting obligations. Disclosure itself is a consequential act governed by purpose, recipient, scope and authority.

## 7. MetaProof's own perimeter and incentives

MetaProof is subject to the same authority/mandate/control analysis. Assess who actually designs recommendations, controls agents, approaches investors, negotiates, moves value and receives fees. Regulated activity cannot be reassigned merely through product wording or a final human approval.

For the software-provider launch hypothesis, the partner owns and controls its regulated functions while MetaProof supplies contracted infrastructure. Confirm this division against actual code, contracts, UI and operations. Partner permission is not a transferable umbrella.

Compensation is another governed step: tie payer, fee basis, accepted terms and allocation to the authorized service. Base service compensation may survive a correct refusal where contracted. Performance or transaction-linked remuneration requires its own perimeter review. Aegis findings must remain independent of Factor's economic incentive. Coverage does not create authority and does not erase residual risk or repair obligations.

## 8. Repository reconciliation

Inspected baseline: `52c49bd7e` on origin/dev, 9 September 2026. These observations establish reusable seams; they do not constitute an end-to-end regulatory-control audit.

| Existing code | Observed behavior | Application requirement |
|---|---|---|
| `services/factor/authorityChain.ts` — validateChainForAction | Checks principal binding when supplied, active status, expiry, permitted subdelegation and allowed action. | Require expected principal binding at relevant call sites; extend with evidenced professional scope and control through existing records. |
| `services/constitutionalCommerce/actionAuthorisation.ts` — deriveActionAuthorisation | Requires active authority, complete acceptable projection and allowing gate; rejects shadow authorization and leaves pending approval unresolved. | Feed activity-specific requirements into the existing gate; do not treat this function alone as verifying all credential or identity bindings. |
| `services/delegation/delegationAuthorityGate.ts` | Checks grants for the bound agent; some unbound and read-only/non-vocabulary paths return allowed without a delegated grant. | Audit financial recommendation/solicitation call paths; read-only is not a sufficient regulatory classification. Reuse/extend vocabulary and routing rather than blanket-gating unrelated reads. |
| `services/aegis/aegisAssessmentService.ts` | Evidence-bound assessment with independent assessor and immutable final records; assessment does not perform admission. | Reuse findings for professional-permission evidence; do not claim official license verification is already implemented. |
| `services/vela/velaProjectionProvider.ts` and `services/vela/wasm/projector/app/app.go` | Existing coarse confidential projection boundary, not a custody engine or legal-permission service. | Preserve the minimal result channel and enforce external authority outside confidential computation. |

The exact regulatory-source adapters, activity taxonomy, scope matching, supervisory evidence and lifecycle integration remain proposed extensions. This document adds no runtime enforcement code.

## 9. Bounded pilot demonstration

Use clearly synthetic firm credentials and delegations; never present them as verified real registrations. One financial workflow is sufficient.

| Scenario | Expected evidence |
|---|---|
| Matching firm permission, agent grant and client mandate | Authorized path through existing gates with linked receipt. |
| Firm valid, activity outside permission | Refusal before that activity, even if an execution partner exists. |
| Agent registered in iQube Registry, no verified firm delegation | No promotion to professionally authorized status. |
| Expired, revoked or unknown evidence | Refused or unresolved as appropriate; no optimistic continuation. |
| Advice/recommendation exposed via nominally read-only connector | Correct activity gate applies before output delivery. |
| Partner approved but Aegis evidence incomplete | Admission/authorization do not silently convert uncertainty to permission. |
| A-only action affects B through shared collateral | B's mandate remains applicable and can block the action. |
| Different agent/principal reuses a valid grant or changed schedule | Binding mismatch prevents authorization. |
| Revocation after projection but before invocation | Revalidation blocks execution; in-flight outcomes are reconciled. |
| Simulated credentials or coverage reach live path | Live authorization fails closed. |

Before implementation completion, encode meaningful regression tests at actual invocation and receipt boundaries. No tests were added or run for these proposed behaviors in this documentation increment.

## 10. What the demonstration establishes

It demonstrates that the existing authority, mandate and control model can express and enforce selected compliance conditions across principals, firms, agents and MetaProof. It does not ratify new invariants, certify legal compliance, verify a simulated license or alter frozen P1–P4 protocols.

Candidate architectural refinement: activity-specific regulatory delegation, implemented through existing gates. Candidate invariant: no delegated activity may exceed the verified intersection of the firm's permission, client mandate, agent grant and applicable control conditions. These remain proposals captured here, not CFS-051 registrations or new canonical identifiers.

Next implementation step: reconcile the activity vocabulary and professional-evidence mapping with the live repository, then implement one simulated end-to-end enforcement scenario with the responsible partner's reviewed requirements.
