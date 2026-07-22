# PRD-EPI-001 — EXP-P1 Experimental Infrastructure & Readiness Programme

**metaMe IRL · Product/engineering specification · Status: DESIGN (docs-first, ratify-before-build)**
**Owner:** Invariant Research Lab (IRL) · **Origin:** operator + Aletheon design session, consolidated against Austin's-agent review, 2026-07-22
**Governs:** the infrastructure EXP-P1 needs to produce a result that is trustworthy in EITHER direction — not an experiment tuned to succeed.

> Scope note (operator instruction, this session): this PRD charters **Track 1 — Infrastructure** only. Track 2 — crystal source-material expansion — is separately chartered in `CRYSTAL-ENLARGEMENT_plan.md` and is explicitly **PAUSED**: the operator is deferring the source-material work to a follow-up session. Nothing in this PRD should be read as authorizing crystal-content work; §9 states the one binding rule that carries forward now (internal risk materials excluded from the EXP-P1 corpus) and leaves the rest for that follow-up.

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

export interface FrozenArtifact {
  id: string;
  kind: 'crystal-version' | 'arm-config' | 'task-set' | 'answer-key' | 'judge-config'
      | 'interpretation-table' | 'execution-run' | 'research-package';
  experimentId: string;         // FK to ResearchExperiment.id (e.g. 'EXP-P1')
  lifecycle: ArtifactLifecycleState;
  contentHash: string | null;   // set only at 'frozen' — the commitment
  frozenAt: string | null;
  signedBy: string[];           // T2 refs of signatories (IRL + reviewer, per IRL-016 §2)
}
```

Mapped onto CFS-033 §2's tree:

| CFS-033 component | This PRD's artifact `kind` | Status |
|---|---|---|
| Grounding Slice | `crystal-version` (the frozen `Crystal vP1` snapshot — EXP-009 mechanism) | **built** |
| Inputs / Runtime Configuration | `arm-config` (per-arm A/B/C/D configuration) | new |
| Task | `task-set` | new |
| — | `answer-key` (sealed, hash-committed separately from `task-set` per §5) | new |
| Judge Configuration | `judge-config` | **built** (generalize) |
| Success Metrics | `interpretation-table` (pre-signed, per IRL-016 §4) | new |
| Receipt Schema / Export Package | `research-package` (§4) | new |
| — | `execution-run` (one row per confirmatory pass — §7) | new |

### 2.2 Composition with `EXPERIMENT_LIFECYCLE` (the reconciliation IRL-016 needs operationalized)

An experiment's macro `lifecycle` field (`designed → protocol-ratified → ...`) advances to `protocol-ratified` **only when every `FrozenArtifact` for that `experimentId` is at `frozen`**. This is a derivation, not a manually-set flag — mirrors how `replicated` is already derived from ≥2 distinct providers (`services/research/lifecycle.ts`, CFS-019 Phase C1). Concretely: a `deriveProtocolRatified(experimentId)` helper alongside the existing `deriveOverview` in `services/research/lifecycle.ts`.

## 3. Crystal Readiness Validation (new — neither CFS-033 nor CFS-019 name this)

Before a crystal-version artifact may transition `validated → frozen`, run an automated readiness check (not a manual review) producing a **Crystal Readiness Report**:

| Check | What it verifies | Fails closed if |
|---|---|---|
| Selection space | Arm C's fixed slice remains a genuine `⊆40%` proper subset of the crystal (EXP-P1 §3, already ratified) | slice ≥ 40% of collection |
| Derivation headroom | The collection contains relational/conditional/compositional invariants, not only atomic assertions (`CRYSTAL-ENLARGEMENT_plan.md` §3 condition d) | derivation-eligible invariant count below the task set's requirement |
| Coverage | Every task (once the task set exists) has ≥1 valid grounding path through the frozen crystal — the hidden **Task Coverage Matrix** Aletheon specifies | any task has zero valid path |
| Structural diversity | Invariant set spans multiple semantic_types / relational forms, not N repetitions of one shape | duplicate-shape ratio exceeds a documented threshold |
| Duplicate detection | No near-duplicate invariants inflating the count | duplicates found and unresolved |

This is the automated gate CRYSTAL-ENLARGEMENT_plan.md's §5 "definition of done" already lists as checkboxes — this section is what makes those checkboxes machine-verifiable rather than self-attested.

## 4. Research Package exporter (CFS-033 §3, build now)

The generalization CFS-033 already named: for any experiment, export `{hypothesis, protocol, frozen artifacts + hashes, execution receipts, raw outputs, judge outputs, statistics, interpretation table, replication status}` as one downloadable, independently-verifiable bundle. This is also the **Reviewer Package** Austin's-agent needs — one exporter serves both the "publish this" and "let an external reviewer verify this" use cases; do not build two.

## 5. Task Set + sealed Answer Keys (blinded, arm-randomized)

- `task-set` and `answer-key` are separate `FrozenArtifact` rows, hash-committed independently, so an answer key can be sealed before task-set review is even complete.
- The judge process never sees which arm produced an answer, the expected winner, or the hypothesis under test — arm labels are randomized per the judge-config artifact. This is a config-level requirement on `judge-config`, not new judging code: the existing Independence Protocol (CFS-033 §1, generative/evaluative/constitutional roles routed to different providers) already gives the mechanism; this adds label-blinding as a required field.
- Task categories (recall vs. derivation, and within derivation: two-premise / three-plus-premise / conditional / conflict-resolution / novel-application / minimal-sufficiency / plausible-distractor) are a property of `task-set`, not a new object.

## 6. Failure classification (pre-registered, part of `interpretation-table`)

Before execution, the `interpretation-table` artifact fixes the categories a negative result may fall into — fixed **before** any data exists, exactly as IRL-016 §4 already requires for the interpretation table generally:

`scientific-null | substrate-insufficiency | task-invalidity | implementation-failure | measurement-failure | coverage-failure`

Each category needs an objective, pre-stated criterion (e.g. `coverage-failure` = the Crystal Readiness Report's coverage check would have failed for the task in question). No category may be invented after seeing results — that would be exactly the post-hoc reinterpretation IRL-016 §4 forbids.

## 7. Runtime observability (Arm B instrumentation)

For every Arm B task execution, log: candidate invariants considered, selected invariants + selection scores, exclusions, the composition/projection trace, the final rendered prompt, and hashes of every input/output. This verifies the treatment was actually administered before a B≈C null is read as a finding about the mechanism rather than about whether the mechanism ran. One `execution-run` row per pass; repeated executions (§8) are additional rows, not overwrites.

## 8. Pilot vs. confirmatory separation (IRL-016's freeze discipline, made procedural)

Two disposable pilot stages precede the frozen protocol, both explicitly OUT of the evidence base:

- **Engineering shakedown** — synthetic/disposable tasks; verifies every arm executes, traces capture, judge output parses, hashing/receipts work, no arm leaks information to another. No scientific conclusions drawn.
- **Methodology pilot** — a separate disposable task batch; establishes task difficulty produces a usable performance spread (no ceiling/floor effect), judge agreement is adequate, and derivation tasks genuinely require composition. The protocol MAY be revised after this pilot — this is what IRL-016 §3 calls the design phase, where everything is still mutable.

Once both pilots pass, **freeze** (IRL-016 §2): every `FrozenArtifact` transitions to `frozen`, hash-committed, jointly signed. Repeated executions of the confirmatory run may be pre-registered as part of the frozen protocol (e.g., 3 repetitions per arm-task pair, matching Aletheon's reliability recommendation) — but no inspecting one repetition and altering the protocol before the next. That would void the freeze, per IRL-016 §4.

## 9. Crystal scope — the one binding rule from this session (Track 2 stays paused otherwise)

Per operator instruction: **internal/platform risk materials are excluded from the EXP-P1 crystal.** They remain available for platform operations (the financial-services application, Agent MoneyPenny's `inv.finance.*` derivation from QriptoCENT) but must never be ingested into `Crystal vP1`. Every invariant entering the crystal carries a provenance tag distinguishing `external-established | external-empirical | platform-derived | platform-hypothesized`; **only `external-established` and `external-empirical` are eligible for EXP-P1's corpus.** This is a small, immediate amendment to `CRYSTAL-ENLARGEMENT_plan.md` (see the companion edit to that file) — everything else about crystal source material (the six source lanes, domain boundary, target composition) is deliberately **not** re-specified here; the operator is returning to that separately.

## 10. Readiness Dashboard

One IRL OS surface (Laboratory → EXP-P1 Readiness) showing red/amber/green per section: Infrastructure (this PRD's §§2–7 built), Crystal (readiness report passing — depends on Track 2), Coverage (task coverage matrix complete), Freeze (all artifacts frozen + signed), Review (reviewer package generated + reachable), Execution (confirmatory run complete). EXP-P1 cannot transition to `protocol-ratified` while any section is red — this is the human-legible face of §2.2's derivation rule.

## 11. Explicitly out of scope for this PRD

- Crystal content / source-material sourcing (Track 2 — `CRYSTAL-ENLARGEMENT_plan.md`, paused).
- Any specific invariant count, task count, or repetition count as a hard requirement (§0.5).
- Changes to `EXPERIMENT_LIFECYCLE`, `PUBLICATION_LIFECYCLE`, or `FINDING_LIFECYCLE`.
- A new IRL governance charter (§0.1) — IRL-016 already governs this.

## 12. Sequencing

1. Operator ratifies this PRD (or amends it).
2. Build §§2–7 (object model, readiness validation, Research Package exporter, task/answer-key sealing, failure taxonomy, runtime observability) + §10 (dashboard) against the CFS-033 tree — this is buildable now, independent of Track 2.
3. Operator returns with Track 2 (crystal source material); `CRYSTAL-ENLARGEMENT_plan.md` resumes.
4. Engineering shakedown → methodology pilot → freeze → confirmatory run → replication, per §8, gated by the dashboard.

---

## Ratification record

- [ ] Operator ratification of this PRD (status: DESIGN, awaiting sign-off)
- [ ] Companion amendment to `CRYSTAL-ENLARGEMENT_plan.md` (§9 exclusion rule) — see accompanying edit, ratified alongside this PRD
- [ ] Build tracked against §12's sequencing once ratified
