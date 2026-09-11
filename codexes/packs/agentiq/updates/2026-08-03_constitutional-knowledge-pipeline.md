# The Constitutional Knowledge Pipeline — one principle, projected; not a hundred rules, accumulated

**Status:** shipped, 2026-08-03. Extends `2026-08-03_resolution-to-invariant-loop.md`. Records one
**operator ratification**, the **Constitutional Execution Family**, the collapse of the UX candidates
into projections, and the Exploration Workspace.

---

## 0. What the operator ratified

> **"Constitutional computing shall reduce Time to Value while keeping Time to Repair within
> constitutional bounds. A reduction in Time to Repair must not be achieved through a material
> increase in Time to Value, and a reduction in Time to Value must not create an unacceptable
> increase in Time to Repair. Constitutional safeguards constrain unsafe acts while accelerating
> constitutionally safe work."**

Recorded as `CI-2026-08-03-TTV-TTR-OBJECTIVE-001` at status **`ratified`**, with the operator's act
quoted verbatim in `ratifiedSource` (*"Yes — that was an explicit operator ratification, not merely a
proposal."*). This is the **only** record in the registry above `validated`, and it is there because
the operator ratified it in their own words — the validator refuses `ratified` without a named act,
which is exactly what that field is for.

**Full classification, as the operator specified it:** Family — constitutional invariant. Domain —
constitutional computing. Ratifying authority — operator. Operational mechanism — operator agency,
cognitive-load reduction, exception isolation, prepared recommendations, and absorption of
non-governance execution complexity. Measurement — PoTS / Time to Value, with Time to Repair and
risk-repair scope. **Scientific status — a GOVERNING CONSTITUTIONAL PRINCIPLE, not a claimed
structural or scientific invariant.** That last line is recorded explicitly on the record: it is
doctrine about how the platform is governed, not an empirical claim about the world.

### The correction the registry caught on itself

An intermediate summary of the ruling framed it as the one-sided `Minimize(TTV) subject to TTR
within constitutional bounds`, and that framing reached an earlier version of this record. The
operator corrected it:

> *"That captures only one direction. Your ruling is explicitly bidirectional: neither TTV nor TTR
> may be improved by materially degrading the other. The canonical record should preserve that
> balance."*

The canonical bidirectional wording is now the statement, the correction is recorded in the record's
own notes, and **a canary pins both halves** so the asymmetric form cannot creep back. A summary
drifting from a ruling, caught only because the ruling was written down verbatim, is this loop
working on itself.

A second, more compact rendering also arrived in-session (*"…shall minimize Time to Value while
maintaining Time to Repair within constitutional bounds. Improvements in one shall not be achieved
through material degradation of the other…"*). It says the same thing; the fuller text is kept
because it names both directions explicitly, which is the property the correction was *for*. The
discrepancy is recorded, not silently resolved — a one-line change if the operator prefers the
compact form.

---

## 1. PoTS was already here — the biggest reuse finding

The mandatory preflight found that the operator's principle is **already the platform's own
structure**, in ratified commentary and in shipped code:

| Where | What it says |
|---|---|
| `services/polity/frameworks/polity-papers-commentary.v1.json` | *"(1) PUBLIC MENTAL MODEL = **Time-to-Value**; (2) INTERNAL METRIC = **Proof of Time Saved, PoTS**; (3) CONSTITUTIONAL PRINCIPLE = **Net Value Acceleration = Time-to-Value minus Risk Repair Burden**"* |
| `services/venture/ventureOutcomeAccrual.ts` | `netValueAccelerationHours(claim) = max(0, timeSavedHours − riskRepairHours)` |
| `types/ventureQube.ts` | `ProofOfOutcomeClaim` — `timeSavedHours`, `riskRepairHours`, verification-gated |

So the ratification makes binding at **design time** the objective the platform already measures at
**outcome time**. PoTS becomes a first-class design objective, as the operator intends, **without a
second definition** — the record points at these three sources and a canary resolves them on disk.
Writing a fresh definition of Net Value Acceleration would have been the money-critical class of
duplicate.

---

## 2. UX is a projection, not a family — the structural correction

The operator removed the family this session had just built:

> *"I think this is converging into something stronger than an 'Agency' family. What you've actually
> been discovering across these six occurrences is a constitutional execution principle that explains
> WHY the UX invariants exist."*
>
> *"Don't create 'UX invariants' as a separate canonical family. Instead say: these constitutional
> execution principles PROJECT into UX."*

### The families now

| Family | Protects | Members |
|---|---|---|
| `engineering` | software correctness | 11 — actor/subject/owner, canonical contract over inferred prose, canaries reproduce defects, diagnostic disclosure… |
| `constitutional` | governance | 10 — incl. the ratified Constitutional Time Principle |
| `execution` | **why the interface rules exist** | 6 live principles + 8 collapsed tombstones |

There is **no `agency` and no `ux` family**, and a canary fails the build if one reappears. UX is
reachable only as the projection target `ux-framework`.

### The six Constitutional Execution Principles

Pinned as data in `types/resolutionRecords.ts`, each with the operator's own wording, so the family
cannot silently gain a seventh member:

| # | Principle | Record | Canaries |
|---|---|---|---|
| 1 | **Exception Isolation** | `CI-…-CONTROL-CONSTRAINS-RECORD-001` | 2 |
| 2 | **Exception Terminates in an Act** | `CI-…-EXCEPTION-TERMINATES-IN-ACT-001` | 4 |
| 3 | **Execution Constraint Absorption** | `CI-…-EXECUTION-CONSTRAINT-ABSORPTION-001` | 0 — **pending** |
| 4 | **Cognitive Load Minimization** | `CI-…-UX-MINIMIZE-CONSTITUTIONAL-COGNITIVE-LOAD-001` | 0 — pending |
| 5 | **Recommendation Before Interrogation** | `CI-…-UX-RECOMMENDATION-PREPARED-IN-ADVANCE-001` | 0 — pending |
| 6 | **Prepared Execution** | `CI-…-PREPARED-EXECUTION-001` | 0 — pending |

Five are **existing records re-parented**; only Prepared Execution is new, because no prior record
covered it. Every one stays at `candidate` — **ratification does not cascade** (§4).

---

## 3. What the collapse cost — reported, not quietly dropped

The operator asked to be told. Eight records were collapsed into tombstones (`status: deprecated`,
`supersededBy` naming the absorber, occurrences preserved). A canary requires every one to record
what the collapse costs, and refuses a deprecated rule that names no successor.

| Collapsed | Into | Cost |
|---|---|---|
| `UX-MAXIMIZE-SAFE-PROGRESS` | Exception Isolation | none — same rule from the safeguard's side |
| `UX-OPTIMIZE-COMPLETION-NOT-OBSTRUCTION` | Exception Isolation | one emphasis — *"the objective is not to detect every anomaly"* — carried into the parent's notes |
| `UX-SMALLEST-SAFE-ACT` | Exception Terminates in an Act | none — principle 2's own wording already contains "the smallest executable constitutional action" |
| `UX-CONSTITUTIONAL-LOAD-STANDARD` | Cognitive Load Minimization | none — standard-form restatement |
| `UX-ONE-DECISION-ONE-PLACE` | Cognitive Load Minimization | the concrete prohibitions, kept verbatim as the parent's UX projection |
| `UX-NAVIGATION-IS-NEVER-GOVERNANCE` | Cognitive Load Minimization | **⚠ FLAGGED** — see below |
| `UX-NEVER-MAKE-OPERATOR-SEARCH` | Recommendation Before Interrogation | none structural; literal prohibitions kept as the parent's projection |
| `AGENCY-INVARIANT-I` | the Time Principle | **⚠ FLAGGED** — see below |

### Two flagged for the operator

1. **`UX-NAVIGATION-IS-NEVER-GOVERNANCE`** — *"Moving through screens is not governance. Only
   constitutional decisions are governance."* This draws a line between two **kinds of act**, where
   Cognitive Load Minimization only says to reduce one of them. It is kept as that principle's
   sharpest UX projection, but **if the operator judges it a seventh execution principle rather than a
   projection, it should be restored as its own record.** This is the one collapse most worth
   re-reading.

2. **`AGENCY-INVARIANT-I`** — the head of the family the operator removed. Its content is the Time
   Principle's own third sentence plus Exception Isolation, so it was absorbed there. **Its five
   recorded occurrence sites moved onto the Time Principle** and are the evidence that produced the
   Execution family. Deprecating a record whose text the operator authored is deliberately reversible:
   the tombstone keeps the statement, the occurrences and the trail.

---

## 4. Ratification does not cascade

> *"The child UX and engineering constructs need not all be independently ratified merely because the
> parent is ratified. They may remain candidate or validated implementation invariants until their own
> evidence and enforcement points justify promotion."*

**The schema expresses this, and a canary proves it can**: the parent validates at `ratified`, a child
validates at `candidate`, and a second canary asserts that **no child of the ratified principle is at
`ratified` or carries a `ratifiedSource`**. Nothing in the types, the validator or the report derives a
child's status from its parent's.

---

## 5. Execution Constraint Absorption — the sixth instance

The live surface refused a 33-source selection against a 25-source batch limit: *"Split the
selection."* The operator: *"technically honest but operationally poor. It has detected the
constraint. It has not solved the operator's problem."*

Recorded as `RES-2026-08-03-BATCH-LIMIT-PROJECTED-ONTO-OPERATOR-001` → execution principle 3.
**What must survive is recorded on the rule itself:** the refusal-not-truncation reasoning is
*correct* and is not weakened — a partially applied batch reporting success is still a defect. What
changes is that the **executor plans the segmentation** rather than handing the arithmetic back. And
the boundary is explicit: *"unless they materially affect constitutional governance"* — a limit that
changes what is admitted, receipted or disclosed is **not** absorbable.

Its enforcement point is **PENDING** (the Track 2 agent is making the executor absorb the batching),
recorded with zero canaries — the same honest state as `FREEZE-POPULATION-DISCLOSURE`, surfaced by
the milestone check rather than hidden.

**The six sites the operator enumerated** are now recorded as occurrences on the Time Principle:
duplicate review · exception review · stage progression · batch limit · diagnosable refusals. The
sixth — *"missing ceremony receipt: don't make me open SQL"* — is **named but NOT recorded as an
occurrence**, because no resolution record covers it and the No-Guessing rule forbids inventing its
evidence. This converts the family's `cross-capability` scope from an asserted generality into one
**evidenced across five subsystems**. Reported, not ratified.

---

## 6. Projections — the mechanism that replaces duplication

`projections` is now load-bearing: `{ targets, researchRequired, ratificationRequired, track }` on
every record. Seven targets, **each verified to exist before being named**:
`constitutional-computing` · `devon` · `irl` · `ux-framework` · `venture-methodology` ·
`research-registry` · `invariant-corpus`.

`invariant-corpus` is **gated**: a candidate below `ratified` that declares it is refused — the canon
is not a destination a rule may claim for itself.

**Mapping onto surfaces that already exist** (searched first, per instruction): Policy Canon →
`codexes/packs/polity-core/` + the seed crystal; Research Lab → `services/research/registryStore.ts`
(CFS-051); Development Framework → `services/devCommandCenter/`; Runtime/UX → `ux-framework`. No rival
was minted.

---

## 7. The Exploration Workspace

Seven items, with their own disposition vocabulary (`open` · `promoted-to-candidate` ·
`routed-to-research` · `abandoned`) and **deliberately no place on the invariant ladder** — *"not
every insight is an invariant"*. Every item must say what it **would require** to become real; an
abandoned one must say why.

Two already promoted (the TTV objective; the execution-principle class), five open — including the
**Constitutional Computing Commons**, recorded as a direction and **deliberately NOT built**. Its
`wouldRequire` names the decisive prior finding: `services/invariants/graph.ts` already implements
twelve canonical edge types with acyclicity enforcement, so the honest first question is not "build a
graph" but "what is missing from the one we have?"

---

## 8. Two duplicates found and fixed inside the registry itself

1. **`CI-…-EXCEPTION-TERMINATES-IN-ACT-001` vs `CI-…-UX-EXCEPTION-TERMINATES-IN-ACT-001`** — the same
   rule under two ids; only one had canaries. Merged into the canaried record, occurrence folded in,
   retired id preserved in its notes. `findDuplicateStatements` now blocks a milestone on any repeat.
2. **The research register overlap** — `types/researchRegistry.ts` + `services/research/registryStore.ts`
   already hold `research_candidate_principles` / `_invariants` / `_backlog_items`, live behind an API
   route and a codex tab. **No rival was created**; structural-track work projects onto it via the
   `research-registry` target. Whether the two should merge is recorded as an exploration item for the
   operator, not decided here.

---

## 9. Verification

**Eight mutations, each caught by exactly one canary** (OS-9), then restored:

| # | Mutation | Canary |
|---|---|---|
| 1 | remove the cross-family parent guard | *a governing principle may parent across families* |
| 2 | let any status be designated governing | *only a ratified principle may be designated governing* |
| 3 | drop the deprecated→successor requirement | *a deprecated rule with no successor is REFUSED* |
| 4 | refile an execution principle as `engineering` | *all six are family `execution`* |
| 5 | remove a collapse's cost statement | *every collapse states WHAT IT COSTS* |
| 6 | delete the bidirectional clause from the ratified statement | *ratified on a NAMED OPERATOR ACT, quoted verbatim* |
| 7 | promote a child to `ratified` | *a ratified parent does not promote its children* |
| 8 | re-add `agency` to the families | *there is NO agency/ux family* |

- `tests/resolution-records.test.ts` — **60 passed** (was 25).
- `npm run type-check:research` — **10 errors, the same 10 pre-existing.** Zero new.
- `npm run report:resolutions` — 11 resolutions · 35 candidates · 40 canaries · families and rule
  trees derived, not hand-maintained.

---

## 10. Files

| File | Change |
|---|---|
| `types/resolutionRecords.ts` | families → engineering/constitutional/execution; `governingPrinciple`; `supersededBy`; `projections`; the six execution principles as data; close-out checklist + ritual; TTV/TTR sources and dimensions; `ExplorationItem` |
| `services/invariants/resolutionRecords.ts` | projection validation + canon gate; family/parent integrity; duplicate-statement detection; exploration validation; family, rule-tree, projection and exploration reporting |
| `codexes/packs/agentiq/resolution-records/` | migrated to v2.0; +2 resolutions; +2 principles; 8 collapsed to tombstones; **+`exploration/`** (7 items) |
| `tests/resolution-records.test.ts` | 25 → 60 canaries |
| `scripts/resolution-records-report.ts` | families, the execution family, rule trees, exploration, pending projections, the close-out checklist |
| `CLAUDE.md` | the mandatory sentence + the Constitutional Time Principle, inside the existing loop section |
