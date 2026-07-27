# Validation Programme Series Ratification Packet — EXP-P1 / EXP-P2 / EXP-P3

**Invariant Research Lab (IRL) · Prepared 2026-07-27**
**Purpose:** present the three P-series experiments to the external partner (Austin and his
scientific review agent) as a single series for ratification, with per-experiment status, the
ratification questions verbatim, the evidence base, and the recorded P1 exit condition.
**Status: DRAFT for operator review — one item in §6 requires operator decision before this
packet is sent externally.**

---

## 1. The series at a glance

| Slot | Experiment | Canonical doc set | Status | Ratification instrument |
|---|---|---|---|---|
| **P1** | **The Representation & Runtime Gauntlet** — four-arm comparative design (Cold / Expert Prose / Flattened Invariants / Full Runtime) + sufficiency and mutation probes | `exp-p1-representation-runtime-gauntlet/` | REGISTERED 2026-07-17 as the joint pre-registration instance of EXP-010's frozen design. Pending: predictions lock (§2), pre-registration bundle (§10), joint signature (§15). **Operator-stated exit condition on our side before signing — see §4.** | Joint sign-off (P1 §15): both signatures → bundle assembled, hashed, published → design frozen |
| **P2** | **Invariant-Governed Generation and Verification for Physical Design** — arms B / C / B+R / B+R-D / D; primary confirmatory contrast **D versus B+R-D** | `exp-p2-invariant-governed-physical-design/` | **v1.0 Candidate — pending series ratification.** Consolidated after multiple independent adversarial reviews; intermediate versions deliberately not republished (protocol §29 records the review history) | One narrow certification question to the requested reviewers — verbatim in §2 |
| **P3** | **Representation of Structural Invariants** — arms L / M / D / S / H under audited informational equivalence; two-tier claim architecture; RSS-001 methodology standard | `exp-p3-representation-of-structural-invariants/` (six-doc set: Brief · Protocol · RSS-001 · SAP · Implementation Guide · Internal Research Record) | **v1.0 Candidate — pending series ratification.** Protocol for external scientific review; two adversarial review cycles absorbed; documentation refactored per the governing Implementation Brief | Seven registered review questions + review posture — verbatim in §2 |

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

1. Operator resolves the remaining half of §6 FLAG 1 — the **EXP-P2** designation (the P3 half
   was ruled 2026-07-27; P2 still points the Laboratory at the older Structural Invariance design).
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

## 6. Flags (do not send externally until the open flag is resolved)

### FLAG 1 (P3 RESOLVED 2026-07-27 · P2 OPEN) — EXP-P2 / EXP-P3 designation collision (naming, not superseding)

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

**P3 — RESOLVED (operator, 2026-07-27):** *"EXP P3 is supposed to be about invariant
representation not capability. What's in the lab does not seem to be in line with the file I
shared."* The **EXP-P3** designation now names **Representation of Structural Invariants**.
Applied: `EXPERIMENT_REGISTRY`'s EXP-P3 entry (family, hypothesis, `protocolRef`) points at the
new six-doc set, so the Laboratory view shows the representation experiment; the Capability
Validation design is retained with a reassignment banner and must not be cited as "EXP-P3"
until its own number is settled.

**P2 — STILL OPEN, and it is the same question.** The registry's EXP-P2 entry still names the
**Structural Invariance** battery, not the **Invariant-Governed Physical Design** protocol in
this packet — so the Lab shows the old design for P2 exactly as it did for P3. The identical fix
is available and takes one edit. It is held for an explicit ruling for one reason: **EXP-P1 §14
names the old P2 meaning in ratified, externally-countersigned text**, so reassigning P2 changes
what a document already in the partner's hands refers to. Recommended: reassign P2 to match P3
(the series then reads P1 compression → P2 consequence → P3 representation, which is how the
briefs themselves describe it) and gloss the P1 §14 reference in the transmittal rather than
silently re-pointing it.

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

## 7. Document inventory (what the partner receives)

- **P1:** `exp-p1-representation-runtime-gauntlet/README.md` (+ `AUSTIN_ONE_PAGER.md`,
  `AUSTIN_COVER_NOTE.md`, `OPERATOR_SIGNING_RUNBOOK.md` as transmittal aids)
- **P2:** `exp-p2-invariant-governed-physical-design/README.md`
- **P3:** `exp-p3-representation-of-structural-invariants/` — `01_experimental-brief.md`,
  `02_experimental-protocol.md`, `03_RSS-001_representation-science-standard.md`,
  `04_statistical-analysis-plan.md`, `05_implementation-guide.md`
  (`06_internal-research-record.md` is IRL-internal and is **not** part of the external packet)
- **Evidence base:** the Findings Report + Executive Memorandum (confidential, per its own
  handling terms)
