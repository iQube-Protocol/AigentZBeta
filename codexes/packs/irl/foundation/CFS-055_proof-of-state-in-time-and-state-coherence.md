# CFS-055 — Proof of State in Time & Constitutional State Coherence

**Chrysalis Foundation Specification · v1.0 · Status: OPERATOR-RATIFIED · 2026-08-10**  
**Governs:** Constitutional Computing state observation, resolution and representation across metaMe, AgentiQ, IRL OS, Guided Journeys, Companion/Observer surfaces, A2UI/AR rendering, receipts and DVN-backed evidence.  
**Discovered through:** Horizen Constitutional Admission Pilot — repeated divergence between journey-stage state, detail panels, evidence drawers, historical ratchets and DVN receipt finality exposed that several surfaces were independently interpreting the same constitutional facts.  
**Composes:** CFS-017 (A2UI coherence seam) · CFS-019 (Constitutional Cybernetics) · CFS-020 (DCIR) · CFS-021 (Representation Invariants) · CFS-053 (Constitutional Binding) · `inv.engineering.030` (separate architecture from rendering) · `inv.engineering.036` (one authoritative location per concern) · `inv.engineering.040` (every state transition of record emits a receipt) · `inv.interaction.112–118` (continuous constitutional state loop) · `inv.reasoning.142/147` (representation as interface, not ontology).

---

## §1 The constitutional problem

A constitutional system cannot be coherent if multiple surfaces independently decide what is true.

The Horizen pilot exposed the failure mode directly: a journey node could be emerald while its detail panel remained grey; a Passport state could be complete while its Evidence drawer reported no receipts; a constitutional agreement could be ratified while adjacent P&L enrichments visually appeared to contradict that ratification; an invalid historical Standing state could be resurrected by a monotonic ratchet even after governed correction; and DVN finality could be mistaken for the truth-state of the underlying fact.

These were not primarily rendering bugs. They were failures to preserve **one constitutional state projection per predicate**.

Constitutional Computing therefore distinguishes four roles:

> **Observer Spine observes.**  
> **POSIT Spine resolves.**  
> **AR Engine represents.**  
> **DVN receipts prove.**

No one role may silently substitute for another.

---

## §2 Proof of State in Time (POSIT)

**Proof of State in Time (POSIT)** is the canonical constitutional read model for a predicate concerning a subject.

A POSIT state answers not merely *what happened?* but:

> **What is constitutionally true now, why is it true, when did it become true, what evidence supports it, has any earlier assertion been superseded, and how final is that evidence?**

A canonical POSIT projection SHOULD expose, at minimum:

```text
subject
predicate
value / state

status:
  unresolved | established | superseded | refused

effectiveAt
observedAt

authority:
  evidence | settled-fact | external-authority | derived

provenance[]
evidenceRefs[]
receiptRefs[]

finality:
  local
  dvn
  btc

supersession / correction metadata
```

The exact transport schema may evolve; these semantics may not.

### §2.1 State is not chronology

A journey expresses a **normative transformation path** through state space. Its nodes render **current constitutional state**.

Accordingly, a subject may legitimately hold a later state even when an earlier journey action has not occurred in the current session, provided that later state was independently and legitimately established at another time.

Time remains essential, but as a property of state — `effectiveAt`, provenance, validity and supersession — not as an instruction to pretend the UI is a transaction log.

### §2.2 State may be corrected and re-established

Constitutional state is not universally monotonic.

Some states are durable; others are revocable, expiring, supersedable or correctable. A governed correction may invalidate an earlier assertion without deleting history. Later valid evidence may establish the same predicate again at a new effective time.

The valid pattern is:

```text
established → governed correction/supersession → unresolved → new valid evidence → established again
```

A correction tombstone or invalidation watermark therefore suppresses stale prior assertions without creating a permanent prohibition against legitimate future re-establishment.

---

## §3 The Observer Spine — observation without interpretation drift

The **Observer Spine** gathers evidence and externally authoritative observations.

It may observe, among other things:

- canonical database state;
- receipts and settled facts;
- Passport and delegation state;
- Agent Cards and AigentQubes;
- partner systems such as Horizen;
- DVN attestation/finality state;
- correction and supersession records.

The Observer Spine does **not** own presentation and does not create a second durable constitutional truth merely because a component performs a live read.

Multiple observations may corroborate or conflict. Their reconciliation belongs to POSIT.

---

## §4 The POSIT Spine — one predicate, one canonical projection

For each constitutional predicate in a given context, the POSIT Spine resolves one canonical current-state projection.

Examples include:

```text
passportIssued
agentDelegated
aigentMeActivated
constitutionalAgreementAuthorized
pulseAuthorized
pnlDisclosureAuthorized
pnlServiceRegistered
pnlEvidenceVerified
factoryIngested
standingEstablished
```

Adjacent predicates must never be collapsed merely because they are operationally related.

For example:

```text
P&L disclosure authorized ≠ P&L service registered ≠ P&L evidence verified
```

Likewise:

```text
AigentQube present ≠ Factory ingested ≠ Standing accrued
```

A renderer may group these facts visually; it may never infer one from another unless that implication is itself constitutionally defined.

---

## §5 The AR / Rendering Engine — representation without re-observation

The **AR Engine** (adaptive rendering / A2UI representation layer) renders canonical POSIT state into the experience appropriate to context: journey picker, cards, companion narration, evidence drawers, emerald/slate/amber posture, consequence forks and other affordances.

It MUST NOT maintain a second persistent truth model.

After an operator action, a component may request a state refresh. It must then render the canonical projection rather than independently deciding whether the constitutional predicate is complete.

Thus all representations of one predicate must remain coherent:

```text
stepper node
stage detail
sub-state rows
evidence drawer
DVN badge
companion narration
```

Different views may reveal different detail. They may not assert contradictory state.

---

## §6 Receipts and DVN — evidence and finality, not competing truth

A receipt is evidence that an action or state transition occurred. DVN finality strengthens the evidentiary status of that receipt.

Neither replaces the POSIT state itself.

The system therefore distinguishes:

```text
underlying constitutional state
supporting evidence state
DVN finality
BTC finality
```

Example:

```text
Factory Ingested = ESTABLISHED
Evidence          = capability_registered
DVN               = PENDING
BTC               = PENDING
```

The experience may render:

> **Ingest ✓ · DVN Pending**

When the same receipt reaches DVN finality:

> **Ingest ✓ · Proven**

The underlying constitutional fact does not become false while the DVN is accumulating attestations.

Likewise, a DVN-minted historical receipt that has been constitutionally superseded remains valid historical evidence of what was once asserted or performed, but it cannot re-establish current state by finality alone.

---

## §7 Evidence drawers are projections, not searches for a second truth

Where a canonical state was established from evidence, its Evidence surface should hydrate and display the canonical evidence references that established or support that state.

A stage MUST NOT be able to say:

```text
COMPLETE from evidence X
```

while its primary Evidence surface independently searches another scope and concludes:

```text
No evidence recorded
```

Historical or supplementary evidence may be displayed separately, but the primary chain of evidence follows the canonical POSIT projection.

---

## §8 The State-Coherence Invariant

The system-wide coherence rule is:

> **For each constitutional predicate, there is one canonical current-state projection. Every observer, journey node, detail card, evidence surface, badge and narration may represent that state differently, but none may independently re-derive a conflicting truth.**

This is a Constitutional Computing invariant, not a Horizen-specific UI rule.

A constitutional experience is coherent only when:

1. the Observer Spine is observing the relevant evidence;
2. POSIT resolves that evidence to one current state with provenance and effective time;
3. correction/supersession semantics are preserved;
4. the AR Engine renders only that canonical state;
5. DVN/BTC finality is represented as an evidentiary dimension rather than confused with the underlying predicate.

---

## §9 Reference example — Ratify

A coherent Ratify state tree may legitimately be:

```text
Constitutional Agreement       ESTABLISHED · Ratified · DVN Minted
Pulse Authorization            ESTABLISHED
P&L Disclosure                 ESTABLISHED
P&L Service                    UNRESOLVED · onboarding required
P&L Evidence                   UNRESOLVED · pending
```

There is no contradiction: these are distinct predicates.

The AR Engine should therefore render the primary constitutional act as definitively complete while showing the transparency enrichments as independent subordinate facts.

---

## §10 Reference example — admission and Standing

A canonical causal path for a newly admitted agent may be:

```text
Operate established
  ↓
Factory Ingested established
  evidence: capability_registered
  ↓
Standing eligibility established
  ↓
Initial Standing accrued
  evidence: standing_accrued
```

But the picker is still a state surface, not a chronological wizard. A legitimately historical Factory state may be shown as established before a current-session Claim action, while Standing remains unresolved if its independent predicate is not validly established.

The state vector is the truth; the journey geometry is the normative transformation map.

---

## §11 Canonical invariant bundle

The following invariants are operator-ratified with CFS-055 and should be mirrored into `appendix-a_canonical-invariants.md` and `canonical-invariants.seed.json` in the next canon synchronization pass. IDs 252–259 are reserved by this specification; do not renumber.

252. *(interaction · law)* **Observation–Resolution Separation** — the Observer Spine observes evidence and external authority; it never becomes a competing constitutional truth model. Reconciliation of observations into current state belongs to the POSIT Spine.

253. *(constitutional · definition)* **Proof of State in Time (POSIT)** — a constitutional state is represented as its current value together with effective time, provenance, authority, validity/supersession and evidentiary finality; chronology alone is never the constitutional source of truth.

254. *(representation · law)* **Representation Follows State** — the AR Engine renders canonical POSIT state and may never independently re-derive a conflicting constitutional state; contextual rendering may vary, constitutional truth may not.

255. *(engineering · law)* **One Predicate, One Projection** — for each constitutional predicate within a context there shall be one authoritative current-state projection; parallel durable interpretations of the same predicate are a defect.

256. *(constitutional · principle)* **Journey-as-State-Vector** — journey order defines the normative transformation path, while journey nodes report current constitutional state; time, provenance, correction and finality are dimensions of state rather than proof that a session traversed every preceding node.

257. *(epistemology · principle)* **Evidence Does Not Collapse Predicates** — related receipts or observations may corroborate multiple facts but may not collapse distinct predicates; disclosure, registration, verification, ingestion and standing remain separately provable states unless a constitutional law explicitly binds them.

258. *(engineering · principle)* **Receipts Prove; State Resolves** — receipts and DVN attestations evidence and finalize transitions, but do not constitute a second state engine; evidence surfaces shall derive from the canonical evidence references supporting the resolved state.

259. *(cybernetics · law)* **Correction Preserves History Without Preserving Error** — governed correction supersedes the current consequence of invalid evidence without deleting its history; stale state may not resurrect through prior-resolution, while later valid evidence may establish a new state at a later effective time.

---

## §12 Implementation consequence

The Horizen pilot is the first reference implementation, not the boundary of the doctrine.

The immediate implementation pattern is:

```text
Observer Spine
    ↓ observations
POSIT Spine / canonical state ledger
    ↓ resolved state + provenance + effective time + finality
AR / Rendering Engine
    ↓ contextual representation
Journey / Cards / Companion / Evidence

DVN / BTC
    ↳ evidentiary finality attached to canonical evidence
```

Future Persona Spine, SmartTriad Spine, Companion Observer, IRL OS, venture journeys and constitutional runtime surfaces should converge on the same state contract rather than creating domain-specific state interpreters.

---

## §13 Ratification note

CFS-055 is ratified by operator direction on 2026-08-10 following the Horizen pilot state-coherence investigation.

The discovery case is operational, but the law is architectural:

> **Constitutional Computing is the disciplined transformation of provable state through time. Its interfaces are trustworthy only when observation, state resolution, representation and evidentiary finality remain coherent.**
