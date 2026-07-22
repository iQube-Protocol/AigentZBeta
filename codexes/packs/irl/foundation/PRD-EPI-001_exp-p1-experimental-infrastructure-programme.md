# PRD-EPI-001 — EXP-P1 Experimental Infrastructure & Readiness Programme

**metaMe IRL · Product/engineering specification · Status: DESIGN (docs-first, ratify-before-build)**
**Owner:** Invariant Research Lab (IRL) · **Origin:** operator + Aletheon design session, consolidated against Austin's-agent review, 2026-07-22
**Governs:** the infrastructure EXP-P1 needs to produce a result that is trustworthy in EITHER direction — not an experiment tuned to succeed.

> Scope note (operator instruction, this session): this PRD charters **Track 1 — Infrastructure**, with a bounded **Track 0 — Recursive Invariant Capture** (§13, added 2026-07-22, full practice chartered in `IRL-017`). Track 2 — crystal source-material expansion — is separately chartered in `CRYSTAL-ENLARGEMENT_plan.md` and is explicitly **PAUSED**: the operator is deferring the source-material work to a follow-up session. Nothing in this PRD should be read as authorizing crystal-content work; §9 states the one binding rule that carries forward now (internal risk materials excluded from the EXP-P1 corpus) and leaves the rest for that follow-up.

---

## 0. Read this first — reconciliation against what's already ratified

The source dialogue (Austin's-agent critique → Aletheon's methodology response → Aletheon's draft PRD) is excellent design thinking, but it was produced without visibility into three things this platform has **already ratified**. Building from the draft verbatim would silently fork existing canon. This section is the correction; §§1–8 are what to actually build.

1. **No new governance charter is needed.** Aletheon's closing recommendation — "author IRL-012: Experimental Governance & Freeze Protocol" — describes a document that already exists. `IRL-016 — Experimental Freeze & Protocol Governance` was ratified 2026-07-21 (earlier this session) and already defines: the six-stage lifecycle (`proposal → design → FREEZE → execution → interpretation → successor experiment`), what may/may not change at each stage, the reviewer-recommendation-vs-protocol-amendment distinction, and role separation between the originating team and the independent reviewer. **This PRD operationalizes IRL-016 for EXP-P1's sub-artifacts; it does not re-charter governance.** (IRL-012 the number is also already taken — `IRL-012_austin-feedback-integration.md` — which is exactly why the freeze/governance doc was issued as IRL-016 in the first place.)

2. **The Evaluation Configuration object model already exists — as a vision-chartered, partially-built spec.** `CFS-033 — Constitutional Evaluation: the Experimental Operating System` (chartered 2026-07-16, from an EARLIER Aletheon proposal) already names the exact object tree this new dialogue re-derived:

   ```
   Evaluation Configuration
   ├── Task                      (held-out task set + selection procedure)
   ├── Inputs                    (per-arm inputs, verbatim)
   ├── Grounding Slice           (hash-committed — BUILT: scripts/export-grounding-slice.mjs)
   ├── Runtime Configuration     (provider, model, temperature, token budgets)
   ├── Judge Configuration       (BUILT: scripts/evaluate-exp001.mjs --judge-config)
   ├── Adjudication Strategy     (judging ≠ adjudication — CFS-033 §4)
   ├── Success Metrics           (pre-registered thresholds + falsification criteria)
   ├── Receipt Schema            (what gets receipted, at which steps)
   └── Export Package            (Research Package — CFS-033 §3)
   ```

   CFS-033 §1 is explicit about what's built (2 of 9 components) and what's vision (`EvaluationConfiguration` type composition, Research Package exporter, multi-judge panel, adjudication layer, import/replay). **§§2–4 below are the build-out of this already-named tree, scoped to EXP-P1's concrete needs — not a parallel "Judge Infrastructure" invented under new names.**

3. **The experiment-level lifecycle is already ratified and canary-pinned — extend it, don't fork it.** `types/research.ts` already defines `EXPERIMENT_LIFECYCLE = ['designed', 'protocol-ratified', 'running', 'evaluated', 'published', 'replicated']` (CFS-019 §4, pinned by `tests/constitutional-contracts.test.ts`). Aletheon's draft PRD proposes a per-artifact lifecycle (`Draft → Validated → Frozen → Executed → Archived`) for the NEW sub-objects (Crystal, Arm, Task Set, Judge, …). These are two different altitudes and do not collide on vocabulary, but they must **compose**, not run in parallel unaware of each other: an experiment transitions `designed → protocol-ratified` only once every one of its constituent artifacts has reached `frozen`. §2 below names this composition explicitly and gives the new per-artifact states their own export (`ARTIFACT_LIFECYCLE`) so nothing forks `EXPERIMENT_LIFECYCLE`.

4. **EXP-P1's arms, crystal-freeze mechanism, and collection-size guard are already frozen at the protocol level — reuse the exact names.** `codexes/packs/irl/foundation/experiments/exp-p1-representation-runtime-gauntlet/README.md` already defines **Arm A (Cold) / Arm B (Full Runtime) / Arm C (Flattened Invariants) / Arm D (Expert Prose)**, the crystal snapshot + exporter mechanism, the Mechanistic Difference Enumeration (MDE), and the `⊆40%` collection-size guard with its four enlargement conditions (a–d). Use these names verbatim. Do not introduce "Baseline" for Arm A or re-derive the collection-size guard — it is already correctly stated, including the correction that the exact crystal size is an implementation parameter, not a number fixed a priori.

5. **Illustrative numbers stay illustrative.** Aletheon's methodology response repeatedly flags Austin's-agent numbers (60–90 invariants, 36–48 tasks, 3 repetitions) as "sensible design targets... not metaphysical requirements." That instinct is correct and is already the ratified position (`inv.reasoning.350`, IRL-016 §5, `CRYSTAL-ENLARGEMENT_plan.md` §1): a reviewer or advisor proposes a principle; the originating team derives the actual parameter from real constraints. Every number in this PRD is a **default to start a pilot from**, never a precondition to hit before the infrastructure is considered done.

6. **Operator's new scope decision (this session), binding from here forward:** internal/platform risk materials are **excluded from the EXP-P1 experimental corpus**. They continue to be used in-platform (the financial-services application, Agent MoneyPenny) but must never enter the crystal this experiment draws from — see §9.

7. **Aletheon's review (2026-07-22) caught three genuine sequencing contradictions in the first draft of this PRD**, all fixed below: (a) §2.2's original derivation would have made `protocol-ratified` unreachable because it included artifacts (`execution-run`, `research-package`) that cannot exist before execution; (b) §3's original single readiness gate placed task coverage inside the crystal's freeze condition, directly contradicting the already-ratified crystal-before-tasks sequence (IRL-016 §5, `CRYSTAL-ENLARGEMENT_plan.md` §4 — marked "sacred" there); (c) §5's original ordering allowed an answer key to seal before its task set was finalized, risking drift between a sealed key and a task set that later changes. This is exactly the kind of independent-review catch this programme exists to reward — see the amendment log at the end of this document.

---

## 1. Objective

Build the infrastructure that lets EXP-P1 (and every IRL confirmatory experiment after it) produce a result whose failure mode is legible: a null result must be attributable to a specific, pre-classified cause — substrate insufficiency, task invalidity, implementation failure, measurement failure, coverage failure, or a genuine scientific null — never to ambiguity about whether the experiment was well-built. This is infrastructure for trustworthy results in **either** direction, not infrastructure for a positive one.

## 2. The object model — extending CFS-033 + CFS-019, not forking either

### 2.1 New artifact types (fill CFS-033 §2's tree + the objects it doesn't name)

Everything below is additive to `types/research.ts`. None of it touches `ResearchExperiment`, `EXPERIMENT_REGISTRY`, or `EXPERIMENT_LIFECYCLE`.

```ts
// New export in types/research.ts — the per-ARTIFACT freeze lifecycle.
// Deliberately distinct vocabulary from EXPERIMENT_LIFECYCLE (which
// this composes with, per §2.2) so the two never collide on a status string.
export const ARTIFACT_LIFECYCLE = ['draft', 'validated', 'frozen', 'executed', 'archived'] as const;
export type ArtifactLifecycleState = (typeof ARTIFACT_LIFECYCLE)[number];

// WHEN in the experiment's life an artifact is expected to exist. Informational
// (drives §10's dashboard mapping) — the derivation in §2.2 filters by `kind`
// against PROTOCOL_FREEZE_ARTIFACT_KINDS below, not by `phase`, so there is one
// source of truth for the gate and `phase` never has to be kept in sync with it.
export type ArtifactPhase = 'protocol' | 'execution' | 'evaluation' | 'publication';

export interface FrozenArtifact {
  id: string;
  kind: 'crystal-version' | 'arm-config' | 'task-set' | 'answer-key' | 'judge-config'
      | 'analysis-config' | 'interpretation-table' | 'execution-run' | 'research-package';
  phase: ArtifactPhase;
  experimentId: string;         // FK to ResearchExperiment.id (e.g. 'EXP-P1')
  lifecycle: ArtifactLifecycleState;
  // Two distinct hash fields, not one (Aletheon review, 2026-07-22): a single
  // "contentHash set only at frozen" cannot describe an execution-run, whose
  // content only exists once the run has happened but which was never a
  // pre-registered commitment the way a protocol artifact's freeze is.
  contentHash: string | null;    // hash of current immutable content, whenever it exists
  commitmentHash: string | null; // the PROTOCOL commitment: set at freeze for protocol-
                                  // phase artifacts; set when the run closes for
                                  // execution-run; set to the export manifest hash for
                                  // research-package.
  frozenAt: string | null;
  signedBy: string[];           // T2 refs of signatories (IRL + reviewer, per IRL-016 §2)
}

// task-set and answer-key are mutually referential by design (§5): an answer
// key is meaningless detached from the exact task-set version it answers.
export interface AnswerKeyArtifact extends FrozenArtifact {
  kind: 'answer-key';
  taskSetId: string;
  taskSetContentHash: string;   // binds this key to one immutable task-set version
}

// The pre-execution protocol commitment — the ONLY kinds EXPERIMENT_LIFECYCLE's
// `protocol-ratified` transition depends on (§2.2). execution-run and
// research-package are deliberately EXCLUDED: they cannot exist, let alone
// freeze, before the experiment runs, so including them would make
// protocol-ratified permanently unreachable (Aletheon review, 2026-07-22).
export const PROTOCOL_FREEZE_ARTIFACT_KINDS = [
  'crystal-version',
  'arm-config',
  'task-set',
  'answer-key',
  'judge-config',
  'analysis-config',
  'interpretation-table',
] as const;
```

Mapped onto CFS-033 §2's tree:

| CFS-033 component | This PRD's artifact `kind` | Phase | Status |
|---|---|---|---|
| Grounding Slice | `crystal-version` (the frozen `Crystal vP1` snapshot — EXP-009 mechanism) | protocol | **built** |
| Inputs / Runtime Configuration | `arm-config` (per-arm A/B/C/D configuration) | protocol | new |
| Task | `task-set` | protocol | new |
| — | `answer-key` (bound to `task-set` by hash — §5) | protocol | new |
| Judge Configuration | `judge-config` | protocol | **built** (generalize) |
| — | `analysis-config` (statistical treatment, frozen — §6) | protocol | new |
| Success Metrics | `interpretation-table` (pre-signed, per IRL-016 §4) | protocol | new |
| — | `execution-run` (one row per confirmatory pass — §7) | execution | new |
| Receipt Schema / Export Package | `research-package` (§4) | publication | new |

### 2.2 Composition with `EXPERIMENT_LIFECYCLE` (the reconciliation IRL-016 needs operationalized)

An experiment's macro `lifecycle` field (`designed → protocol-ratified → ...`) advances to `protocol-ratified` **only when every `FrozenArtifact` whose `kind` is in `PROTOCOL_FREEZE_ARTIFACT_KINDS` for that `experimentId` is at `frozen`** — not every artifact regardless of kind.

(Aletheon review, 2026-07-22: the original wording gated on ALL artifacts, including `execution-run` and `research-package`. Since neither can exist before the experiment runs, that made `protocol-ratified` — which precedes `running` in `EXPERIMENT_LIFECYCLE` — permanently unreachable. Those two kinds instead govern the later macro transitions:)

| Macro transition | Depends on |
|---|---|
| `designed → protocol-ratified` | every `PROTOCOL_FREEZE_ARTIFACT_KINDS` artifact at `frozen` (this section) |
| `protocol-ratified → running` | an `execution-run` artifact opened |
| `running → evaluated` | the `execution-run` closed + judge outputs committed |
| `evaluated → published` | a `research-package` exported and publicly reachable |

This is a derivation, not a manually-set flag — mirrors how `replicated` is already derived from ≥2 distinct providers (`services/research/lifecycle.ts`, CFS-019 Phase C1). Concretely: a `deriveProtocolRatified(experimentId)` helper alongside the existing `deriveOverview` in `services/research/lifecycle.ts`, filtering artifacts by `kind ∈ PROTOCOL_FREEZE_ARTIFACT_KINDS` before checking `lifecycle === 'frozen'` on each.

## 3. Crystal readiness — two separate reports, not one combined gate

Aletheon review (2026-07-22): the original single "Crystal Readiness Report" placed task coverage inside the gate for `crystal-version`'s `validated → frozen` transition. That directly conflicts with the already-ratified independence sequence (`IRL-016` §5; `CRYSTAL-ENLARGEMENT_plan.md` §4, marked "sacred" there): **enlarge → FREEZE crystal → construct tasks independently.** If final tasks had to exist before the crystal could freeze, the crystal could be — even unintentionally — adapted to fit those tasks, recreating exactly the task–collection affinity problem the sequence gate exists to prevent. This section is split accordingly.

### 3.1 Crystal Intrinsic Readiness Report (gates `crystal-version`: `validated → frozen`)

Assesses the crystal WITHOUT reference to any task set — the crystal must stand on its own:

| Check | What it verifies | Fails closed if |
|---|---|---|
| Selection space | Arm C's fixed slice can remain a genuine `⊆40%` proper subset of the crystal (EXP-P1 §3, already ratified) | no subset choice satisfies `⊆40%` at meaningful size |
| Derivation headroom | The collection contains relational/conditional/compositional invariants, not only atomic assertions (`CRYSTAL-ENLARGEMENT_plan.md` §3 condition d) | derivation-eligible invariant count is negligible |
| Structural diversity | Invariant set spans multiple semantic_types / relational forms, not N repetitions of one shape | duplicate-shape ratio exceeds a documented threshold |
| Duplicate detection | No near-duplicate invariants inflating the count | duplicates found and unresolved |
| Provenance eligibility | Every invariant is tagged `external-established` or `external-empirical` (§9; `CRYSTAL-ENLARGEMENT_plan.md` §2a) | any `platform-derived`/`platform-hypothesized` invariant present |
| Lifecycle/validation integrity | Every invariant carries real receipted validation counts (no zero-validation filler — `CRYSTAL-ENLARGEMENT_plan.md` §2 condition a) | zero-validation or bulk-authored entries found |

This is the automated gate `CRYSTAL-ENLARGEMENT_plan.md`'s §5 "definition of done" already lists as checkboxes — this subsection is what makes those checkboxes machine-verifiable rather than self-attested.

### 3.2 Task–Crystal Coverage Report (gates `task-set`: `validated → frozen` — NOT the crystal)

Generated only AFTER: (1) `Crystal vP1` is frozen and hash-committed; (2) tasks are independently constructed against the frozen domain boundary, per EXP-P1 §5.1 (the reviewer sees the domain boundary, not the crystal contents); (3) the constructed tasks are submitted for coverage validation. It verifies:

- every recall task has ≥1 valid grounding path through the frozen crystal;
- every derivation task has a valid multi-invariant entailment path, with required premises present;
- the expected answer is actually supported by those premises;
- no task depends on absent material;
- no task collapses into answerability from general model knowledge alone (which would defeat the purpose of grounding it).

**Unsupported-task replacement procedure** (pre-registered, so a coverage failure can't turn into ad hoc task editing): an unsupported task is excluded and replaced using the same frozen task-construction procedure — never by hand-patching that one task — until the pre-registered task count is reached. The crystal is never altered to accommodate a task; a persistent inability to reach the target count is itself a finding about the crystal's density (mirrors `CRYSTAL-ENLARGEMENT_plan.md` §2's "no invariant is authored to hit a number").

The dashboard (§10) shows **Crystal Readiness** and **Task Coverage** as two distinct states, never one combined bar.

## 4. Research Package exporter (CFS-033 §3, build now)

The generalization CFS-033 already named: for any experiment, export `{hypothesis, protocol, frozen artifacts + hashes, execution receipts, raw outputs, judge outputs, statistics, interpretation table, replication status}` as one downloadable, independently-verifiable bundle. This is also the **Reviewer Package** Austin's-agent needs — one exporter serves both the "publish this" and "let an external reviewer verify this" use cases; do not build two.

## 5. Task Set + sealed Answer Keys (blinded, arm-randomized, hash-bound)

Aletheon review (2026-07-22): the original ordering allowed an answer key to seal before its task set was finalized — risky, since a key is semantically bound to one exact task-set version; sealing it early could leave a sealed key pointing at tasks that later change or get rejected in review. Corrected order:

```
draft tasks
→ independent construction complete (per §3.2, against the frozen crystal's domain boundary only)
→ Task–Crystal Coverage Report passes (§3.2)
→ task set finalized, task-set hash generated
→ answer key authored, bound to that EXACT task-set hash (AnswerKeyArtifact.taskSetContentHash)
→ task set and answer key jointly frozen/sealed
```

`task-set` and `answer-key` remain two separate `FrozenArtifact` rows with independent `contentHash`es — but an `answer-key` row is invalid unless its `taskSetContentHash` matches its referenced `task-set` row's `contentHash` at the moment both freeze. A mismatch blocks freeze outright; it is never silently tolerated.

- The judge process never sees which arm produced an answer, the expected winner, or the hypothesis under test — arm labels are randomized per the `judge-config` artifact. This is a config-level requirement, not new judging code: the existing Independence Protocol (CFS-033 §1, generative/evaluative/constitutional roles routed to different providers) already gives the mechanism; this adds label-blinding as a required field.
- Task categories (recall vs. derivation, and within derivation: two-premise / three-plus-premise / conditional / conflict-resolution / novel-application / minimal-sufficiency / plausible-distractor) are a property of `task-set`, not a new object.

## 6. Analysis configuration + failure classification (both pre-registered)

The statistical treatment must be frozen alongside the interpretation table — otherwise prompts and outputs can be frozen while the analytical treatment stays flexible, reopening exactly the post-hoc-reinterpretation risk IRL-016 exists to close (Aletheon review, 2026-07-22). A dedicated `analysis-config` artifact (§2.1) fixes, before any data exists: primary comparisons (B−C, C−D); aggregation method across repetitions; treatment of missing/invalid runs; judge-disagreement resolution; effect-size reporting; exclusion rules; threshold interpretation; correction for multiple comparisons where applicable.

Before execution, the `interpretation-table` artifact fixes the categories a negative result may fall into — fixed **before** any data exists, exactly as IRL-016 §4 already requires for the interpretation table generally:

`scientific-null | substrate-insufficiency | task-invalidity | implementation-failure | measurement-failure | coverage-failure`

Each category needs an objective, pre-stated criterion (e.g. `coverage-failure` = the §3.2 Task–Crystal Coverage Report would have failed for the task in question; `implementation-failure` = the §7 Treatment Integrity Check failed). No category may be invented after seeing results — that would be exactly the post-hoc reinterpretation IRL-016 §4 forbids.

## 7. Treatment Integrity Check (Arm B instrumentation, formalized as a gate)

For every Arm B task execution, log: candidate invariants considered, selected invariants + selection scores, exclusions, the composition/projection trace, the final rendered prompt, and hashes of every input/output. One `execution-run` row per pass; repeated executions (§8) are additional rows, not overwrites.

Aletheon review (2026-07-22): observability alone isn't enough — it must be a formal, pre-registered **pass/fail gate**, not just a log. A B≈C outcome is **not scientifically interpretable** unless the Treatment Integrity Check passes:

- the resolution/selection engine actually ran for the task;
- candidate selection occurred (not skipped);
- the projection was non-empty where the protocol expected it to be non-empty;
- the recorded trace matches the frozen `arm-config`/runtime configuration exactly;
- no fallback path silently substituted for the runtime (e.g. a static prompt shipped instead of live selection);
- the final rendered prompt matches its recorded hash.

A Treatment Integrity failure is classified `implementation-failure` (§6), never folded into a `scientific-null` — this is exactly what prevents an implementation defect from masquerading as a finding about the mechanism.

## 8. Pilot vs. confirmatory separation (IRL-016's freeze discipline, made procedural)

Two disposable pilot stages precede the frozen protocol, both explicitly OUT of the evidence base:

- **Engineering shakedown** — synthetic/disposable tasks; verifies every arm executes, traces capture, judge output parses, hashing/receipts work, no arm leaks information to another. No scientific conclusions drawn.
- **Methodology pilot** — a separate disposable task batch; establishes task difficulty produces a usable performance spread (no ceiling/floor effect), judge agreement is adequate, and derivation tasks genuinely require composition. The protocol MAY be revised after this pilot — this is what IRL-016 §3 calls the design phase, where everything is still mutable.

Once both pilots pass, **freeze** (IRL-016 §2): every `FrozenArtifact` transitions to `frozen`, hash-committed, jointly signed. Repeated executions of the confirmatory run may be pre-registered as part of the frozen protocol (e.g., 3 repetitions per arm-task pair, matching Aletheon's reliability recommendation) — but no inspecting one repetition and altering the protocol before the next. That would void the freeze, per IRL-016 §4.

## 9. Crystal scope — the one binding rule from this session (Track 2 stays paused otherwise)

Per operator instruction: **internal/platform risk materials are excluded from the EXP-P1 crystal.** They remain available for platform operations (the financial-services application, Agent MoneyPenny's `inv.finance.*` derivation from QriptoCENT) but must never be ingested into `Crystal vP1`. Every invariant entering the crystal carries a provenance tag distinguishing `external-established | external-empirical | platform-derived | platform-hypothesized`; **only `external-established` and `external-empirical` are eligible for EXP-P1's corpus.** This is a small, immediate amendment to `CRYSTAL-ENLARGEMENT_plan.md` (see the companion edit to that file) — everything else about crystal source material (the six source lanes, domain boundary, target composition) is deliberately **not** re-specified here; the operator is returning to that separately.

## 10. Readiness Dashboard

One IRL OS surface (Laboratory → EXP-P1 Readiness) showing red/amber/green per section — but each section gates a DIFFERENT macro transition, not one blanket bar.

(Aletheon review, 2026-07-22: "EXP-P1 cannot execute until every section is green" is wrong once stated bluntly — Execution is SUPPOSED to be red until the experiment has actually run; conflating that with protocol-readiness would make the dashboard lie.)

| Dashboard section | Gates |
|---|---|
| Infrastructure | design completion (§§2–7 built) |
| Crystal | `crystal-version` freeze (§3.1) |
| Coverage | `task-set` freeze (§3.2) |
| Freeze | `protocol-ratified` (§2.2 — all `PROTOCOL_FREEZE_ARTIFACT_KINDS` frozen) |
| Review | reviewer package reachable (§4) |
| Execution | `running` / `evaluated` (§2.2) |
| Publication | `published` (§2.2) |

Only Infrastructure, Crystal, Coverage, Freeze, and Review need to be green for `protocol-ratified`. Execution and Publication are EXPECTED red until the experiment actually runs and is exported — their green state is a later milestone, not a precondition.

## 11. Explicitly out of scope for this PRD

- Crystal content / source-material sourcing (Track 2 — `CRYSTAL-ENLARGEMENT_plan.md`, paused).
- Any specific invariant count, task count, or repetition count as a hard requirement (§0.5).
- Changes to `EXPERIMENT_LIFECYCLE`, `PUBLICATION_LIFECYCLE`, or `FINDING_LIFECYCLE`.
- A new IRL governance charter (§0.1) — IRL-016 already governs this.

## 12. Sequencing (amended per Aletheon review, 2026-07-22)

1. Operator ratifies this PRD (or amends it further).
2. Build the artifact model + lifecycle derivations (§2).
3. Build Crystal Intrinsic Readiness validation (§3.1).
4. Build task-set, answer-key, and analysis-config sealing (§5, §6).
5. Build runtime instrumentation + the Treatment Integrity Check (§7).
6. Build the Research Package exporter + reviewer-readable endpoints (§4).
7. Build the lifecycle-aware Readiness Dashboard (§10).
8. Operator resumes Track 2 — expand the external crystal (`CRYSTAL-ENLARGEMENT_plan.md`).
9. Validate and freeze `Crystal vP1` (§3.1).
10. Independently construct tasks (against the domain boundary only — EXP-P1 §5.1).
11. Generate the Task–Crystal Coverage Report (§3.2).
12. Finalize and jointly freeze: task set, answer key, arm configurations, judge configuration, analysis configuration, interpretation table (§5, §6).
13. Run engineering shakedown on disposable artifacts (§8).
14. Run methodology pilot on a separate disposable task batch (§8).
15. Apply permitted pre-freeze revisions (IRL-016 §3 — everything unsigned is still mutable).
16. Freeze the confirmatory protocol (IRL-016 §2).
17. Execute pre-registered repetitions.
18. Evaluate, export, publish, and replicate.

Steps 1–7 are Track 1 (this PRD) and are buildable now, independent of Track 2. Steps 8–18 require Track 2's external crystal and only begin once the operator resumes that work.

---

## 13. Track 0 — Recursive Invariant Capture (Aletheon addition, 2026-07-22)

The general practice — what a programme's own recurring decisions reveal about corpus construction and experimental design, and how that gets captured without contaminating the programme's actual scientific evidence — is chartered separately in `IRL-017 — Recursive Invariant Capture` (standing practice for every major IRL programme, not EXP-P1-specific). This section is EXP-P1's bounded application of it.

- At each of this programme's major milestones (infrastructure build-out §§2–7, crystal freeze §3.1, task-set freeze §3.2, confirmatory run §8), run the Invariant Retrospective (IRL-017 §3) and populate IRL-017 §2's two registers with anything EXP-P1 surfaces.
- **Safeguard (IRL-017 §4, itself just IRL-016 §2's successor-experiment principle applied recursively): a meta-invariant discovered while building EXP-P1 may govern future IRL programmes, but it must never alter EXP-P1's own frozen protocol after ratification.** It becomes a candidate for the *next* programme's charter, never a backdoor amendment to this one.
- This track produces operational/procedural learning, never scientific evidence for EXP-P1's structural hypothesis (IRL-017 §6) — the two evidential registers (constitutional/operational vs. scientific/structural) stay separate in every report this programme produces.

## Amendment log

- **2026-07-22 — Aletheon review, pre-ratification.** Three sequencing contradictions caught and fixed in place (§0 item 7, §2.1, §2.2, §3, §5, §6, §7, §10, §12 all revised): (1) the protocol-ratified derivation originally depended on artifact kinds (`execution-run`, `research-package`) that cannot exist before execution, making the transition unreachable — fixed by introducing `PROTOCOL_FREEZE_ARTIFACT_KINDS` as the actual derivation input; (2) the crystal readiness gate originally required task coverage before the crystal could freeze, contradicting the already-ratified crystal-before-tasks sequence (IRL-016 §5) — fixed by splitting into a Crystal Intrinsic Readiness Report (gates the crystal) and a Task–Crystal Coverage Report (gates the task set, generated only after the crystal is already frozen); (3) the answer key could originally seal before its task set was finalized — fixed by binding `AnswerKeyArtifact` to an exact `taskSetContentHash` and requiring joint freeze. Also adopted: `ArtifactPhase`, the `contentHash`/`commitmentHash` split, an explicit `analysis-config` artifact, the Treatment Integrity Check as a formal gate, and the dashboard's per-section gate mapping. This is normal pre-freeze revision (IRL-016 §3 — everything unsigned remains mutable) and does not require a second ratification round; it is logged here for traceability, not as a protocol amendment (nothing here was ever frozen).

- **2026-07-22 — Track 0 added.** §13 added (Recursive Invariant Capture), scope note updated, cross-referencing the new standing-practice document `IRL-017`. Bounded to EXP-P1's application of that practice; the general practice itself is chartered in IRL-017, not restated here.

## Ratification record

- [ ] Operator ratification of this PRD (status: DESIGN, awaiting sign-off — now incorporating both 2026-07-22 amendments above)
- [ ] Companion amendment to `CRYSTAL-ENLARGEMENT_plan.md` (§2a exclusion rule) — see accompanying edit, ratified alongside this PRD
- [ ] Companion document `IRL-017 — Recursive Invariant Capture` — ratified alongside this PRD (§13)
- [ ] Build tracked against §12's sequencing once ratified
