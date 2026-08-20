# OCSGA / Constitutional Agentic Network — Invariant & Experiment Proposal

**Status:** PROPOSED — Crucible research package; nothing in this document is ratified merely by being recorded here.  
**Date:** 2026-08-20  
**Programme:** IRL × Constitutional Internet × OCSGA  
**Governance:** CFS-051 and CFS-052 The Crucible. Candidate invariants remain candidates until the existing canonization ceremony promotes them. Experimental claims remain proposed until evidence exists.  
**Companions:** IRL-001; IRL-002; IRL-010; IRL-010A; CFS-051; CFS-052; CFS-019.

## 1. Research question

Ian's two questions are treated as linked:

1. Do the Constitutional Internet (CI), IRL and OCSGA constitute complementary parts of a broader computational architecture, or merely adjacent concepts with shared language?
2. If personhood is the originating locus of human authority, how is authority represented, verified, delegated, revoked and evidenced in practice?

Working thesis: resolving question 2 operationally creates a falsifiable basis for question 1.

## 2. Stage-setting candidate invariant

### CAN-OPEN-001 — The Agentic Internet is not an intranet
Agentic systems may operate within closed organizational trust domains, but an Agentic Internet exists only when agents can discover, establish authority with, coordinate and transact across independently governed domains. Closed systems can optimize local trust and control; they cannot reproduce the reach, specialization, composability and network effects of an open network. As autonomous machine agency lowers the marginal cost of discovery, coordination and transaction, the potential performance advantage of open networks is hypothesized to increase.

## 3. Candidate authority and capability invariants

### CAN-AUTH-001 — Personhood establishes the originating subject
For human-originated authority, personhood identifies the continuous constitutional subject from whom authority may originate without requiring persistent identity exposure.

### CAN-AUTH-002 — Identity establishes contextual representation
Identity is a contextual representation of a subject within a social, institutional, commercial or technical domain; it is not identical to the underlying personhood primitive.

### CAN-AUTH-003 — IAM establishes organizational authority
Identity and Access Management establishes roles, permissions and authority within an organizational trust domain. Constitutional computing composes with IAM rather than presuming its replacement.

### CAN-AUTH-004 — Delegation establishes permitted agency
Delegation determines the bounded scope within which an agent may exercise authority. Delegation may be implemented inside conventional IAM systems as well as constitutional systems.

### CAN-AUTH-005 — Constitutional evidence establishes what occurred
Consequential machine action should generate sufficient evidence to establish what occurred, under what authority and constraints, and with what relevant consequence.

### CAN-AUTH-006 — IAM can delegate; personhood enables provenance across trust domains
IAM can establish and delegate authority within an organizational trust domain. Personhood supplies an organization-independent continuity root through which human-originated delegated authority can retain provenance across independently governed trust domains.

### CAN-AUTH-007 — Open agentic networks require interoperable authority without requiring interoperable identity
Cross-domain participants should be able to verify sufficient authority for an action without requiring universal identity federation or unnecessary disclosure of personal or organizational identity.

### CAN-AUTH-008 — Personhood constitutionalizes rather than replaces IAM
Personhood does not displace enterprise identity, roles, IAM, policies or agents. It can provide a portable constitutional root that enables existing organizational authority systems to participate in open agentic networks.

### CAN-CAP-001 — Capability is amplified by authority, legitimacy and accountability
Raw capability describes what an agent can do. Authority determines what it is permitted to do. Legitimacy affects whether counterparties and institutions recognize and accept that authority. Accountability makes consequential exercise of capability sufficiently governable for others to entrust it with greater scope. Effective agentic capability may therefore be amplified when raw capability is combined with verifiable authority, legitimacy and accountability.

### CAN-CAP-002 — Capability is consequential
In a cybernetic intelligence system, capability cannot be fully characterized by inference or output performance alone. Information and inference are themselves consequential. When inference is translated into agentic action, consequentiality becomes more directly materialized as external state change. Effective capability must therefore account for consequences produced, not merely outputs generated.

### CAN-CAP-003 — Consequence closes the capability loop
Consequences of inference and action generate evidence that can inform governance of subsequent exercise of capability: `capability → inference/action → consequence → evidence → governance → future permitted/effective capability`.

### CAN-CAP-004 — Effective capability is a property of the cybernetic system, not solely the model
Raw inferential capability may be a property of a model under specified conditions. Effective capability in a consequential environment is hypothesized to be a property of the larger cybernetic system in which intelligence is embedded, including authority, legitimacy, accountability, trust/acceptance, constraints, evidence, consequences and feedback.

### CAN-AGENCY-001 — Agency translates inference into consequential state change
Reasoning and inference are already consequential; agency adds the capacity for inference to be translated directly into action that changes external state, thereby concretizing and potentially amplifying consequence.

### CAN-SOCIAL-001 — Social integration of capability depends on more than performance
The degree to which an intelligence system can be integrated into consequential social, organizational and economic activity is hypothesized to depend not only on raw performance but also on authority, legitimacy, accountability, evidence and resulting trust/acceptance.

## 4. Convergent observation — Authority, Control and Mandate

Ian's independent observation that **authority provenance is not the same thing as current permission** is recorded as convergent support for the existing **Authority–Control–Mandate trinity**, not as a new constitutional primitive.

Working mapping for experimental purposes:

- **Authority** — establishes the legitimate provenance under which an actor may act: originating subject, contextual identity, organizational authority/IAM, delegation and supporting authority evidence.
- **Control** — determines whether valid authority may be exercised under the present constitutional and operational state: governing invariants, policy, revocation state, environment, consequence analysis, risk-of-repair, safety and other current constraints.
- **Mandate** — establishes the bounded objective, task or action the actor is charged or entitled to undertake.

The three jointly determine permitted agency. A valid Authority and valid Mandate may coexist with a Control state of REFUSE or ESCALATE. Conversely, permissive Control does not manufacture missing Authority or Mandate.

Ian's related distinctions are therefore treated as candidate observable consequences of the trinity rather than separate doctrine:

- Capability does not confer Authority.
- Authority does not override Control.
- Authority without Mandate does not establish an action to execute.
- Authority + Mandate remain subject to Control at execution time.
- Permission does not guarantee execution; execution is a subsequent event that requires its own evidence.

Candidate operational model:

`Raw Capability → Authority × Control × Mandate → Permitted Agency → Execution → Consequence → Evidence / Feedback`

This model is heuristic. The trinity need not be strictly sequential; the experiment should test their independent and joint effects on the executable action state.

## 5. Candidate embodied-action invariants

### CAN-EMB-001 — Irreversible consequential action requires ex-ante constitutional authorization
Where an agent can materially alter external state and the proposed action is irreversible, safety-critical, legally consequential, or exceeds an accepted risk-of-repair threshold, the applicable authority, invariant and consequence conditions must be resolved to a sufficient authorization decision before execution. Post-action evidence and feedback cannot substitute for ex-ante authorization in such cases.

### CAN-EMB-002 — Effective embodied capability is the constitutionally authorized subset of realizable capability
An embodied system's technical or physical capability does not itself establish permission to exercise that capability. At a given constitutional state, effective embodied capability is hypothesized to be the subset of physically realizable actions that are contextually permissible and constitutionally authorized.

Candidate nesting: `Raw Capability Space ⊃ Physically Feasible Actions ⊃ Contextually Permissible Actions ⊃ Constitutionally Authorized Actions`.

### CAN-EMB-003 — Constitutional authorization must precede consequential execution
For actions above the applicable consequence/risk threshold, the runtime ordering must be `constitutional resolution → AUTHORIZE / REFUSE / ESCALATE → execution`, not `execution → constitutional assessment → remediation`. Ex-post analysis remains essential for evidence, accountability, learning and future governance, but is not a substitute for the prior permission decision.

### CAN-EMB-004 — The constitutional decision precedes the actuator
For embodied systems, the final execution boundary must consume a resolved authorization state before an actuator performs the governed action. The authorization decision may be distributed across components, but no above-threshold physical act should rely solely on retrospective constitutional analysis.

### CAN-EMB-005 — Consequence compression is an action-time requirement
Embodied systems operating at machine pace cannot perform unbounded analysis before every action. Relevant authority, invariants, constraints and consequence/risk information must therefore be compressed into a sufficiently small and resolvable action-time field while preserving the conditions material to authorization.

**Authorization conclusiveness:** "conclusive" means sufficient for the authorization decision, not epistemic certainty. The runtime must resolve to a bounded disposition such as **AUTHORIZE, REFUSE, or ESCALATE / REQUIRE HUMAN AUTHORITY** when the governed threshold applies.

## 6. Candidate confidentiality and evidence invariants

### CAN-CONF-001 — Openness does not imply exposure
Open operation requires selective proof rather than indiscriminate disclosure of sensitive personal or organizational identity/context.

### CAN-CONF-002 — Constitutional confidentiality balances openness with accountability
Constitutional computing should reveal what must be proven, conceal what need not be known, and preserve sufficient evidence to establish what occurred. **Openness without exposure. Confidentiality without opacity. Accountability without surveillance.**

### CAN-EVID-001 — Machine-pace agency requires machine-pace auditability, accountability and compliance
Authority, constraints, revocation and evidence must become increasingly machine-verifiable and execution-native as consequential operations move to machine pace.

### CAN-ENT-001 — Constitutional computing has internal value independent of cross-domain operation
Bounded delegation, invariant governance and constitutional evidence can improve governance inside a single organizational domain. Cross-domain operation adds portable authority provenance and constitutional confidentiality.

## 7. Authority decomposition

> **Personhood establishes the originating subject.**  
> **Identity establishes contextual representation.**  
> **IAM establishes organizational authority.**  
> **Delegation establishes bounded agency.**  
> **Authority–Control–Mandate resolves permitted agency.**  
> **Constitutional evidence establishes what occurred.**

## 8. Consequential capability and embodied authorization model

Conventional: `Input → Inference → Output → Performance score`

Informational consequence: `Information → Inference → Informational Consequence`

Agentic seam: `Inference → Authority → Action → External State Change → Materialized Consequence`

Embodied ex-ante loop: `Intent / Inference → Proposed Action → Authority–Control–Mandate Resolution → Relevant Invariant Field → Consequence / Risk-of-Repair Analysis → Constitutional Compression → AUTHORIZE / REFUSE / ESCALATE → Physical Action`

Ex-post learning loop: `Execution → Observed Consequence → Evidence → Validation → Standing / Invariant Learning / Governance Adaptation → Future Authorization`

The ex-post loop must not be used to justify an above-threshold action that lacked the required ex-ante authorization.

## 9. Proposed research relations

`Agent Capability × Network Reach × Service Diversity → Combinatorial Opportunity`

`Effective Agency ∝ Capability × Authority × Legitimacy × Accountability`

`Raw Capability → Consequential Agency → Outcomes + Risk-of-Repair → Effective Capability`

All are heuristic and subject to experimental revision or rejection.

## 10. Existing experiment programme

### Experiment A — Internal constitutionalization
IAM baseline versus bounded delegation, invariant governance and constitutional evidence.

### Experiment B — Closed vs open vs constitutionally open network
One-domain IAM versus conventional cross-domain versus constitutionally open cross-domain operation.

### Experiment C — CI × IRL × OCSGA compositional ablation
Ablate CI, IRL and OCSGA contributions independently while holding workflow constant.

### Experiment D — Open-network performance / combinatorial opportunity
Vary network reach, service diversity and agent capability.

### Experiment E — Capability amplification by authority, legitimacy and accountability
Hold raw capability constant and vary authority, legitimacy and accountability independently and jointly.

### Experiment F — Raw vs effective consequential capability
Progressively expose fixed underlying intelligence to inference, consequential inference, agency, authorized agency, accountable agency and socially integrated agency.

### Experiment G — Embodied ex-ante constitutional authorization
Compare retrospective governance, static rules, dynamic constitutional ex-ante resolution and ex-ante resolution plus cybernetic feedback.

### Experiment H — OCSGA embodied multi-authority composition
Test multi-source authority/constraint composition in simulated or low-risk embodied systems.

## 11. Experiment I — Authority–Control–Mandate independent perturbation

### Research question
Does the existing Authority–Control–Mandate trinity provide a useful and separable architectural boundary for determining permitted agency and execution?

### Design
Hold two elements constant while perturbing the third, then test selected interaction conditions.

1. **Control perturbation:** preserve valid Authority and Mandate; alter current operational/constitutional conditions so Control moves between AUTHORIZE, REFUSE and ESCALATE.
2. **Mandate perturbation:** preserve Authority and permissive Control; change or remove the bounded task mandate and test whether execution remains appropriately constrained.
3. **Authority perturbation:** preserve requested Mandate and otherwise permissive Control; revoke, expire, corrupt or remove authority provenance and test refusal/escalation.
4. **Execution perturbation:** preserve valid Authority, Control and Mandate but prevent/interrupt execution; verify that permission evidence is not falsely treated as execution evidence.
5. **Outcome perturbation:** preserve the prior authorization state while varying observed consequence; test whether outcome evidence updates future governance without retroactively changing the historical authorization decision.

### Evidence objects to distinguish
- capability evidence;
- authority/provenance evidence;
- Control/permission decision evidence;
- Mandate/scope evidence;
- execution evidence;
- outcome/consequence evidence.

### Measures
Decision correctness, false authorization/refusal, revocation response, scope adherence, evidence separation, audit reconstruction, confidentiality/disclosure, authorization latency, risk-of-repair and future governance updates.

### Falsification
The architectural-boundary hypothesis is weakened if Authority, Control and Mandate cannot be independently perturbed in a meaningful way, if the distinctions add no explanatory or operational value over a simpler authorization model, or if the evidence objects cannot be usefully separated in execution and audit.

## 12. Enterprise and robotics translation hypotheses

Enterprise: **Keep your IAM. Constitutionalize it.**

Robotics/embodiment: constitutional computing should govern not merely whether an embodied system was compliant after acting, but whether consequential agency was permitted to execute in the first place.

Candidate maxim for testing, not ratified invariant: **For embodied intelligence, governance after action is audit; governance before action is authority.**

## 13. Canon / evidence discipline

All CAN-* items remain candidate/proposed. Ian's observation is recorded as convergent support for the existing Authority–Control–Mandate trinity, not as a new canonical invariant. Formal experiments must be promoted through the existing `EXPERIMENT_REGISTRY`; this dossier creates no parallel registry. Results must enter canonical experiment records and IRL-010A reconciliation. Unsupported claims are flagged, contradictory evidence retained, and experimental instruments must report outcomes even when they contradict the thesis.

## 14. Proposed research progression

`Crucible candidate capture → protocol scoping → formal EXP registration → execution → canonical evidence → IRL-010A reconciliation → invariant validation/canonization where warranted → Crystal / Canon / Code`
