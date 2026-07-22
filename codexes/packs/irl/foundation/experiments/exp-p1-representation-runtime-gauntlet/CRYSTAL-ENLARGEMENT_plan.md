# EXP-P1 — Crystal vP1 Enlargement Plan (pre-freeze work item)

**metaMe IRL · EXP-P1 prerequisite · Status: PLANNED (tracked) · 2026-07-21**
**Governs:** the enlargement of `Crystal vP1` that must complete BEFORE EXP-P1 freeze.
**Constitutional frame:** IRL-016 (Experimental Freeze & Protocol Governance) §2/§5; EXP-P1 §3 (collection-size guard); `inv.reasoning.346–350`; the EXP-009 accrual discipline.

> This is the one piece of EXP-P1 that is genuine lab work, not a quick fix. It is
> charted here so it is tracked and cannot get lost, and so the sequence gate
> (IRL-016 §5) is explicit.

## 1. Objective

Grow the EXP-P1 constitutional-reasoning domain collection from its current **18
invariants** to a size **sufficient for the finalized 24-task set** (12 recall + 12
derivation), such that the fixed Arm C slice needed to ground the tasks is **≤ 40%
of `Crystal vP1`** (EXP-P1 §3) and Arm B's live selection retains discriminatory
power.

**The target size is NOT fixed a priori** (EXP-P1 §3 as corrected; `inv.reasoning.350`).
It is an implementation parameter that falls out of two constraints, resolved by the
originating team — never by the reviewer:
- the slice size the finalized task set actually requires to be groundable, and
- the ⊆40% subset guard.

(Illustratively only: at 18 invariants the guard caps the slice at 7 statements —
plainly too small to ground 24 tasks — so the collection must grow; how far follows
from the finalized tasks, not from a chosen figure.)

## 2. Method — receipted accrual, never bulk-authoring (condition a)

New invariants enter the constitutional-reasoning domain through the **normal
`proposed → validated` lifecycle with real receipted validation counts** (the EXP-009
accrual discipline). Sources, in order of preference:
1. **Discovery** — run the Invariant Discovery/Resolution path over the existing
   constitutional-reasoning corpus (the CFS/Polity reasoning material) to surface
   genuine candidate invariants, promoted `proposed` for validation.
2. **Validation** — each candidate accrues validation the honest way; Arm B's
   selection and any standing behaviour read `times_validated / standing`, so
   zero-validation filler would distort the arms asymmetrically and is forbidden.

**No invariant is authored to hit a number.** If genuine accrual cannot reach a size
that satisfies the guard at a meaningful task set, that is itself a finding about the
domain's density — reported, not papered over.

## 3. Composition requirements

- **In-domain (condition c).** Enlargement stays within the defined constitutional-
  reasoning domain (EXP-P1 §12 limitation). Cross-domain widening is a *successor*-
  experiment question, not a Phase-1 choice.
- **Derivation headroom (condition d).** The 12 derivation tasks need invariants
  whose **conjunctions entail unstated conclusions** — relational and conditional
  statements, not isolated atomic assertions — or the generative-sufficiency probe
  (P-IRL-3) has nothing to measure. Enlargement must deliberately add relational/
  conditional structure, not just more facts.

## 4. Sequence gate (IRL-016 §5 — sacred, condition b)

```
enlarge (receipted) → FREEZE Crystal vP1 → construct the fixed Arm C slice by the
standard domain procedure → hash the crystal snapshot AND the slice → THEN the
reviewer builds the 24 tasks → joint signature → run
```

Task construction MUST NOT precede the freeze. If it did, invariants would be
authored to fit the tasks and the affinity limitation (§12) would return through the
side door. The reviewer sees the **domain corpus boundary**, not the crystal
contents, when writing tasks (EXP-P1 §5.1). The reviewer's domain-agnostic task-
construction framework (schema, templates, answer-key format, judge rubric, sealing
procedure) can be built **in parallel now**, because it is domain-independent and
therefore sequence-safe.

## 5. Definition of done (unblocks EXP-P1 freeze)

- [ ] Constitutional-reasoning collection grown via receipted `proposed → validated`
      accrual to a size that satisfies EXP-P1 §3's ⊆40% guard for the finalized task set.
- [ ] Collection carries sufficient relational/conditional structure for the 12
      derivation tasks (condition d).
- [ ] `Crystal vP1` snapshotted + hash-committed (EXP-P1 §3.1).
- [ ] Fixed Arm C slice constructed by the standard domain procedure + hash-committed;
      slice fraction recorded in the pre-registration bundle (§10).
- [ ] Per-invariant validation counts recorded (no zero-validation filler).

Only after all five does the reviewer build tasks (§5 sequence). Until then EXP-P1
correctly presents as **`designed` / pre-freeze** (review-surface QA fix, 2026-07-21).

## 6. What this plan does NOT do

It does not set a crystal size, does not co-design with the task set, and does not
bulk-author invariants. Those would each violate a locked condition. The size, the
slice, and the tasks are produced in that order, by the right party, or the
experiment is contaminated.
