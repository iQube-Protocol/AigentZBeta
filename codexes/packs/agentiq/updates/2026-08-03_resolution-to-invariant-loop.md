# The resolution → invariant loop — converting repairs into reusable development knowledge

**Status:** shipped, 2026-08-03. Operator-specified process mechanism. Seeded with the Horizen Pilot
and EXP-P1 / Crystal-prep resolution sets, plus the six candidate invariants the operator named for
this release.

---

## 0. The operating principle

> **"A resolved problem is not complete until the resolution has been converted into reusable
> development knowledge."** — operator, 2026-08-03

Closing a ticket or merging a fix records **what** changed. It does not preserve: why the defect
happened; which earlier assumption proved false; what evidence identified the root cause; which
tempting fixes were rejected; what rule should prevent recurrence; what canary would detect
regression; whether the lesson applies locally or across the estate.

> *"That is the information agents repeatedly lose."*

The loop closes it:

```
Build → observe consequence → diagnose → repair → verify
      → COMPRESS THE RESOLUTION → PROTECT IT WITH A CANARY
      → reuse it → validate the invariant → build again with lower risk of repair
```

This is not merely documentation. It is consequence-aware software development.

---

## 1. Cadence — milestone-triggered, never commit-triggered

The operator was explicit: **"Do not do this on every push."** Ten triggers, pinned as
`RESOLUTION_TRIGGERS` in `types/resolutionRecords.ts`; every record names the one that fired.

| # | Trigger | Constant |
|---|---|---|
| 1 | A problem required multiple repair cycles | `multi-cycle-repair` |
| 2 | A supposedly resolved defect reappeared | `defect-recurred` |
| 3 | A test or canary encoded the defect instead of detecting it | `canary-encoded-the-defect` |
| 4 | Two subsystems disagreed about the same canonical state | `subsystems-disagreed` |
| 5 | A local anomaly blocked an unaffected batch | `local-anomaly-blocked-batch` |
| 6 | A governance boundary was confused with a software condition | `governance-boundary-confused` |
| 7 | A successful implementation established a reusable pattern | `reusable-pattern-established` |
| 8 | A milestone became demonstrably complete | `milestone-complete` |
| 9 | A workaround was replaced by the canonical implementation | `workaround-replaced` |
| 10 | A failure revealed an existing invariant was incomplete or misscoped | `invariant-incomplete-or-misscoped` |

There is **no per-commit trigger in the vocabulary**, and a canary pins that absence so one cannot be
added by drift.

---

## 2. What was built, and what was deliberately NOT built

The operator's constraint: *"Do not build a large new subsystem during these two critical paths."*

| File | Role | Size |
|---|---|---|
| `types/resolutionRecords.ts` | Schema, the ten triggers, the scope vocabulary, ladder helpers. Pure. | ~380 lines |
| `services/invariants/resolutionRecords.ts` | Validators, referential integrity, the milestone-close check, the report. One impure export (`loadRegistry`). | ~380 lines |
| `codexes/packs/agentiq/resolution-records/` | The registry: 7 resolution records + 17 candidate invariants, one JSON per record | data |
| `scripts/resolution-records-report.ts` | `npm run report:resolutions` — the dashboard | ~85 lines |
| `tests/resolution-records.test.ts` | 25 canaries | — |

**Deliberately NOT built:** no database table, no migration, no API route, no UI surface, no new
`ActivityActionType`, no DVN receipt type, no codex tab. The registry is repo files read by tooling.
If it later needs a surface, it gets one deliberately — building it now would be the exact
"workflow surface ahead of its data" defect that
`2026-08-02_track2-stage-gated-development-cadence.md` ratified against.

---

## 3. What was REUSED rather than duplicated (`inv.engineering.036` / `037`)

This is the part that mattered most. The repo already had almost every piece.

| Needed | Existing machinery | What was NOT built |
|---|---|---|
| The lifecycle ladder | `COMPLETION_LIFECYCLE` (CCR-001 §9, `types/capabilityCompletion.ts`): `observed → candidate → validated → ratified → canonical → deprecated`, ORDER IS SEMANTIC | A third status vocabulary. `ResolutionRecord.status` and `CandidateInvariant.status` ARE `CompletionStage`. |
| Projection onto the invariant corpus | `mapCompletionStage` → `proposed \| validated \| canonical` | A second mapping. A canary pins that the projection still holds. |
| The rule/defect/canary triple | `ReproductionInvariant` (`{statement, provenance, defect, canaries, status}`) | A parallel structured invariant type. A ratified candidate GRADUATES into a `ReproductionInvariant` inside a Capability Completion Artifact and into the seed crystal — this registry does not become a second canon. |
| "Cross-capability" as an earned claim | CCR-001 §8's `cross-capability-recurrence` provenance kind | A second meaning for the same word. |
| Non-ratification discipline | CLAUDE.md's hypothesis-vs-canon rule, and the seed crystal's `proposed` status | A new governance concept. |
| Canary-path-resolves-on-disk | `CAN-CCR-5`'s discipline in `tests/capability-completion.test.ts` | A second disk resolver — the idiom is copied, the concern is not. |
| Parity-canary registration | `tests/source-of-truth-parity.test.ts`'s index | A parallel index. This loop is cross-referenced there. |
| Home for invariant logic | `services/invariants/` (already holds `lifecycle.ts`, `store.ts`, the IRE) | A new top-level service directory. |

**The operator's seven-rung ladder maps onto the six-rung `COMPLETION_LIFECYCLE` without inventing a
vocabulary** — the repo's own `map, don't unify` ruling (operator, 2026-07-27), already canaried in
`tests/capability-completion.test.ts`:

| Operator's rung | Represented as |
|---|---|
| Resolution observed | status `observed` |
| Candidate lesson | status `observed`, no candidate invariant yet |
| Candidate invariant | status `candidate` + a `CI-…` record |
| **Applied in another implementation** | **`occurrences.length > 1` — DATA, not a self-declared word** |
| Validated by reuse or regression prevention | status `validated` |
| Ratified operational invariant | status `ratified` + `ratifiedSource` |
| Included in capability and agent context | status `canonical` |

Modelling "applied elsewhere" as **evidence** rather than a status label is the operator's own guard
made enforceable: a rung an agent can simply assert is not a rung. `validated` requires ≥2 recorded
occurrences, each naming a distinct site with its own evidence — so one anecdote cannot inflate
itself into a pattern.

---

## 4. Where the registry lives, and why

```
codexes/packs/agentiq/resolution-records/
  records/               RES-YYYY-MM-DD-<SLUG>-NNN.json
  candidate-invariants/  CI-YYYY-MM-DD-<SLUG>-NNN.json
```

**Why the AgentiQ pack, not the repo root.** CLAUDE.md already makes `codexes/packs/agentiq/` the
single home for what changed on this platform and why; these records are derived from
`agentiq/updates/` and sit beside them. It is **not** registered in `collections.json` — these are
governed data records read by tooling, not markdown for the Updates tab. `packRegistry.ts` only
reads `collections.json`, so the directory adds no cartridge.

**Why one JSON per record.** Multiple Claude sessions run concurrently on this repo (CLAUDE.md
Multi-Agent Coordination). A single registry file would be a contested file on every session that
captures a lesson; one file per record makes concurrent capture merge-free.

**Why candidate invariants are their own records referenced by id.** One rule with three incidents
must be **one candidate with three occurrences**, not three near-duplicate prose strings in three
resolution records. That is `inv.engineering.036` applied to captured knowledge, and a canary
enforces that `candidateInvariants[]` holds ids, never prose.

---

## 5. The three required outputs, enforced

> *"Without the canary, the invariant is advisory prose. Without the invariant, the canary is an
> isolated test whose purpose will eventually be forgotten."*

`runMilestoneCloseCheck` refuses to report clear while any of the three is missing where the ladder
requires it:

| Condition | Severity |
|---|---|
| A resolution at `candidate`+ with no candidate invariant | **blocker** |
| A recurrence-class trigger (multi-cycle / recurred / canary-encoded) with nothing executable protecting it | **blocker** |
| A candidate at `validated`+ with no canary | **blocker** |
| A candidate at `validated`+ on a single occurrence | **blocker** |
| A candidate at `ratified`+ with no `ratifiedSource` | **refused by the validator** |
| A candidate at `candidate` with no canary | warning — *"advisory prose; its enforcement point is pending"* |
| A `cross-capability` claim from fewer than two sites | warning |
| A canary not verified to fail before the fix (OS-9) | warning |
| Update docs newer than the newest record that no record cites | **question**, with the computed list |

The "uncaptured" question is **not inert** (MS-7 / OS-9): with nothing to ask about it is not asked
at all, and when it is asked it names the specific docs. It is a question, not a blocker — it needs a
human answer, not a build failure.

---

## 6. The seeded sets

### 6a. Horizen Pilot — 4 resolution records

| Record | Trigger | Covers |
|---|---|---|
| `RES-2026-08-02-AGENT-REGISTRATION-001` (the operator's worked example) | `multi-cycle-repair` | actor persona vs registered-agent subject; legacy receipt compatibility; the test that defended the defect |
| `RES-2026-08-02-HORIZEN-AGENTID-RECOVERY-001` | `workaround-replaced` | no wallet substitution for an agent identifier; chain state as recovery evidence |
| `RES-2026-08-03-HORIZEN-OBSERVER-RECONCILIATION-001` | `subsystems-disagreed` | canonical receipt-reader ownership; one screen, one answer |
| `RES-2026-08-03-DIAGNOSABLE-REFUSALS-001` | `canary-encoded-the-defect` | a refusal that names what was observed; the stale Bitcent label a green canary was defending |

The observer-state doc (`2026-08-03_observer-state-invariants.md`, OS-1..OS-9) is **cited, not
duplicated** — a canary asserts it is referenced by at least one record so OS-1..OS-9 stay in one
place.

### 6b. EXP-P1 / Crystal prep — 3 resolution records

| Record | Trigger | Covers |
|---|---|---|
| `RES-2026-08-03-TRACK2-EXCEPTION-ISOLATION-001` | `local-anomaly-blocked-batch` | local exceptions must not immobilize the unaffected cohort; warnings are not refusals; readiness evaluates the assigned crystal; unresolved records stay visible; partial progress is receipted; no silent population shrink |
| `RES-2026-08-02-EXP-P1-CRYSTAL-CONSTITUTION-001` | `governance-boundary-confused` | domain boundary / corpus membership / freeze as distinct acts; reviewer evidence does not ratify or freeze |
| `RES-2026-08-03-TRACK2-STAGE-CADENCE-001` | `reusable-pattern-established` | the operator path must exist in the frontend before a programme is called executable |

### 6c. The six candidate invariants the operator named for this release

Recorded **now, as candidates with their canaries, without pausing delivery and without premature
ratification** — the operator's instruction verbatim.

| Candidate | Occ. | Canary |
|---|---|---|
| `CI-…-SCHEMA-ENRICHMENT-RECOVERY-001` — *Schema enrichment must preserve recovery for historical receipts.* | 1 | `tests/horizen-agent-registration-binding.test.ts` — legacy receipts resolve through chain decoding |
| `CI-…-ACTOR-SUBJECT-OWNER-001` — *Actor, subject and owner are distinct references and must never be silently substituted.* | **3** | *"queries on the runtime agent id and never looks up a persona row"* — asserts `personas` is not touched at all |
| `CI-…-ADMISSION-CIRCULAR-PREREQUISITE-001` — *Admission confidence must not depend on evidence produced only after admission.* | 1 | `tests/corpus-scout-admission-recommendation.test.ts` — `domainConfidence` / `confidence` decoupled |
| `CI-…-CANARY-REPRODUCES-DEFECT-001` — *A canary must reproduce the historical defect before it is accepted as protection.* (OS-9) | **4** | binding-resolver fixtures from production + `tests/resolution-records.test.ts` |
| `CI-…-CONTROL-CONSTRAINS-RECORD-001` — *Constitutional control constrains the unsafe record, not the safe remainder.* | 1 | `tests/exception-isolation.test.ts` — the 33→29 headline acceptance test |
| `CI-…-FREEZE-POPULATION-DISCLOSURE-001` — *A frozen artifact must disclose both what it contains and what was excluded from the population used to construct it.* | 1 | **NONE — enforcement point PENDING** |

**Two wording notes carried in the records, not silently normalised:**

1. **`CONTROL-CONSTRAINS-RECORD`** — the operator's earlier phrasing was *"constrains the unsafe
   **ACT**"*; the latest is *"the unsafe **RECORD**"*, which is more precise about scope. The
   statement carries the operator's sentence as last given; the earlier phrasing survives verbatim in
   `2026-08-03_track2-exception-isolation.md` §0 and in `services/research/exceptionIsolation.ts`.
   The classification stays **CONSTITUTIONAL-OPERATIONAL, governing workflow orchestration — NOT a
   ratified structural or scientific claim**, exactly as the operator set it.

2. **`FREEZE-POPULATION-DISCLOSURE`** is recorded with **zero canaries, deliberately.** The
   freeze-package schema amendment (population counts, `assignedCohortHash`, `excludedRecordsHash`,
   limitations) is authorized and being built in parallel by the Track 2 agent. Until it lands, this
   candidate appears in the milestone-close output as *"has no canary — an invariant without a canary
   is advisory prose; its enforcement point is pending."* That is the live, honest example of the gap
   the check exists to surface, and the canary suite deliberately does **not** fail on it.

### 6d. Eleven further candidates

Derived from the remaining bullets in both sets: identifier-recovery contract, chain as independent
evidence, canonical reader ownership, warning-is-not-refusal, readiness scoped to the object,
governed acts distinct, review evidence ≠ ratification, exclusion visible not discarded, partial
progress receipted, no silent population shrink, operator path before executable. All at `candidate`.

---

## 7. Flagged for the operator — NOT decided here

1. **`CI-…-IDENTIFIER-RECOVERY-CONTRACT-001` may be the same shape as `CI-…-ACTOR-SUBJECT-OWNER-001`.**
   A wallet is the **owner** reference and was substituted for the **subject** reference — which is
   literally what the actor/subject/owner rule forbids. If they are one rule, this becomes a **fourth**
   occurrence of that candidate. The operator fixed that candidate's count at three, so it was not
   merged unilaterally.

2. **`CI-…-CANONICAL-READER-OWNERSHIP-001` overlaps `inv.engineering.036`**, which is already
   canonical. It is recorded as the READ-PATH specialisation. If the operator judges it fully covered,
   it should be **retired, not ratified** — a duplicate invariant is the defect 036 names.

3. **The two strongest candidates are `ACTOR-SUBJECT-OWNER` (3 occurrences, 3 subsystems, one day)
   and `CANARY-REPRODUCES-DEFECT` (4 occurrences).** On the operator's own reading, the ladder step
   *"applied in another implementation / validated by reuse or regression prevention"* is **already
   satisfied for both by the historical record**. Promotion to `validated` — and any move beyond it —
   is the operator's act, not an agent's. Nothing in the registry is above `candidate`.

4. **`ADMISSION-CIRCULAR-PREREQUISITE`, `CHAIN-AS-INDEPENDENT-EVIDENCE`, `CONTROL-CONSTRAINS-RECORD`
   and `SCHEMA-ENRICHMENT-RECOVERY` claim `cross-capability` scope from one recorded site each** and
   carry a standing warning saying so. The scope reflects the operator's own judgement about
   generality; the warning keeps the gap between claim and evidence visible.

---

## 8. Verification

### Canaries verified to FAIL before the change

Per **OS-9** (*"a canary must be written against real evidence, not against the assumptions of the
code it guards"*), each was checked by mutating the production code, running the suite, and
restoring. Every mutation was caught, each by exactly one canary:

| # | Mutation | Canary that caught it |
|---|---|---|
| 1 | Remove the `ratifiedSource` guard from `validateCandidateInvariant` | *a candidate self-promoted to `ratified` is REFUSED* |
| 2 | Single-occurrence check at `validated` demoted from blocker to warning | *a candidate at `validated` on a single occurrence is a BLOCKER* |
| 3 | `if (!protectedByAnyCanary)` → `if (false)` | *a recurrence-class resolution with nothing executable protecting it is a BLOCKER* |
| 4 | The uncaptured question emitted unconditionally | *the uncaptured question is asked with a COMPUTED answer set, never as a slogan* |
| 5 | Missing-candidate-invariant check demoted from blocker to warning | *a resolution at `candidate` with no compressed rule is a BLOCKER* |
| 6 | **Registry data:** point a real candidate's canary at a test file that does not exist | *no resolution record or candidate names a canary that is not there* |

Mutation 6 is over the registry rather than the code, because the registry IS this system's
production data — the same discipline that made the Horizen binding tests use Nakamoto's real receipt.

### Test results

- `tests/resolution-records.test.ts` — **25 passed** (new).
- `tests/source-of-truth-parity.test.ts` — **91 passed**, unchanged (header cross-reference only).
- `tests/capability-completion.test.ts` — **passed**, unchanged (the reused ladder is untouched).
- Horizen + Track 2 suites re-run to confirm nothing was disturbed: see §9.
- `npm run type-check:research` — **the same 10 pre-existing errors in the same 7 files.** Zero new.
  `services/invariants/**` and `types/**` are already inside `tsconfig.research.json`'s scope, so both
  new modules are covered by the gate rather than sitting outside it.

---

## 9. Using it

```bash
npm run report:resolutions
npm run report:resolutions -- --milestone="Horizen Pilot"
```

Prints open resolutions, candidate invariants, validated invariants, unresolved recurrence risks and
the milestone-close check. **Exits 1 on a blocker**, so it can gate a milestone without anyone having
to read it.

At milestone close:

1. Run the report. Resolve every **blocker**.
2. Answer the **question**: did any of the listed newer update docs describe a multi-cycle repair, a
   recurrence, or a canary that encoded its defect? If so it remains uncaptured — capture it.
3. Review the **warnings** — particularly any candidate whose enforcement point is still pending.
4. Decide, as operator, whether any candidate has earned `validated`, and whether any is ready for
   `ratified` with a named act.

---

## 10. Files

| File | Change |
|---|---|
| `types/resolutionRecords.ts` | **NEW** — schema, ten triggers, scope vocabulary, ladder helpers, report types |
| `services/invariants/resolutionRecords.ts` | **NEW** — validators, referential integrity, milestone-close check, report builder, the one loader |
| `codexes/packs/agentiq/resolution-records/records/*.json` | **NEW** — 7 resolution records |
| `codexes/packs/agentiq/resolution-records/candidate-invariants/*.json` | **NEW** — 17 candidate invariants |
| `scripts/resolution-records-report.ts` | **NEW** — the dashboard |
| `tests/resolution-records.test.ts` | **NEW** — 25 canaries |
| `package.json` | `report:resolutions` script |
| `tests/source-of-truth-parity.test.ts` | header index cross-reference (no new canary in that file) |
| `CLAUDE.md` | **"Resolution → Invariant Loop — MANDATORY PRACTICE for every agent (PARAMOUNT)"** — see §11 |

---

## 11. The CLAUDE.md section — binding, and why it sits where it does

The operator: *"the resolution record work once done should be referenced in the CLAUDE.md so it
becomes MANDATORY PRACTICE for any agent working on the AgentiQ stack."* It is therefore written in
the register of Push Commit Messages and the Identity Spine — "you MUST", not "consider" — and carries
enough on its own that an agent can tell whether the loop applies to what it just did **without
opening another file**: the ten triggers, the registry paths and id formats, the three required
outputs, the ladder, and the one prohibition (no self-ratification).

**Placement: immediately after "Core Principle: Extend, Don't Duplicate".** That section carries
`inv.engineering.036`/`037` and their parity-canary enforcement; this one is its knowledge-capture
half. 036 stops one **fact** having two homes; this stops a **lesson** having none — and both were
learned the same way, that *the doctrine was already right and the enforcement was missing*. Putting
them adjacent means an agent reading the duplication rule reads the capture rule in the same breath,
and neither reads as an afterthought at the foot of the file.

Two live proofs are cited in the binding text rather than left to this doc, because a rule that
cannot show its cost gets skipped:

- **OS-6 recurring three times in one session** — binding resolver, Claim's surface, journey `/state`
  route (`4c5859882`, `feeee0194`). The lesson from the first fix was not carried into the next piece
  of work. That is exactly what the loop prevents.
- **The dev-merge-message rule regressing repeatedly while it existed only as prose.** Reported by the
  operator as newly canaried in `tests/dev-merge-message-discipline.test.ts` (parallel work,
  2026-08-03).

> **Verification note, flagged rather than assumed:** that test file is **not present in this
> worktree and not on `claude/tokenqube-minting-integration-ms2yjd`** at the time of writing. It is
> named in CLAUDE.md prose as parallel work and is deliberately **NOT** recorded as a canary path in
> the resolution registry — an unverified path there would fail this loop's own
> "every claimed canary resolves on disk" check, which is the correct behaviour. If the file lands
> under a different name, update the CLAUDE.md reference.
