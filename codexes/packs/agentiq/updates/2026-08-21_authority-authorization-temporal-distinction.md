# Authority–Authorization Temporal Distinction

**Status: CANONICAL DOCTRINE, ratified 2026-08-21 by operator.**  
**Amends / composes with:** `2026-07-30_control-authority-mandate-constitutional-security-model.md`  
**Scope:** Constitutional Computing; Authority–Control–Mandate; Trusted Automation; machine-pace consequential systems.  
**Supersession rule:** This doctrine does not replace the Control–Authority–Mandate trinity. It clarifies the temporal and state relationship between durable constitutional Authority and runtime Authorization.

---

## 0. Canonical distinction

> **Authority is a primitive of governance. Authorization is a primitive of state.**

Authority and Authorization are related but categorically distinct.

- **Authority** establishes the legitimate basis and bounds under which an actor may act. It is rooted in governance: personhood or another lawful principal, delegation, jurisdiction, role, standing where applicable, and revocation/expiry conditions.
- **Authorization** resolves whether a specific proposed action may execute **now**, under the current relevant state, given the applicable Authority, Control conditions and Mandate.

Compressed form:

> **Authority answers: may this actor act?**  
> **Authorization answers: may this action execute now?**

---

## I. Temporal distinction

Authority is ordinarily **durable relative to Authorization**. It may persist across many actions and state changes, subject to its own expiry, revocation, delegation and jurisdictional conditions.

Authorization is ordinarily **ephemeral and state-dependent**. It may be recomputed at machine pace for each consequential action or action boundary.

Therefore:

> **Authority may persist across state changes. Authorization may change because state changes.**

Example:

```text
Authority: robot is validly delegated to operate equipment.
Mandate: move material A to location B.
Control rule: do not move while a human occupies the exclusion zone.

t0: zone clear        → AUTHORIZED
t1: human enters      → REFUSED
t2: human exits       → AUTHORIZED
```

The Authority, Mandate and governing Control rule may remain unchanged across t0–t2. What changes is the relevant state, and therefore the Authorization outcome.

---

## II. Governance and state

Canonical correlation:

> **Governance governs possibility; state governs actuality.**

Governance establishes the constitutional field within which agency may occur. In the Authority–Control–Mandate model, governance establishes or recognizes:

- the legitimate Authority of the actor;
- the bounded Mandate for the action or purpose;
- the Control conditions that constrain exercise.

State supplies the presently true conditions against which those governing terms are resolved.

Accordingly:

```text
GOVERNANCE
→ Authority + Mandate + Control conditions

STATE RESOLUTION
Proposed Action + Authority + Mandate + Control × Current State
→ Authorization

AUTHORIZATION
→ AUTHORIZE / REFUSE / ESCALATE

then
→ Execution
→ Consequence
→ Evidence / Feedback
```

Authorization is therefore not itself a fourth governance leg. It is the runtime state decision produced by resolving the governed terms against current state for a proposed action.

---

## III. Machine-pace Authorization Principle

**Canonical principle:**

> **Durable Authority shall be capable of supporting state-dependent Authorization at the pace required by the consequential system, including machine pace where the action domain requires it.**

This is a central requirement of Trusted Automation.

A constitutional system need not rewrite governance at machine speed merely because operational state changes at machine speed. Instead:

1. governance establishes durable Authority, Mandate and Control conditions;
2. current state is observed or received;
3. Authorization resolves the proposed action against those conditions;
4. only an authorized action may cross the governed execution boundary;
5. execution and consequence generate evidence capable of updating subsequent state, Trust and governance where appropriate.

This permits a system to preserve human-originating constitutional Authority while allowing synthetic systems to resolve permitted action at operational speed.

Compressed line:

> **Human authority can remain durable while machine Authorization remains dynamic.**

---

## IV. Trusted Automation temporal rule

Trusted Automation requires more than valid Authority.

Canonical runtime relation:

```text
Durable Authority
+ valid Mandate
+ governing Control conditions
+ Current State
+ Proposed Action
= Authorization State
```

where the Authorization State is one of the bounded dispositions required by the applicable runtime, including at minimum:

```text
AUTHORIZE
REFUSE
ESCALATE
```

Only an action with an applicable affirmative Authorization may proceed to governed execution.

A prior Authorization must not be treated as indefinitely valid where materially relevant state may have changed. Authorization freshness must be proportionate to the pace, risk, reversibility and consequence of the action domain.

---

## V. Canonical temporal invariants

### Invariant A — Authority–Authorization Separation
Authority and Authorization shall not be conflated. Authority is a governance primitive; Authorization is a state primitive.

### Invariant B — State-Dependent Authorization
Authorization may change when relevant state changes even when Authority, Mandate and governing Control conditions remain unchanged.

### Invariant C — Temporal Asymmetry
Authority is ordinarily durable relative to Authorization; Authorization is ordinarily ephemeral relative to Authority.

### Invariant D — Machine-Pace Authorization
Where consequential action occurs at machine pace, Authorization must be resolvable at a pace sufficient to govern execution without requiring governance itself to be rewritten at the same frequency.

### Invariant E — Authorization Freshness
The freshness of Authorization must scale with the rate at which materially relevant state can change and with the risk, value, irreversibility and consequence of the proposed action.

### Invariant F — Execution Boundary
For consequential actions, Authorization must be resolved before the governed execution boundary. Post-action evidence may update future Trust and governance but cannot retroactively authorize an action that lacked required Authorization at execution time.

---

## VI. Relationship to the existing Control–Authority–Mandate canon

The 2026-07-30 doctrine remains canonical and unchanged in its root claim that only the intersection of Control, Authority and Mandate may produce consequential action.

This amendment clarifies the runtime semantics of that intersection:

- **Authority** is not re-created for every action; its continuing validity is checked.
- **Mandate** remains contextual, risk-proportionate and action-bound.
- **Control** provides the governing conditions and execution capability constraints.
- **State** determines whether those conditions are presently satisfied.
- **Authorization** is the action-time result of that resolution.

Thus the earlier phrase **"Mandate says this, now, under these conditions"** remains valid as a description of the contextual proof/intent carried by the Mandate, while this amendment makes explicit that actual present permission to execute is the **Authorization state** produced by resolving the full governed field against current state.

---

## VII. Consequence and cybernetic feedback

Authorization is prospective; consequence is empirical.

```text
Authority / Mandate / Control
→ State Resolution
→ Authorization
→ Execution
→ Consequence
→ Evidence
→ Updated State / Trust / Standing / Governance where applicable
→ Future Authorization
```

Consequential evidence may change future Trust, Standing, Control conditions, Mandates or Authority. It does not alter the historical fact of whether a prior action was authorized at its execution boundary.

---

## VIII. Provenance

This temporal distinction emerged from the OCSGA × Constitutional Internet × IRL Crucible discussion concerning robotics, embodied systems, open agentic networks and Trusted Automation, and from the operator's explicit distinction on 2026-08-21:

> **Authority is durable, longer term. Authorization can happen at machine speed.**

The operator explicitly directed that this distinction be made canonical.
