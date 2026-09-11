# EXP-P2 — Programme Stopping-Rule Reconciliation (v0.2 §38 → v0.5)

**Invariant Research Lab (IRL) · Reconciliation artifact for `02_protocol-v0.5.md` Appendix C item 19**
**Status: `proposed` — NOT governing. Requires operator ratification (see §7).**
**Date: 2026-07-28 · Authored under the operator ruling of 2026-07-28 ("treat §38 as a historical
design constraint and derive a v0.5-native successor").**

---

## 1. What this resolves, and what it does not

**Resolves:** it derives a v0.5-native successor to the programme stopping rule, expressed
independently of arm names and substrate count, and maps each semantic requirement of the
historical §38 onto v0.5 — **including the requirements that no longer map at all** (§6).

**Does not resolve:**

- **Appendix C item 19 is still open.** This document is `proposed`; until the operator ratifies it,
  v0.5 has no frozen programme decision point, and v0.5 §45's deferral stands.
- **The v0.3 binding has not been recovered.** No v0.3 document exists in this repository. Nothing
  here reconstructs it, and nothing here should be read as having found it.
- **v0.2 §38 is not bound to v0.5.** It is treated as a historical design constraint, per the
  ruling. The recovered draft remains non-canonical
  ([`05_v0.2-recovered-historical-draft.md`](05_v0.2-recovered-historical-draft.md)).

### Why this is `proposed` and not filed as governing

This is the Canonical Completion Rule (`../CANONICAL-COMPLETION-RULE.md`) applied to my own output,
which is the test the rule is worth having. The successor in §3 is **new normative text**, authored
by an agent. The operator instructed that it be *derived*; an instruction to author is not a
ratification of text that did not yet exist when the instruction was given. Under the rule, nothing
becomes an inherited normative authority by being written confidently — so filing this as governing
would reproduce exactly the defect that made §38 unusable in the first place.

v0.5 §48 points the same way: a substantive change requires an amendment and re-registration before
further confirmatory runs.

## 2. The historical constraint

v0.2 §38 "Programme-level stopping rule", verbatim from the recovered draft:

> The broad claim that invariant systems provide demonstrable value beyond ordinary context
> provision, prompt engineering, and generic review will remain unsupported if adequately powered and
> independently evaluated studies show the following pattern:
>
> 1. P1 demonstrates no reproducible preservation, compression, or efficiency advantage over matched
>    controls;
> 2. P2 demonstrates no reduction in effort-to-threshold or critical structural failure relative to
>    content- and compute-matched controls;
> 3. future repeated-task research demonstrates no cumulative reuse or amortization advantage;
> 4. adverse effects equal or exceed observed benefits.
>
> If this pattern emerges, the programme will concede that the tested invariant architecture has not
> demonstrated its claimed distinct value.
>
> Specific sub-findings may remain valid, such as: structured prompting helps; verification helps;
> domain knowledge helps; engineering review helps.
>
> Those findings must not be relabeled as evidence for an unsupported invariant-specific claim.

## 3. The derived successor — SR-1 … SR-5

Arm-name-free and substrate-count-free, as the ruling requires. Each clause states which part of
§38 it carries.

**SR-1 — Concession condition.** The programme concedes that the tested architecture has not
demonstrated its claimed distinct value when adequately powered, independently evaluated studies
jointly show: no reproducible advantage on the compression question; no reduction in effort to
acceptance and no reduction in critical consequential failure on the consequence question, measured
against content-equivalent and compute-equivalent controls; no cumulative reuse or amortization
advantage where reuse has been tested; and adverse effects at least equalling observed benefits.
*(Carries §38's four-part pattern and its "adequately powered and independently evaluated" gate.)*

**SR-2 — Construct scoping.** A stopping condition discharges only the construct the contributing
experiment registered. A null result on a narrower construct is not a null on any broader
architectural claim and may not be reported as one; neither may a positive result on a narrower
construct be reported as support for a broader one. *(Carries §38's "invariant-specific claim"
discipline, made bidirectional — see §6.1 for why this is load-bearing rather than cosmetic.)*

**SR-3 — Multi-domain resolution.** Where a question is instantiated in more than one independently
confirmatory domain, that question's contribution to SR-1 is the aggregate under the contributing
experiment's own frozen aggregation rule, never a single domain's result. An indeterminate domain
leaves the question's contribution indeterminate. *(New: §38 assumed one substrate and needed no
such rule. v0.5 §41 supplies the aggregation.)*

**SR-4 — Sub-finding non-transfer.** Findings that an adjacent or weaker mechanism helps remain
valid, must be reported under the same standard as the primary result, and may never be relabelled
as support for the unsupported stronger claim. *(Carries §38's sub-findings clause.)*

**SR-5 — Untested condition.** A condition of SR-1 for which no instantiated experiment exists is
neither satisfied nor waived. It is recorded as **untested**, and it blocks any concession claim
that depends on it. *(Derived, not transplanted: §38's pattern is a conjunction, so an untested
conjunct cannot be silently treated as met. Without SR-5 the pattern could be declared "emerged"
while a condition had never been tested at all — which is the live situation for §38 condition 3.)*

## 4. The comparison-validity clause — adopted from the operator's wording

The operator offered this sentence as an example:

> "Every confirmatory comparison must preserve content-equivalent controls, isolate the incremental
> treatment being tested, and include a review-equivalent control where verification or review is
> part of the treatment."

**It is adopted verbatim as SR-0**, and this is recorded as adoption of operator wording rather than
independent derivation. Two things must be said about it honestly:

**Why it survives scrutiny.** It names no arm and no substrate count, and each of its three
requirements already has a v0.5 implementation: content equivalence is FW.3 with the §14 audit
(and, bidirectionally, amendment §A4); the review-equivalent control is W2, a non-droppable element
under §49; compute and tool parity is §18.1.

**Where it needs reading carefully.** "Isolate the incremental treatment being tested" must be read
at the level of the *registered* treatment, not its components — v0.5 §17.1 states plainly that the
primary contrast "does not isolate enumeration, evidence, repair, or gating from one another", and
FW.4 declares that enumeration is constitutive of the construct rather than a separable confounder.
Read component-wise, SR-0 would contradict FW.4 and silently reopen the frozen architecture. Read at
the level of the registered treatment, W3-versus-W2 satisfies it exactly.

**SR-0 is a comparison-validity invariant, not a stopping rule.** It is included because SR-1's
consequence condition depends on it — "content- and compute-matched controls" is a precondition of
that condition being meaningful — not because it is a successor to §38. Conflating the two would be
a category error.

## 5. Mapping — §38 semantic requirement → v0.5

| §38 requirement | v0.5 counterpart | Status |
|---|---|---|
| Condition 1 — compression question shows no advantage over matched controls | **EXP-P1**, not v0.5 | Outside v0.5's scope; v0.5 §45 defers "relationship to P1 and P3" |
| Condition 2 — consequence question shows no reduction in effort-to-threshold or critical failure | Effort → §23 (expert effort to acceptance); critical failure → §25 Critical class + §22 correctness; matched controls → FW.3 + §18.1; contrast → §17.1 **W3 vs W2** | Maps, **but the construct changed** — see §6.1 |
| Condition 2 — "content- and compute-matched" | FW.3 content equivalence; §18.1 compute/tool/time parity; §18.2 pass parity | Maps, and is strengthened (bidirectional audit, amendment §A4) |
| Condition 3 — repeated-task reuse / amortization | **none** | **Does not map** — see §6.2 |
| Condition 4 — adverse effects equal or exceed benefits | §42 harmful and adverse results; Principle IX; §41 Harmful rows | Maps, and is strengthened |
| "adequately powered and independently evaluated" | §33 sample structure; §34 model population; §46 role separation; amendment §A5 expert-hour bound | Maps |
| Sub-findings remain valid but may not be relabelled | §44 secondary contrast decisions; §45 bullet 3 | Maps, and is strengthened — W1 and W0 make "generic review helps" *measurable* rather than merely disclaimed |
| Arm A — plain generation baseline | **W0** | Maps |
| Arm B+R — prose plus review | **W1** and **W2** | Maps as a *split*; v0.5 gains resolution v0.2 did not have |
| Arm B — content-matched prose guidance at generation | the universal base package (§12) | Becomes the condition all arms share, not an arm |
| Arm C — testable invariant representation at generation | **none** | **Does not map** — see §6.3 |
| Arm D — invariant representation plus verification | **W3**, shorn of the representation difference | Partial — see §6.3 |

## 6. What no longer maps

This is the load-bearing half of the reconciliation. A mapping in which everything maps cleanly
would be concealing a mismatch.

### 6.1 The construct under test is not the same construct

§38's concession is about "the tested invariant architecture" and "invariant systems … beyond
ordinary context provision, prompt engineering, and generic review." **v0.5 does not test that.**
v0.5 §1 says so explicitly: it "does not test the universal value of 'invariants,' Constitutional
Computing as a whole, or any claim about human cognition", and §7.3 requires every confirmatory
headline to name the **Condition-Directed Gated Verification Workflow**. v0.5 §7.2 further forbids
claiming that structural invariants are universally superior.

**Consequence, and it cuts against the programme's interest:** a double-null in v0.5 does **not**
by itself discharge §38 condition 2 as §38 meant it. It establishes a null for the workflow
construct. Treating that as a null for "invariant architecture" would overclaim a *negative* result
exactly as §38's own sub-findings clause forbids overclaiming a positive one. SR-2 is bidirectional
for this reason.

Conversely — and this is the risk worth naming — a *positive* v0.5 result does not discharge the
invariant-architecture claim either. It supports a workflow.

### 6.2 Condition 3 has no experiment anywhere in the programme

§38's third condition concerns "future repeated-task research … cumulative reuse or amortization
advantage." **Nothing in v0.5 measures reuse across tasks.** The experimental unit is a single
`model × task × workflow-arm execution` (§10); there is no repeated-task arm, no amortization
measure, and no cross-task accumulation anywhere in Parts IV–VI. Nor is such an experiment
registered elsewhere in the programme: EXP-P1 is compression, EXP-P3 is representation, EXP-P4 is
reserved and undesigned.

Under SR-5 this condition is **untested**, and it blocks any concession claim that depends on it.
It cannot be quietly dropped from the conjunction, and it should not be assumed to fall to EXP-P4 —
P4's reserved question is interaction, not reuse.

### 6.3 v0.2's representation contrast has no v0.5 counterpart, by construction

v0.2's headline manipulation was **representational**: Arm C supplied "testable invariant
representation" where Arm B supplied content-matched prose, and §14 states that "C versus B tests
representation-at-generation under content-matched conditions."

v0.5 forbids that manipulation outright. Principle I makes process the manipulated variable;
Principle II requires identical task materials in the same representation; FW.1 and FW.2 confine
differences to the workflow ladder; §2 assigns representational substrate to **EXP-P3**.

So v0.2 Arm C maps to nothing in v0.5, and Arm D maps only partially: v0.2's D-versus-B+R confounded
representation with verification, whereas v0.5's W3-versus-W2 holds representation constant and
varies workflow alone. **v0.5's primary contrast is narrower and cleaner than v0.2's, and answers a
different question.** Any inference that carries a v0.2-era expectation about D-versus-B+R onto
W3-versus-W2 is invalid.

### 6.4 §38 assumed one experiment per question

§38 says "P2 demonstrates no reduction", with P2 a single experiment over a single substrate. v0.5's
P2 is a family with two independently confirmatory domains, so "P2 demonstrates" is ambiguous
between "both domains null" and "the aggregate is null". §38 supplies no rule; v0.5 §41 does. SR-3
exists to close that gap, and it is an addition to §38, not a recovery of it.

### 6.5 What is NOT claimed here

The absent **v0.3 binding** is not reconstructed, inferred, or worked around. Whatever v0.3 did to
bind §38 is unknown, and this reconciliation proceeds from §38's text alone. If v0.3 is later
recovered and its binding differs from SR-1…SR-5, this document is wrong and must be revised — that
possibility is why it is `proposed`.

## 7. What ratification requires

1. Ratify SR-0…SR-5 as v0.5's programme stopping-rule linkage, or return them for revision.
2. Rule on §6.2: either register a repeated-task/amortization experiment, or amend SR-1 to drop the
   condition deliberately and on the record. Leaving it untested is a valid third choice, but it
   must be chosen rather than defaulted into.
3. Rule on §6.1: confirm that v0.5's construct is narrower than §38's, and that the programme-level
   invariant-architecture claim therefore has no experiment currently registered against it.
4. On ratification, Appendix C item 19 may be marked resolved and v0.5 §45's deferral discharged.

Until then, `proposed`.
