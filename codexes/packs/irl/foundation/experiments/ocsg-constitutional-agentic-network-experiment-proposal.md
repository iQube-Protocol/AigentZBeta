# OCSGA / Constitutional Agentic Network — Invariant & Experiment Proposal

**Status:** PROPOSED — pre-canon research package; nothing in this document is ratified merely by being recorded here.  
**Date:** 2026-08-20  
**Programme:** IRL × Constitutional Internet × OCSGA  
**Governance:** CFS-051 Experiment / Constitutional / Invariant Pipeline. Candidate invariants remain candidates until the existing canonization ceremony promotes them. Experimental claims remain proposed until evidence exists.  
**Companions:** IRL-001; IRL-002; IRL-010; IRL-010A; CFS-051; CFS-019.

## 1. Research question

Ian's two questions are treated as linked:

1. Do the Constitutional Internet (CI), IRL and OCSGA constitute complementary parts of a broader computational architecture, or merely adjacent concepts with shared language?
2. If personhood is the originating locus of human authority, how is authority represented, verified, delegated, revoked and evidenced in practice?

Working thesis: resolving question 2 operationally creates a falsifiable basis for question 1.

## 2. Stage-setting candidate invariant

### CAN-OPEN-001 — The Agentic Internet is not an intranet

Agentic systems may operate within closed organizational trust domains, but an Agentic Internet exists only when agents can discover, establish authority with, coordinate and transact across independently governed domains. Closed systems can optimize local trust and control; they cannot reproduce the reach, specialization, composability and network effects of an open network. As autonomous machine agency lowers the marginal cost of discovery, coordination and transaction, the potential performance advantage of open networks is hypothesized to increase.

**Status:** candidate; empirical component unvalidated.

This invariant is stage-setting. Personhood is not assumed as the premise; its necessity or sufficiency is tested downstream of the open-network requirement.

## 3. Candidate authority invariants

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

## 4. Candidate confidentiality and evidence invariants

### CAN-CONF-001 — Openness does not imply exposure
As agents operate across organizational boundaries, both personal and organizational identity and context become more sensitive. Open operation therefore requires selective proof rather than indiscriminate disclosure.

### CAN-CONF-002 — Constitutional confidentiality balances openness with accountability
Constitutional computing should reveal what must be proven, conceal what need not be known, and preserve sufficient evidence to establish what occurred.

Operational shorthand:

- Openness without exposure.
- Confidentiality without opacity.
- Accountability without surveillance.

### CAN-EVID-001 — Machine-pace agency requires machine-pace auditability, accountability and compliance
As consequential operations move from human pace to machine pace, retrospective human reconstruction alone becomes insufficient. Authority, constraints, revocation and evidence must become increasingly machine-verifiable and execution-native.

### CAN-ENT-001 — Constitutional computing has internal value independent of cross-domain operation
Bounded delegation, invariant governance and constitutional evidence can improve governance of agents inside a single organizational domain. Cross-domain operation adds further requirements for portable authority provenance and constitutional confidentiality.

Enterprise adoption sequence: **Constitutionalize internally → re-constitute for portable authority → network constitutionally.**

## 5. Authority decomposition

The proposed decomposition answering the practical authority question is:

> **Personhood establishes the originating subject.**  
> **Identity establishes contextual representation.**  
> **IAM establishes organizational authority.**  
> **Delegation establishes permitted agency.**  
> **Constitutional evidence establishes what occurred.**

Mapped to the operational lifecycle:

- **Represented:** identity.
- **Verified:** personhood proofs, organizational credentials and authority proofs appropriate to context.
- **Delegated:** bounded delegation.
- **Revoked:** at the relevant personal-delegation and/or organizational-IAM authority layer.
- **Evidenced:** execution-native constitutional evidence.

The originating subject, contextual identity, organizational authority and acting agent are deliberately not collapsed into one principal.

## 6. Proposed authority loop

Linear authority chain:

`Personhood → Identity → IAM / Organizational Authority → Bounded Delegation → Agent Action → Constitutional Evidence`

Cybernetic authority loop:

`Personhood → Identity → IAM / Authority → Bounded Delegation → Action → Constitutional Evidence → Standing → Authority → further Delegation`

The loop proposes that evidence of consequence may affect Standing and therefore future earned/operational authority, while personhood remains the continuity root for human-originated authority.

This proposal must be reconciled with existing Law XIII and standing/authority doctrine before any canonization; it does not silently supersede them.

## 7. Proposed open-network opportunity relation

### CAN-EQ-001 — Combinatorial opportunity relation

Working relation:

`Agent Capability × Network Reach × Service Diversity → Combinatorial Opportunity`

Interpretation: as agents lower search, coordination and transaction costs, increases in reachable counterparties and heterogeneous services may interact multiplicatively rather than merely additively with agent capability.

**Status:** heuristic research relation, not yet a formal equation or empirical law. The experiment programme must determine measurable variables, functional form and disconfirmation conditions before promotion.

## 8. Experiment A — Internal constitutionalization

### Hypothesis
An IAM-governed enterprise agent workflow can gain measurable governance properties from bounded delegation, invariant governance and constitutional evidence without any cross-organizational activity.

### Arms
A. Existing IAM-governed agent workflow baseline.  
B. Same workflow with bounded delegation.  
C. B + invariant governance.  
D. C + constitutional evidence / execution-native audit trail.

### Measures
- task success and latency;
- unauthorized/out-of-scope actions;
- constraint violations;
- revocation effectiveness and propagation time;
- evidence completeness;
- audit reconstruction time/cost;
- compliance-evidence completeness;
- human approval/intervention burden;
- compute/token overhead;
- risk-of-repair.

### Falsification
If constitutional arms add material execution overhead without measurable improvement in boundedness, evidence quality, audit cost, compliance performance or risk-of-repair, the internal enterprise-value claim is weakened or rejected for the tested workflow.

## 9. Experiment B — Closed vs open vs constitutionally open network

### Hypothesis
Open agentic networks expose authority-portability, confidentiality and accountability requirements that shared-domain IAM alone does not solve; a constitutionally open architecture can address those requirements with acceptable performance overhead.

### Arms
A. **Closed:** both agents/services operate within one organizational IAM/trust domain.  
B. **Naively open:** equivalent task crosses an independently governed organizational boundary using conventional identity/credential mechanisms.  
C. **Constitutionally open:** same cross-boundary task adds personhood-originated authority provenance where human authority must travel, bounded delegation, invariant governance, constitutional confidentiality and constitutional evidence.

### Measures
- successful task completion;
- discovery/coordination/transaction latency;
- authority-verification latency and failure rate;
- amount/sensitivity of personal information disclosed;
- amount/sensitivity of organizational information disclosed;
- scope violations and unauthorized actions;
- revocation effectiveness;
- evidence completeness and audit reconstruction cost;
- compliance-evidence completeness;
- compute/cryptographic overhead;
- risk-of-repair;
- reachable counterparties/service diversity and realized opportunity.

### Perturbations
- revoke personal delegation mid-flow;
- revoke organizational permission mid-flow;
- attempt scope escalation;
- attempt prohibited re-delegation;
- introduce conflicting organizational and constitutional constraints;
- remove/alter a governing invariant;
- request unnecessary identity disclosure;
- withhold required authority proof;
- create evidence-chain discontinuity.

### Falsification
The experiment must allow the closed or naively open architecture to win. Evidence against the constitutional-open hypothesis includes: no material cross-domain deficit for conventional IAM/federation; no confidentiality improvement; no audit/compliance improvement; unreliable revocation; constitutional controls failing to prevent perturbations; or overhead exceeding measured network/governance benefit.

## 10. Experiment C — CI × IRL × OCSGA compositional ablation

### Question
Are CI, IRL and OCSGA indispensable/complementary architectural functions or adjacent concepts with shared language?

### Method
Run the constitutionally open workflow with the full composition, then ablate each contribution independently while holding the task constant.

Candidate functional decomposition to test rather than assume:

- **CI:** constitutional basis/provenance of authority and constitutional confidentiality.
- **IRL:** discovery, compression and application of governing invariants.
- **OCSGA:** operational/governance topology through which authority and constraints propagate across organizational/agent relationships.

### Criterion
If removal of a component produces no distinct measurable loss, the claim that the three are architecturally compositional is weakened. If each ablation breaks a distinct property while the full composition restores it, that is evidence for complementary architecture.

## 11. Experiment D — Open-network performance / combinatorial opportunity

### Hypothesis
As agent capability increases and marginal coordination cost falls, access to a larger and more diverse open service/counterparty network produces increasing performance/economic opportunity relative to a constrained closed network.

### Design direction
Hold task family and agent capability constant while varying network reach and service diversity; then repeat across increasing agent capability/automation levels. Measure opportunity discovery, successful service composition, task quality, time-to-value, transaction cost and risk-of-repair.

### Falsification
If expanded reach/diversity produces no systematic benefit, or coordination/governance costs dominate gains as capability rises, CAN-OPEN-001's performance component and CAN-EQ-001 must be revised or rejected.

## 12. Enterprise translation hypothesis

Candidate commercial proposition, not a scientific finding:

> **Keep your IAM. Constitutionalize it.**

Existing enterprise stack:

`IAM + Policies + Agents + APIs`

Constitutional extension:

`+ bounded delegation + invariant governance + constitutional evidence`

Open-network extension where required:

`+ personhood-rooted authority provenance + constitutional confidentiality + cross-domain authority verification`

Resulting hypothesis: an enterprise can receive standalone internal governance ROI before any Constitutional Internet network effect, then extend the same constitutional architecture outward for customers, suppliers, partners, marketplaces and external agents.

## 13. Canon / evidence discipline

1. Every CAN-* item in this document is **candidate/proposed**, not canonical.
2. Existing ratified laws, including Law XIII, are not modified by this document.
3. Formal experiments must be promoted through the existing `EXPERIMENT_REGISTRY`; this file does not create a parallel registry.
4. Results must enter the canonical experiment record and be reflected in IRL-010A using the existing I/D/P/F evidentiary classes.
5. Unsupported claims are flagged, not defended.
6. Revisions supersede; they do not silently rewrite.
7. Experimental instruments must faithfully report outcomes even when they contradict the programme's thesis (IRL Principle 004).

## 14. Proposed research progression

`CFS-051 candidate capture → protocol scoping → formal EXP registration → execution → canonical evidence → IRL-010A reconciliation → invariant validation/canonization where warranted → IRL-001/002/010 revision by supersession`

This package records the discovery seam. It does not pre-judge its result.
