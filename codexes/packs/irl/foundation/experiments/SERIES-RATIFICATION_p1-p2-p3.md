# Validation Programme Series Ratification Packet — EXP-P1 / EXP-P2 / EXP-P3 (+ P4 reserved)

**Invariant Research Lab (IRL) · Prepared 2026-07-27**
**Purpose:** present the three P-series experiments to the external partner (Austin and his
scientific review agent) as a single series for ratification, with per-experiment status, the
ratification questions verbatim, the evidence base, and the recorded P1 exit condition.
**Status: DRAFT for operator review. Both §6 flags are RESOLVED (2026-07-27). The remaining
external prerequisite is §7a — the renumbering notification the partner must receive alongside
the packet.**

---

## 1. The series at a glance

| Slot | Programme role | Experiment | Canonical doc set | Status | Ratification instrument |
|---|---|---|---|---|---|
| **P1** | **Compression** | **The Representation & Runtime Gauntlet** — four-arm comparative design (Cold / Expert Prose / Flattened Invariants / Full Runtime) + sufficiency and mutation probes | `exp-p1-representation-runtime-gauntlet/` | REGISTERED 2026-07-17 as the joint pre-registration instance of EXP-010's frozen design. Pending: predictions lock (§2), pre-registration bundle (§10), joint signature (§15). **Operator-stated exit condition on our side before signing — see §4.** | Joint sign-off (P1 §15): both signatures → bundle assembled, hashed, published → design frozen |
| **P2** | **Consequence** | **Invariant-Governed Generation and Verification for Physical Design** — arms B / C / B+R / B+R-D / D; primary confirmatory contrast **D versus B+R-D** | `exp-p2-invariant-governed-physical-design/` | **v1.0 Candidate — pending series ratification.** Consolidated after multiple independent adversarial reviews; intermediate versions deliberately not republished (protocol §29 records the review history) | One narrow certification question to the requested reviewers — verbatim in §2 |
| **P3** | **Representation** | **Representation of Structural Invariants** — arms L / M / D / S / H under audited informational equivalence; two-tier claim architecture; RSS-001 methodology standard | `exp-p3-representation-of-structural-invariants/` (six-doc set: Brief · Protocol · RSS-001 · SAP · Implementation Guide · Internal Research Record) | **v1.0 Candidate — pending series ratification.** Protocol for external scientific review; two adversarial review cycles absorbed; documentation refactored per the governing Implementation Brief | Seven registered review questions + review posture — verbatim in §2 |
| **P4** | **Interaction** | **Invariant Interaction** — do structural invariants exhibit interaction or field-like behaviour? | `exp-p4-invariant-interaction/` (reservation note only) | **RESERVED — designation held, protocol NOT yet designed.** Deferred from P3 deliberately: interaction concerns properties of the invariants themselves, not their representation | None yet — nothing to ratify until a protocol exists |

Epistemic status, uniformly: every P-series hypothesis (P1 §2 predictions; P2 §4 primary
hypothesis; P3 H3.1–H3.4) is an empirical hypothesis under test — `proposed`, never canon —
until its registered decision procedure produces supporting evidence. All three protocols carry
explicit falsification/null provisions, and supported nulls are registered as meaningful
outcomes.

## 2. Ratification questions (verbatim)

### P1 — joint sign-off

P1 carries no single ratification question: its ratification instrument is the joint signature
block (P1 protocol §15) over the frozen pre-registration bundle (§10), with both parties'
predictions locked beforehand (§2). Quoting the protocol's closing line verbatim:

> "*Upon both signatures: bundle assembled, hashed, published. The design is frozen. Everything after this is measurement.*"

### P2 — the narrow certification question

Per the closing review guidance recorded in the P2 staging source, reviewers receive only the
consolidated v1.0 Candidate and are asked one narrow question:

> "Would you ratify this protocol for execution? If not, identify only those issues that would prevent preregistration or materially invalidate the experiment."

The P2 protocol's own ratification section (§30), verbatim:

> This protocol is submitted for independent ratification.
>
> Requested reviewers:
> - Austin's scientific review agent (scientific validity and falsifiability).
> - Claude (protocol consistency, implementation feasibility, and constitutional alignment).
>
> Following successful ratification, this document becomes the canonical EXP-P2 protocol within the Invariant Research Lab and serves as the preregistered reference for execution.

### P3 — registered questions for review

From the P3 Experimental Brief (01 §13), verbatim:

> Reviewers are asked to evaluate the conceptual design rather than implementation details. In particular:
>
> 1. Is representational substrate isolated as the primary scientific variable?
> 2. Does the proposed methodology adequately separate representation from information content?
> 3. Is the relationship to P1 and P2 scientifically well-defined?
> 4. Are the experimental claims proportionate to the hypotheses being tested?
> 5. Are there unresolved sources of confounding that would invalidate causal interpretation?
> 6. Does the proposed methodology constitute a meaningful contribution independent of the experimental outcomes?
> 7. What single issue would most likely prevent this experiment from supporting publishable scientific conclusions?

And the registered review posture (01 §14), verbatim:

> The purpose of this review is not to optimize performance or implementation. It is to determine whether the experiment, if executed faithfully, would constitute a scientifically valid test of its central hypothesis.
>
> The review is therefore requested from the perspective of a skeptical external evaluator rather than a collaborator.

## 3. Evidence base

The evidence base accompanying this packet is the **Foundational Validation Series Findings
Report + Executive Memorandum**, staged verbatim at
`foundation/experiments/_source/2026-07-26_series-findings-and-memo_source.md` (CONFIDENTIAL
DRAFT for strategic partners).

What it establishes, stated within its own limits:

- **EXP-001 (semantic fidelity), EXP-002 (temporal fidelity), EXP-003 (computational
  efficiency)** each have one canonical run published, with the exact results JSON
  sha256-committed and anchored via the DVN-anchorable `experiment_result_published` receipt
  path — verification is mechanical, not asserted. Provider and model are recorded per run in
  the report's data tables; cross-model rows are never merged.
- Headline adjudicated findings (per the report): constitutional restraint 15/15 on
  hallucination probes and zero artifact-attributable hallucinations (EXP-001); continuity
  across four independently generated video segments with a reversed-order control showing
  graded, dissociable sequencing degradation (EXP-002); 26.7% token savings with 100% grounded
  claims in the initialized arm (EXP-003).
- **Limitations, as the report itself states them:** single-model runs to date (deltas are
  within-model; constants are not universals); the judge is a model and required human
  adjudication twice; EXP-002's formal independent-evaluator pass is open; the collection was
  authored by the platform's own constitutional process, so task-collection affinity is by
  design and cross-domain generalization is untested.

**What this evidence is — and is not — offered as.** The EXP-001-lineage series is evidence
that the programme's instrumentation, receipting, adjudication, and null discipline work, and
it is the empirical motivation for the P-series scale-up the Memorandum describes (replication,
independence, larger collections). It is **not** evidence for the P1/P2/P3 hypotheses
themselves, which remain `proposed` and are exactly what the P-series exists to test. The
Memorandum's central hypothesis ("Can validated knowledge itself become a reusable
computational primitive?") likewise remains a hypothesis under test.

## 4. P1 exit condition (operator-stated, recorded verbatim)

The operator has stated the following condition on closing out P1 from our side:

> "I think we need to close out the Crystal with the new Finacial Services invariants as a final deliverable for P1 on our side before the protocol is signed by both sides."

Recorded as: **the P1 joint signature (§15) is not to be executed until the Crystal close-out
deliverable is complete on the IRL side.**

**Interpretation — operator-confirmed (2026-07-27).** "The Crystal" is the **invariant
register** — the canonical invariant register (the invariant crystal / seed register), whose P1
freeze instance is `Crystal vP1` (see
`exp-p1-representation-runtime-gauntlet/CRYSTAL-ENLARGEMENT_plan.md` and P1 protocol §3:
enlargement precedes freeze, under the receipted-lifecycle and sequence-is-sacred rules).
Closing it out means landing the new Financial Services invariants (the FS invariant library
derived under the finance/qriptocent sub-domain, per
`foundation/CRP-003a_constitutional-financial-services-programme.md` and the QriptoCENT corpus
scaffold) into that register before the freeze that the joint signature locks.

Two execution details remain to be settled with the operator during the close-out itself (they
do not block this packet): (a) which Financial Services invariant set constitutes the
deliverable; and (b) whether the FS invariants enter `Crystal vP1` under P1 §3(c)'s in-domain
enlargement rule, or the close-out is a separate register deliverable that merely sequences
before signature. The P1 protocol's own discipline applies either way: enlargement happens
**before** freeze, via the normal receipted lifecycle, never bulk-authored to hit a number.

## 5. Proposed ratification sequence

1. ~~Operator resolves the §6 designation collision~~ — **RESOLVED 2026-07-27** (renumbering
   applied; the partner notification text is §7a).
2. IRL completes the P1 Crystal close-out deliverable (§4 — interpretation operator-confirmed;
   landing the Financial Services invariants in the invariant register before P1 freeze).
3. P1: predictions locked (§2) → bundle assembled and hashed (§10) → joint signature (§15).
   The x409 agreement signed at freeze also authorizes Austin's agent's external result
   submission path (P1 §11 Phase 2, CFS-042).
4. P2: consolidated v1.0 Candidate sent to the requested reviewers (§30) with the narrow
   certification question (§2 above). On ratification, P2 becomes the canonical preregistered
   reference for execution.
5. P3: six-doc set (01 → 02 → 04 → 03 reviewer reading order) sent with the registered review
   questions (§2 above). On ratification, parameter freezing (⟦ ⟧ values) and the S-vs-L
   pre-pilot proceed per the Implementation Guide.
6. Ratification outcomes recorded per experiment; any reviewer-identified blocking issues are
   resolved by protocol amendment **before** the respective freeze — never after (P1 §10;
   P2 §§18–19, 27; P3 SAP DP.9).

## 6. Flags (both resolved 2026-07-27 — see §7 for what the partner must be told)

### FLAG 1 (RESOLVED 2026-07-27) — EXP-P2 / EXP-P3 designation collision (naming, not superseding)

The designations P2 and P3 are each now claimed by two different designs:

| Designation | Pre-existing directory (different topic) | New directory (this packet's subject) |
|---|---|---|
| EXP-P2 | `exp-p2-structural-invariance/` — Structural Invariance battery (the "Layer 1 vs Layer 2 / medicine-style" companion named by P1 §14; B1–B5 sub-experiments) | `exp-p2-invariant-governed-physical-design/` — Invariant-Governed Generation and Verification for Physical Design (v1.0 Candidate) |
| EXP-P3 | `exp-p3-capability-validation/` — Capability Validation (D1 Consequence Engineering demonstration slate) | `exp-p3-representation-of-structural-invariants/` — Representation of Structural Invariants (v1.0 Candidate, six-doc set) |

The pre-existing directories were **not modified, renamed, or archived** — that decision is the
operator's. Options include: renumbering the older designs (noting the no-number-reuse rule in
the P1 designation history), archiving them as superseded drafts, or renaming the series slots.
Note also that P1 §14 and the pre-existing P2 README cross-reference each other by the old P2
meaning, and P1's own directory is named `…representation-runtime-gauntlet` while the *new* P3
is the representation experiment — external reviewers will hit this ambiguity immediately if it
is not resolved or explicitly glossed in the transmittal. Both new directories carry a
designation-note warning in the meantime.

**RESOLVED IN FULL (operator, 2026-07-27):** *"let's move the old EXP P2 and P3 to new numbers.
EXP P1/2/3/4 are four fundamental experiments that cover the core breadth of invariant research
… P1/2/3/4 need to be reserved for these strategically core experiments."*

**The ruling.** The designations **EXP-P1 / P2 / P3 / P4 are reserved** for the four core
experiments — one per fundamental question (compression · consequence · representation ·
interaction). The two designs that previously held P2 and P3 are **renumbered, not withdrawn**,
and remain registered in the Laboratory so nothing is lost:

| Was | Is now | Design | Directory |
|---|---|---|---|
| EXP-P2 | **EXP-011** | Structural Invariance battery | `exp-011-structural-invariance/` |
| EXP-P3 | **EXP-012** | Capability Validation demonstration | `exp-012-capability-validation/` |

New numbers are the next free values in the EXP-0NN sequence — **not reused numbers** (the
no-number-reuse rule the P1 designation history records). Both documents keep their full
scientific content, their hypothesis classes, and their governing invariants; each carries a
renumbering banner at the head stating what it was and what now holds its old designation.

**Applied across the record:** `EXPERIMENT_REGISTRY` (EXP-P2 → Invariant-Governed Physical
Design; EXP-P3 → Representation of Structural Invariants; EXP-011 / EXP-012 registered; EXP-P4
reserved), the `VP1` series redefined as the four core experiments, a new `SCS` series
("Structural & Capability Studies") holding EXP-011 / EXP-012, the IRL pack collections, and the
directory names.

**EXP-P4 is reserved, not designed.** `exp-p4-invariant-interaction/README.md` is a reservation
note carrying no protocol, no predictions, and no claims — it exists so the designation cannot be
taken before the interaction protocol is written, and so the Laboratory shows the fourth slot
honestly. It must not be sent to reviewers as an experimental brief.

**On the pre-existing cross-references.** EXP-P1 §14 names "EXP-P2" for the Structural Invariance
battery, in ratified text already in the partner's hands. That text is **not silently
re-pointed**: it is glossed in the notification below (§7a), and the renumbered document itself
states that pre-2026-07-27 references to "EXP-P2" for Structural Invariance mean EXP-011.

### FLAG 2 (RESOLVED 2026-07-27) — "the Crystal" interpretation (see §4)

Operator-confirmed: "the Crystal" is the invariant register (the canonical invariant register /
invariant crystal), receiving the new Financial Services invariants before the P1 joint
signature. The two remaining execution details (which FS invariant set; enlargement mechanics
vs separate deliverable) are recorded in §4 and are settled during the close-out, not blocking
this packet.

### Note — reviewer naming in assembled documents

The P2 staging source's front-matter guidance names the individual reviewers of the intermediate
rounds. The assembled canonical P2 document describes them generically ("an external scientific
reviewer and two independent AI reviewers") and defers the named history to the staging source,
which remains in-repo as provenance. The verbatim ratification question and §30 reviewer
requests are unaffected.

## 7a. Renumbering notification — text for the partner (send with the packet)

The operator's instruction: *"Austin and his agent understand we are setting the lab up at this
stage so I think this amendment will be accepted fine. We should just document it and let them
know the new numbers of these previous EXP2/3 experiments."* The following is drafted to be sent
as-is, and states the change without overstating its significance:

> **Note on experiment numbering (IRL, 2026-07-27).**
>
> As the Lab's experiment register settles, we have reserved the designations **EXP-P1 through
> EXP-P4** for the four experiments that cover the core breadth of the invariant research
> programme — one per fundamental question:
>
> - **EXP-P1 — Reasoning Compression** *(Representation & Runtime Gauntlet)*: can reasoning be
>   compressed into structural invariants?
> - **EXP-P2 — Consequential Performance** *(Invariant-Governed Physical Design)*: do
>   invariant-guided workflows improve consequential outcomes?
> - **EXP-P3 — Representation** *(Representation of Structural Invariants)*: does
>   representational substrate materially affect reasoning?
> - **EXP-P4 — Interaction**: do structural invariants exhibit interaction or field-like
>   behaviour? *(Reserved; not yet designed.)*
>
> Each experiment keeps its full protocol title; the bolded term is its role in the sequence.
>
> Two earlier designs previously carried the P2 and P3 numbers. They are **renumbered, not
> withdrawn** — both keep their full designs and remain in the Lab register:
>
> | Previously | Now | Design |
> |---|---|---|
> | EXP-P2 | **EXP-011** | Structural Invariance battery |
> | EXP-P3 | **EXP-012** | Capability Validation demonstration |
>
> New numbers are the next free values in our EXP-0NN sequence; numbers are never reused.
>
> **Numbers are never reused.** EXP-011 and EXP-012 are the next free values in our EXP-0NN
> sequence; a retired designation is never reassigned to a different design.
>
> **Historical references stay valid.** Documents written before 2026-07-27 that say "EXP-P2" for
> Structural Invariance, or "EXP-P3" for Capability Validation, remain correct as historical
> record. We have glossed them rather than rewritten them, so provenance is preserved.
>
> **One cross-reference to flag specifically:** §14 of the EXP-P1 protocol names "EXP-P2" as the
> Structural Invariance companion experiment. **That reference now resolves to EXP-011.** We have
> **not altered the P1 text** — the countersigned wording stands exactly as signed, and the
> mapping is recorded here and in the EXP-011 document's own lineage banner.
>
> **EXP-P4 is reserved, not designed.** It has no protocol, no predictions, and no results, and
> nothing is being asked of reviewers in respect of it. Its candidate topics remain candidates.
>
> This is programme **normalization** — a numbering and presentation change so the foundational
> sequence reads coherently. **No experiment design, hypothesis, prediction, or finding has been
> revised.**

## 7. Document inventory (what the partner receives)

- **P1:** `exp-p1-representation-runtime-gauntlet/README.md` (+ `AUSTIN_ONE_PAGER.md`,
  `AUSTIN_COVER_NOTE.md`, `OPERATOR_SIGNING_RUNBOOK.md` as transmittal aids)
- **P2:** `exp-p2-invariant-governed-physical-design/README.md`
- **P3:** `exp-p3-representation-of-structural-invariants/` — `01_experimental-brief.md`,
  `02_experimental-protocol.md`, `03_RSS-001_representation-science-standard.md`,
  `04_statistical-analysis-plan.md`, `05_implementation-guide.md`
  (`06_internal-research-record.md` is IRL-internal and is **not** part of the external packet)
- **P4:** nothing — the designation is reserved; the reservation note is internal
- **Renumbering notification:** §7a above, sent with the packet
- **Evidence base:** the Findings Report + Executive Memorandum (confidential, per its own
  handling terms)
