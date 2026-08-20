# The Crucible — Robotics & Embodied Systems Dossier

**Status:** OPEN / PRE-CANON  
**Opened:** 2026-08-20  
**Programme:** IRL × Constitutional Computing × Constitutional Cybernetics × OCSGA × Embodied Intelligence  
**Governance:** CFS-052 The Crucible; CFS-051 experiment/invariant pipeline.  
**Purpose:** Dedicated Crucible dossier for embodied/robotic research questions, candidate invariants, experiments, perturbations, prototypes, funding opportunities and code roadmaps. Nothing in this dossier is ratified merely by capture.

## 1. Why this dossier exists

Robotics makes consequential agency physically concrete. Information and inference are already consequential, but embodied systems can translate inference directly into external state change through actuators. Where actions are irreversible, safety-critical, legally consequential or costly to repair, retrospective analysis is insufficient as the primary authorization mechanism.

The dossier therefore investigates the proposition that constitutional computing must operate both:

1. **ex ante**, resolving whether consequential action is permitted before execution; and
2. **ex post**, generating evidence, evaluating observed consequence and adapting future governance.

This is a natural proving domain for bounded delegation, invariant governance, consequence compression, risk-of-repair, constitutional confidentiality, authority provenance, OCSGA multi-authority composition and machine-pace auditability/accountability/compliance.

## 2. Initial candidate invariants

Cross-reference the OCSGA dossier for full formulations:

- **CAN-EMB-001:** Irreversible consequential action requires ex-ante constitutional authorization.
- **CAN-EMB-002:** Effective embodied capability is the constitutionally authorized subset of realizable capability.
- **CAN-EMB-003:** Constitutional authorization must precede consequential execution above the applicable consequence/risk threshold.
- **CAN-EMB-004:** The constitutional decision precedes the actuator.
- **CAN-EMB-005:** Consequence compression is an action-time requirement.

Related candidates:

- CAN-CAP-002 — Capability is consequential.
- CAN-CAP-003 — Consequence closes the capability loop.
- CAN-CAP-004 — Effective capability is a property of the cybernetic system, not solely the model.
- CAN-AGENCY-001 — Agency translates inference into consequential state change.
- CAN-EVID-001 — Machine-pace agency requires machine-pace auditability, accountability and compliance.

## 3. Initial runtime hypothesis

Ex-ante authorization path:

`Intent / Inference → Proposed Action → Authority Resolution → Relevant Invariant Field → Consequence / Risk-of-Repair Analysis → Constitutional Compression → AUTHORIZE / REFUSE / ESCALATE → Actuator`

Ex-post cybernetic path:

`Execution → Observed Consequence → Evidence → Validation → Standing / Trust / Invariant Learning / Governance Adaptation → Future Authorization`

The authorization path must resolve before execution for actions above the governed threshold. "Conclusive" means sufficient to issue the bounded authorization disposition, not certainty about all future consequences.

## 4. Initial candidate experiment programme

### ROB-EXP-CAND-001 — Embodied ex-ante constitutional authorization
Compare retrospective governance, static pre-action rules, dynamic constitutional ex-ante resolution, and ex-ante resolution plus ex-post cybernetic feedback. Use simulation, digital twins or controlled low-risk hardware. Measure false authorization/refusal, impermissible action prevention, legitimate action throughput, latency, revocation, escalation, evidence completeness and risk-of-repair.

### ROB-EXP-CAND-002 — Constitutional compression latency
Vary invariant-field size, consequence complexity and action-time budget. Test whether relevant constitutional fields can be compressed sufficiently for reliable machine-pace authorization without dropping materially governing constraints.

### ROB-EXP-CAND-003 — Authority revocation at the actuator boundary
Issue a valid task and delegation, then revoke or alter authority at controlled points before execution. Measure whether revocation propagates before actuator commitment and characterize race conditions, stale authorization and safe refusal/escalation behaviour.

### ROB-EXP-CAND-004 — OCSGA multi-authority embodied composition
Model a task involving a human-originating principal, operating organization, asset owner, site/environment authority and governing invariants. Test whether the system resolves their combined authority/constraint topology into a determinate permitted-action state. Ablate OCSGA, CI provenance, IRL invariant governance and constitutional evidence independently.

### ROB-EXP-CAND-005 — Raw versus effective embodied capability
Hold robot/model technical capability constant while varying authority, legitimacy/acceptance, accountability evidence, risk envelope and governing invariants. Test whether effective/permitted capability changes while raw physical/inferential capability remains fixed.

### ROB-EXP-CAND-006 — Consequence and risk-of-repair perturbation
Hold nominal task intent constant while varying simulated consequence severity, reversibility and repair cost. Test whether the authorization state changes appropriately and whether risk-of-repair predicts required escalation/refusal better than raw task performance alone.

## 5. Candidate solution / architecture seams

Research and development may explore, without presuming the final architecture:

- a constitutional action gate immediately upstream of actuator execution;
- compressed invariant/consequence envelopes suitable for real-time decision paths;
- bounded authorization receipts with expiry and revocation semantics;
- DCIR event/evidence emission around proposed, authorized, refused, escalated and executed actions;
- OCSGA composition of multiple principals, organizations, asset owners and policy domains;
- simulation/digital-twin harnesses for safe perturbation and falsification;
- Proof-of-Risk / risk-of-repair integration at authorization time;
- constitutional evidence receipts connecting authorization state to observed physical consequence;
- fail-safe handling of missing, stale, ambiguous or contradictory authority/invariant state.

All implementation proposals remain subject to existing DevOn/DCIR/Crystal role boundaries and human/constitutional gates.

## 6. Safety and experimental discipline

Initial research should prefer simulation, digital twins and low-energy controlled environments. Experiments should not create real hazardous conditions merely to demonstrate refusal. Hazard-zone, force, collision, proximity and similar perturbations can be simulated or represented by safe proxies.

The objective is not to maximize robotic autonomy. It is to measure whether consequential capability can be made appropriately governable before execution while preserving useful performance.

## 7. Funding / consortium opportunity note

**DOE SBIR robotics / robotics research opportunity — DETAILS PENDING FROM OPERATOR.**

The operator noted on 2026-08-20 that there is a U.S. Department of Energy SBIR opportunity concerning robotics / robotics research and that MetaProof may be joining a consortium to apply in this space. Details have not yet been supplied and must not be inferred or fabricated.

When supplied, capture:

- solicitation / topic number and official title;
- sponsoring DOE office/program;
- deadline and phase;
- consortium participants and proposed role;
- technical scope and eligibility constraints;
- fit to Crucible candidate invariants/experiments;
- proposed work packages and evidence deliverables;
- code/prototype roadmap;
- IP, data, safety and commercialization considerations.

## 8. Dossier backlog

- Formalize action consequentiality/risk thresholds for ex-ante gating.
- Define authorization freshness, expiry and revocation race semantics.
- Identify suitable safe robotic/digital-twin testbed.
- Map OCSGA authority topology into embodied action authorization.
- Reconcile with existing Polity for Robots and Agents work before asserting novelty.
- Map relevant existing Crystal invariants and negative invariants into robotics domains.
- Define machine-pace latency budgets and failure-safe behaviour.
- Convert candidate experiments into formal `EXPERIMENT_REGISTRY` entries only when protocols are sufficiently specified.
- Incorporate DOE SBIR details when supplied.

## 9. Crucible disposition

This dossier is intentionally open. Candidate propositions may be revised, split, falsified, implemented or promoted through the applicable ceremony. Negative results remain valuable evidence.

**The constitutional decision precedes the actuator** is a candidate research maxim in this dossier, not yet a ratified invariant.
