# EXP-P2 — Shared Constitutional Framework (POINTER INDEX)

**Invariant Research Lab (IRL) · Governs EXP-P2A and EXP-P2B**
**Status: pointer index only. The authoritative text is
[`02_protocol-v0.5.md`](02_protocol-v0.5.md).**

> **This document holds no normative content.** When the operator supplied the v0.5 protocol
> (2026-07-27), v0.5 became the single authoritative text for all seven shared concerns. Anything
> this file might say about them would be a second copy of a constitutional rule, which is the
> drift the protected-element registry (v0.5 §49) exists to prevent. So this file was reduced to
> what it can uniquely provide: **the map from each shared concern to the section of v0.5 that owns
> it.**
>
> The canary in `tests/source-of-truth-parity.test.ts` enforces this directly — no framework
> document may reproduce a normative sentence of v0.5.

---

## Why the seven concerns still have a home here

The operator ruling that created the consequence family, verbatim:

> "P2A and P2B should share everything above the experimental domain": constitutional principles ·
> claims discipline · representation certification · statistical analysis · decision procedure ·
> audit framework · information equivalence — *"exactly the same"* for each. **"The only thing
> that changes is the domain."**

v0.5 satisfies that ruling structurally: it is **one protocol covering both domains**, with the
domain-specific material quarantined in Part V (§19 P2A, §20 P2B). Everything else in v0.5 is
shared by construction. This index records which section answers which concern, so a reader who
arrives with the ruling's vocabulary can find the governing text.

---

## Part II — The seven shared concerns

### §1 Constitutional principles

→ **v0.5 §6**, Principles I–X. Supporting: §1 purpose, §2 programme position, §3 primary question,
§4 RQ2.1–RQ2.6, §5 H2.1–H2.7.

### §2 Claims discipline

→ **v0.5 §7** (7.1 permitted · 7.2 prohibited · 7.3 registered terminology), **§8** the P2/P3
anti-goalpost clause, and Principle VIII. The registered construct name that must carry every
confirmatory headline is fixed by §7.3.

### §3 Representation certification

→ **v0.5 §14** (RSS-001's role within EXP-P2) and **§15** (Representation Firewall FW.1–FW.6).
Execution position: **v0.5 §50 step 6** places the independent W2/W3 equivalence audit before the
pilot. Bidirectional audit requirement:
[`03_operational-amendment-v0.5.md`](03_operational-amendment-v0.5.md) §A4.

> **Supersession recorded — read this before citing the earlier five-step gate.**
> Before v0.5, this file described RSS-001's P2 role as a five-step admissibility gate carried over
> from the ruling that created the family: Atomic Content Mapping · Informational Equivalence ·
> Tiered Computational Equivalence · Representation Certification · Assumption Back-Propagation.
> **v0.5 §14 narrows that to three functions** — atomic decomposition; within-modality equivalence
> audit; completeness and consistency certification — and states that RSS-001 "does not serve its
> P3 role of comparing different representational substrates" and that its certification "does not
> establish computational equivalence between W2 and W3."
>
> The narrowing follows from v0.5's process recentering: P2 manipulates workflow operations, so
> **Tiered Computational Equivalence (`RSS-001 §2`, Section T) is not part of P2's use of the
> standard.** v0.5 governs. The earlier framing is recorded here so the change is visible rather
> than silent, and it must not be reintroduced by citing the pre-v0.5 wording.
>
> The RSS-001 sections that remain in play for P2 are `RSS-001 §1` (certification chain),
> `RSS-001 §1.1.1` (atomic content mapping), `RSS-001 §1.1` and `RSS-001 §1.1.2` (informational
> equivalence and back-translation), `RSS-001 §1.2` (structural fidelity is measured, never
> inferred from downstream performance), `RSS-001 §3` with `RSS-001 §BP.3` (assumption
> back-propagation), and `RSS-001 §5` (the audit framework). RSS-001 itself:
> [`../exp-p3-representation-of-structural-invariants/03_RSS-001_representation-science-standard.md`](../exp-p3-representation-of-structural-invariants/03_RSS-001_representation-science-standard.md).

### §4 Statistical analysis

→ **v0.5 §36**, with §33 sample structure, §34 model population, §35 randomization, §37 missingness.
Instrument: [`04_statistical-analysis-plan-skeleton.md`](04_statistical-analysis-plan-skeleton.md) —
structure frozen, every number unresolved.

### §5 Decision procedure

→ **v0.5 Part IX**: §38 protection clause · §39 parameters frozen after pilot · §40 per-domain rule ·
§41 cross-domain aggregation · §42 harmful and adverse results · §43 falsification conditions ·
§44 secondary contrast decisions · §45 programme stopping-rule linkage.

### §6 Audit framework

→ **v0.5 §13.5** (freeze and commitment), **§46** role separation, **§47** commitment inventory,
**§48** change control, **§49** protected-element registry, **§50** execution sequence. Method
source: `RSS-001 §5`.

### §7 Information equivalence

→ **v0.5 FW.3** (W2/W3 substantive equivalence) and **FW.4** (the declared constitutive residual),
with **§14** function 2. Bidirectional requirement and the three-category auditor instruction:
amendment §A4.

---

## Document set

| File | What it is |
|---|---|
| [`README.md`](README.md) | Family index; the two programme views; the ruling that created the family |
| [`02_protocol-v0.5.md`](02_protocol-v0.5.md) | **Authoritative.** The full protocol — Parts I–X, Appendices A–D |
| [`03_operational-amendment-v0.5.md`](03_operational-amendment-v0.5.md) | W2.5 diagnostic cell; four feasibility gates; the unresolved stopping-rule item |
| [`04_statistical-analysis-plan-skeleton.md`](04_statistical-analysis-plan-skeleton.md) | SAP skeleton — artifact 2 of five |
| `01_shared-constitutional-framework.md` | This pointer index |
