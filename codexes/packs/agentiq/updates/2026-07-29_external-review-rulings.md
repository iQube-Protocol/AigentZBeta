# External Independence Review — ratified rulings

**Ratified:** 2026-07-29 · **Applies to:** the EXP-P1 Crystal vP1 independence review
**Status:** binding on the queued Venice two-reviewer build, which must not start until the
adjudication workflow has landed its package schema, rubric and contested-row model.

---

## 1. What the review is

An **independence audit against the experiment** — not validation, not canonicalisation, not a
judgement of truth. The reviewer decides one thing:

> Is this invariant independent enough of EXP-P1's target, tasks and observed outcomes to be
> admitted into Crystal vP1?

EXP-P1's target is the **IRL invariant representation and retrieval/runtime pipeline**. MoneyPenny,
the Financial Services Runtime, Marketa, VL-CT-001 and CryptoSent are **not** the target; finance is
a test **domain**, so finance material is suspect only when target- or task-contaminated.

---

## 2. Private evidence — two-tier rule

A trusted **local** reviewer may inspect private source material and emit a signed, minimally
sufficient evidence summary for the external reviewers.

> **Do not automatically classify every private-source row `unknown`.** That would collapse the
> eligible population needlessly and privilege publicly shareable evidence over valid confidential
> evidence.

```ts
type PrivateEvidenceSummary = {
  invariantId: string;
  sourceCommitment: string;
  sourceClass: string;

  sourcePredatesTaskConstruction: boolean;
  sourcePredatesPilotOutcomes: boolean;

  derivedFromTargetSystem: boolean;
  derivedFromTaskOrExpectedAnswer: boolean;
  revisedAfterObservedOutcome: boolean;

  derivationMethod: string;
  factualBasis: string;

  localReviewerRef: string;
  reviewedAt: string;
  signatureOrReceiptRef: string;
};
```

**Must expose:** whether the source predates the experiment and tasks; whether it came from the IRL
pipeline, MoneyPenny, CryptoSent, task answers or observed outcomes; the derivation method; a
commitment to the underlying private source; attributable local sign-off.

**Must NOT expose:** raw private documents; persona or passport identifiers; proprietary task
answers; desired eligibility; desired population size; prior internal classification.

### The fail-closed boundary

```text
sufficient signed evidence summary   → Venice may adjudicate
insufficient / unverifiable /        → unknown
contradictory / unavailable          → ineligible for confirmatory freeze
```

> **A local summary is evidence, not authority.** Venice and Reviewer 2 remain free to classify the
> row `unknown` or contaminated regardless of what the summary asserts. The local reviewer supplies
> facts; it does not decide admissibility.

---

## 3. Reviewer independence — shared hosting yes, shared weights no

```text
reviewer1.provider    = Venice
reviewer2.provider    = Venice permitted
reviewer1.modelFamily ≠ reviewer2.modelFamily
reviewer1.modelId     ≠ reviewer2.modelId
```

The run **must refuse**: identical model IDs; aliases resolving to the same underlying model;
unknown model lineage; and any fallback that silently sends both reviews to the default model.

The frozen manifest records **both the requested and the resolved** model IDs — a resolved-ID
collision after alias expansion is the failure mode a requested-ID check alone cannot see.

*Rationale:* two instances of one model check nothing; a systematic bias in provenance judgement
appears in both and the second review confirms rather than tests. Shared hosting is an acceptable
correlate; shared weights are not.

---

## 4. Coverage — asymmetric by design

**Reviewer 1** — the complete frozen package: the Class C block decision, every D and I row, all
private evidence summaries, all proposed inclusions and exclusions.

**Reviewer 2** — every exclusion; every `domain-adjacent`; every `unknown`; **every private-source
row**; every row flagged by mechanical checks; and a stratified sample of ordinary `independent`
decisions.

Private-source rows get **mandatory** second review rather than sampling, because they reach the
external reviewer through an intermediary summary rather than the evidence itself.

---

## 5. Contested outcomes

```text
agreement on eligible classification → may proceed
disagreement                         → contested → excluded pending governed resolution
```

> **Never average** labels, confidence scores or textual rationales. A contested row is a fact about
> the evidence, and averaging destroys it.

The operator resolves the contested queue only — not the whole corpus.

---

## 6. What neither reviewer may do

No lifecycle change · no Standing grant · no canonical marking · no provenance edit · no crystal
freeze · no silent inference of missing evidence.

The freeze remains a **local governed act** after schema validation, evidence checks and operator
approval.

---

## 7. Reproducibility

Commit **before** the run: both reviewer model/provider IDs, prompt version, rubric version,
input-package hash, determinism settings. Commit **after**: raw adjudications, parsed relations,
output hashes, timestamps.

Reruns are versioned and justified. **Do not reprompt until a preferred population appears** — and
never tell a reviewer that a minimum population is wanted. The review returns the honest count.

---

## 8. Venture-substrate verification checklist

To be applied when the in-flight agent lands — **by direct diff, not by accepting its summary**:

1. `activityReceiptDvnPipeline.ts` changed **only** by adding approved anchorable action types.
2. No hashing, state-machine, principal-resolution or payload-shape behaviour changed.
3. The migration rebuilds its CHECK constraint **from the current canonical action-type union**,
   never a hand-copied historical list. *(This exact defect dropped 13 action types earlier in the
   session and was caught only by a parity canary.)*
4. V-10 lands **before** any venture outcome reaches Standing.
5. Liability creation and settlement remain **separate events**.
6. Correct refusal is represented as **completed service**, not failed execution.
7. No live wallet or token dependency has leaked into the simulation substrate.

Reject any state-machine, hashing, payload-shape or principal-resolution change without prior
approval.
