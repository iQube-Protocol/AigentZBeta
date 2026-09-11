# CFS-052 — Evidence Architecture & Dual Validation

**Chrysalis Foundation Specification · v1.0 · Status: RATIFIED (operator-directed, 2026-07-27)**
**Constitutional anchor:** CFS-009 **Law XVI — Constitutional Evidence**
**Composes:** CFS-009 (Laws XI, XII, XVI) · CFS-019 (IRL Charter) · CFS-032 (Capability Registry) ·
CFS-049/CCR-001 (Capability Briefs) · the Horizen Phase 0 audit Amendments B, D, E ·
the metaCommons Charter (polity-core)

---

## §0 AUDIT FIRST — what already expresses this, before anything new is written

The commission's binding instruction, carried over from CCR-001: *do not duplicate what is already
law under another name.* **Most of this amendment is already canon.** Recorded before any new text
is treated as new:

| Amendment clause | Already expressed as | Disposition |
|---|---|---|
| **I.1** two invariant classes, neither subordinate | **CLAUDE.md's hypothesis-vs-canon rule** — `canonical` is for *"definitions, methods, governance rules, and doctrine the operator ratifies as how the Institute works"*; `proposed` is for *"claims about the world that experiments exist to test"*. That IS the constitutional/structural split, under different names | **NAMES an existing rule.** Part I supplies the vocabulary the rule was missing |
| **I.2** structural validation is scientific | `FINDING_LIFECYCLE` (`observed → replicated → canonized-as-invariant`, pinned canon, `types/research.ts`); the experiment registry; CFS-034's progression ladder | **EXISTS** |
| **I.3** operational success is constitutional evidence | CFS-032 §5, shipped: *"registration is the ELIGIBILITY GATE, operational evidence is the ACCRUAL TRIGGER"*; `recordOperationalValidation` accrues Standing only from observed production behaviour | **EXISTS in code.** Part I.3 states the principle that function already implements |
| **II.1/II.2** Lab mandates | Horizen audit **§D.6** (Lab articulation, canon): Research Lab *"What is true?"* → scientific & structural proof; Venture Lab *"Does it work in the real world?"* → commercial & operational proof; Proof Commons *"What has now been demonstrated?"* | **RESTATES canon.** §D.6 is the source; this is its constitutional form |
| **II.3** Venture Lab not blocked on scientific consensus | Horizen audit **§D.4** — Programme B *"must not be gated on Programme A"* | **EXISTS** |
| **III.1** Registry = what exists | `services/constitutional/capabilityRegistry.ts` (CFS-032) + `artifact_records` (migration `20260712000000`) are the de-facto stores | **EXISTS as implementation, NOT as a named boundary** |
| **III.2** Commons = what is demonstrated | Prose only. `MetaCommonsResource` **does not exist** (Horizen audit §0). `services/venture/metacommonsSignals.ts` is a self-declared deterministic stub computing confidence scores — it defines no proof type | **NEW as constitutional text; NOT built, and this document does not build it** |
| **III.3/III.4** proof compresses and regenerates evidence | Partly: `artifact_records` pairs `content_hash` + `receipt_id` as *"the T2 verification pair"*; CCR-001's `CommonsPublicationRecord` already requires `evidenceRefs` + `lineage` | **EXTENDS an existing discipline to a stated law** |
| **IV.1/IV.2** admission criteria | Implicit in the two shapes: `RegisterCapabilityInput` requires only an id and a label (existence); `CommonsPublicationRecord` refuses without evidence references and a claim scope (proof) | **NAMES the existing asymmetry** |
| **Four proof classes** | Horizen audit **§D.1**, operator-ratified; mirrored in code as `COMMONS_PROOF_CLASSES` (`types/capabilityCompletion.ts`) | **EXISTS — not re-decided here** |
| **PoWP / PoTS** (III.2's proof list) | **Already canonical invariants**: `inv.polity.160` (Proof of Work Potential), `inv.polity.161` (Proof of Time Saved), `inv.polity.162` (verification-accrual gate) | **EXISTS.** Part III.2 must not redefine them |
| **The Law** | Nothing. This is genuinely new | **NEW — CFS-009 Law XVI** |

**Two clauses in III.2's proof list have no referent anywhere in the repo or the canon: "Proof of
Risk Reduction" and "Proof of Constitutional Compliance" (zero occurrences).** They are introduced
here as constitutional vocabulary only. Nothing implements them, and §8 records that honestly
rather than implying a registry that does not exist.

### Audit findings requiring operator attention (recorded, not resolved)

1. **`FINDING_LIFECYCLE` claimed an enforcement that did not exist.** `types/research.ts:7` states
   the lifecycle order is *"pinned by canary"*. No canary pinned it. This is the MS-7 defect class
   (*an inert mechanism is a defect*) applied to constitutional data. **Now enforced** by
   `tests/capability-completion.test.ts` under Ruling 1.
2. **CFS-009 references an "Appendix A" it does not contain** (twice). Appendix A is a separate
   file, `appendix-a_canonical-invariants.md`. The reference is correct in substance, misleading in
   form.
3. **All fifteen prior Laws sit at `status: "proposed"` in `canonical-invariants.seed.json`**, while
   CFS-009 §1 asserts *"Each law is itself a canonical invariant."* Laws XIV and XV have no
   CFS-009-sourced seed entry at all. **This document does not modify the seed crystal** — amending
   canon is an operator act under Law XI. §9 supplies the exact entry to add.
4. **The Horizen Amendments A–E were never recorded in `AMENDMENT_RECORDS.md`**, though CFS-009's
   own enforcement clause requires it. Law XVI's record is added; the Horizen backlog is flagged.
5. **`CommonsEvidencePosture` / `sourceLifecycle` exist as one line of prose** (audit §B.4) and no
   code. The *pattern* is mirrored by CCR-001's completion ladder; the type itself is Phase 5.

---

## §1 The Law (canonical statement)

Recorded in full at **CFS-009 Law XVI — Constitutional Evidence**. Reproduced here as the
specification's governing text:

> **Truth is discovered through research.**
> **Trust is earned through operation.**
> **Knowledge is preserved as evidence.**
> **Confidence is preserved as proof.**

## §2 Part I — The Dual Validation Principle

**I.1 — Distinct validation regimes.** The platform recognises two complementary but distinct
classes of invariant. **Structural Invariants** describe stable properties of *reality* and are
validated scientifically. **Constitutional Invariants** describe stable properties of *successful
systems* and are validated operationally. Neither class is subordinate to the other. Each possesses
its own evidentiary standard.

**I.2 — Structural validation.** Structural invariants SHALL be validated through scientific
methods including, but not limited to: reproducibility; falsifiability; compression; predictive
capability; cross-domain transferability; independent verification. Their purpose is the discovery
of reusable structural truth.

**I.3 — Constitutional validation.** Constitutional invariants SHALL be validated through
successful operation. Operational evidence includes: reduction in engineering defects; reduction in
coordination cost; reduction in repair effort; successful governance; regulatory compliance;
successful delegation; commercial adoption; measurable customer benefit; societal benefit;
repeatable deployment. Operational success constitutes constitutional evidence. Scientific
validation strengthens constitutional invariants but is not a prerequisite for their operational
use.

### §2.1 Reconciliation with §D.5 and the hypothesis-vs-canon rule — CONFIRMED, not refuted

The commission flagged a possible conflict: I.1 says neither class is subordinate, and I.3 says
operational success is sufficient evidence — while Amendment D §D.5 says *"Only the Research Lab
canonises… a commercial success never promotes an invariant to `canonical`"*, and CLAUDE.md's
hypothesis-vs-canon rule holds empirical hypotheses at `proposed` until experiments support them.

**Checked against the source. There is no conflict, and the reading that dissolves it is the
narrow one.** Three findings:

1. **I.3 governs USE, not canonisation.** Its operative words are *"not a prerequisite for their
   operational **use**."* It nowhere claims operational evidence promotes a structural claim to
   `canonical`. §D.5's prohibition is untouched.
2. **The two rules already partition the same space.** CLAUDE.md reserves `canonical` for
   *"definitions, methods, governance rules, and doctrine"* — which is precisely Part I.1's
   **Constitutional Invariants** — and holds at `proposed` those *"claims about the world that
   experiments exist to test"* — precisely Part I.1's **Structural Invariants**. The
   hypothesis-vs-canon rule is Part I under an older name. Part I adds vocabulary; it changes no
   status of anything.
3. **The subordination I.1 denies is epistemic, not procedural.** "Neither class is subordinate"
   means neither evidentiary *standard* outranks the other. §D.5 is a statement about *who holds
   the canonisation authority for structural claims* — an allocation of authority under Law XI,
   not a ranking of evidence. Both hold simultaneously.

**So the discipline is Ruling 1's again: the two regimes MAP; they are never unified.** A
constitutional invariant validated operationally and a structural invariant validated scientifically
are both fully valid within their own regime, and neither ladder is rewritten into the other.

**Boundary that keeps the loop honest, restated so no future reader has to re-derive it:**
operational success is sufficient for a constitutional invariant to be *relied upon*; it is never
sufficient to canonise a *structural* claim. If a future change would make commercial evidence
promote a structural invariant to `canonical`, that is an amendment to §D.5 and Law XI — a
discussion, not an implementation.

## §3 Part II — Research Lab & Venture Lab

**II.1 — Research Lab mandate.** The Invariant Research Lab exists to discover, test and refine
structural invariants. Its primary question: *Is this structurally true?* Its output is scientific
knowledge.

**II.2 — Venture Lab mandate.** The Venture Lab exists to operationalise constitutional invariants.
Its primary question: *Does this consistently produce better systems?* Its output is operational
proof. **Commercialisation is therefore a constitutional validation mechanism rather than merely a
revenue mechanism.**

**II.3 — Independent progress.** The Venture Lab SHALL NOT be blocked by pending scientific
consensus where constitutional evidence is already sufficient. Operational proof may precede
scientific proof. Scientific validation increases confidence and transferability but does not
invalidate demonstrated constitutional value.

*Note (audit §B.6, canon): the Labs are asymmetric by design — the Research Lab is scientifically
rich, the Venture Lab venture-rich. Part II states the mandates; it does not require the two Labs
to model the same objects.*

## §4 Part III — Registry & metaCommons

**III.1 — Registry purpose.** The Registry is the constitutional **system of record**. It stores
assets: documents, software, experiments, receipts, datasets, models, media, iQubes, knowledge
artefacts. The Registry answers: ***What exists?***

**III.2 — Commons purpose.** The metaCommons is the constitutional **system of proof**. It stores
validated proofs: Proof of Time Saved; Proof of Work Potential; Proof of Risk Reduction; Proof of
Constitutional Compliance; Proof of Standing; Proof of Delegation; Proof of Commercial Viability;
Proof of Scientific Reproducibility. The Commons answers: ***What has been demonstrated?***

> **Constraint on this list.** Proof of Time Saved and Proof of Work Potential are already canonical
> invariants (`inv.polity.161`, `inv.polity.160`) with settled definitions; this clause enumerates
> them, it does not redefine them. The remaining six are constitutional vocabulary with no
> implementation. Nothing may present them as a shipped registry (§8).

**III.3 — Proof compression.** A proof is a constitutional **compression** of an evidence suite.
Proof SHALL contain only the minimum information required to verify a demonstrated proposition.
Supporting evidence SHALL remain within the Registry. **The Commons stores proofs. The Registry
stores evidence.**

**III.4 — Regeneration.** Proof SHALL be sufficient to regenerate its evidence trail. Accordingly:
a receipt regenerates a transaction, and a proof regenerates an evidence suite. This establishes
constitutional symmetry between commerce, governance and knowledge.

## §5 Part IV — Admission rules

**IV.1 — Registry admission.** Objects enter the Registry **because they exist**. Existence is the
admission criterion.

**IV.2 — Commons admission.** Objects enter the Commons **because they prove something**. Proof is
the admission criterion. If no proposition is demonstrated, the object SHALL remain solely within
the Registry.

*Already visible in the shipped shapes: `RegisterCapabilityInput` refuses only for a missing id or
label — existence. `CommonsPublicationRecord` refuses without evidence references and a claim scope
— proof. Part IV names an asymmetry the code already has; the canaries pin it so the two cannot
collapse into one.*

## §6 Part V — The Constitutional Knowledge Stack

```
Reality
    ↓
Evidence
    ↓
Registry                  "What exists?"
    ↓
Proof
    ↓
metaCommons               "What has been demonstrated?"
    ↓
Invariant Intelligence    "What can now be relied upon?"
```

Each layer is **derived from, but not interchangeable with**, the layer beneath it. The stack is a
compression sequence: each step discards what the layer above does not need while remaining
sufficient to regenerate it (III.4). Collapsing any two adjacent layers destroys the compression
that makes the upper one worth having.

## §7 Part VI — Venture economics

Commercialisation is recognised as an **evidentiary process**. Revenue, adoption, regulatory
acceptance, operational efficiency and customer outcomes constitute constitutional evidence.
Accordingly:

| Institution | Advances / preserves |
|---|---|
| Research Lab | scientific certainty |
| Venture Lab | constitutional certainty |
| metaCommons | demonstrated proof |
| Registry | supporting evidence |

These four institutions together constitute the platform's constitutional knowledge architecture.

## §8 What this document does NOT do

Recorded explicitly, because a constitutional text that reads as a shipped system is the CS-001
drift defect:

- **No Commons promotion or submission flow.** `MetaCommonsResource` does not exist and is not
  created here. That is Horizen Phase 5.
- **No proof resource model.** The eight proof types in III.2 are constitutional vocabulary; six
  have no implementation and none gains one here.
- **No change to any invariant's status**, and no modification of `canonical-invariants.seed.json`
  (Law XI — canon is amended by the operator, not by an agent).
- **No change to `FINDING_LIFECYCLE`**, which stays pinned canon.
- **No unification of `COMMONS_PROOF_CLASSES` with `EXPERIMENT_CLASSES`.** They are two distinct
  four-member vocabularies — a proof's *class* and an experiment's *class* are different
  questions — and a canary now prevents a well-meant merge.

## §9 Operator actions outstanding

**1. Seed-crystal entry for Law XVI.** The Laws' canonical-invariant form lives in the seed crystal;
amending it is an operator act. Paste this object into the `invariants` array of
`codexes/packs/irl/foundation/canonical-invariants.seed.json` (append-only — do not renumber), and
mirror the statement into `appendix-a_canonical-invariants.md`:

```json
    {
      "id": "inv.constitutional.NNN",
      "namespace": "constitutional",
      "semantic_type": "law",
      "statement": "Truth is discovered through research; trust is earned through operation; knowledge is preserved as evidence; confidence is preserved as proof. Structural invariants are validated scientifically and constitutional invariants operationally; neither regime is subordinate to the other and neither is rewritten into the other. The Registry admits objects because they exist; the Commons admits objects because they prove something. A proof is a compression of an evidence suite and must remain sufficient to regenerate it.",
      "status": "proposed",
      "contexts": [
        "governance",
        "epistemology",
        "commons"
      ],
      "provenance": {
        "source": "CFS-009 Law XVI — Constitutional Evidence; CFS-052; operator ratification 2026-07-27"
      }
    },
```

*Replace `NNN` with the next free number in the `constitutional` namespace. Entered at `proposed`
to match every other Law in the crystal — see audit finding 3; promoting the Laws as a set is a
separate operator decision.*

**2. Record the Horizen Amendments A–E in `AMENDMENT_RECORDS.md`.** They were ratified 2026-07-27
and never recorded, though CFS-009's enforcement clause requires it. Law XVI's own row has been
added; the Horizen backlog has not, because recording another workstream's amendments is not this
document's authority.

**3. DVN anchoring** of the Law XVI amendment, per CFS-009's amendment process
(*proposal → operator ratification → `AMENDMENT_RECORDS.md` → DVN anchoring*). Steps 1–3 of that
chain are complete; anchoring is an operator action.

## §10 Enforcement

`tests/evidence-architecture.test.ts` — the canaries for this document:

| Canary | Guards |
|---|---|
| Law XVI text is pinned, verbatim, in CFS-009 | The Law cannot drift (§1) |
| The Laws are a contiguous roman sequence ending at XVI | A Law cannot be dropped or renumbered |
| Registry and Commons admission criteria stay distinct | IV.1 / IV.2 cannot collapse into one |
| A proof record cannot exist without evidence references | III.4 regeneration |
| The four proof classes stay the ratified four | §D.1 is not re-decided |
| The two validation regimes stay separate ladders | I.1 / Ruling 1's map-don't-unify |
| `FINDING_LIFECYCLE` is not rewritten, extended or re-ordered | Pinned canon (`inv.constitutional.078`) |
| CFS-052 is registered and its §4 mirror matches the code | Docs-mirror parity |
