# CFS-033 — Constitutional Evaluation: the Experimental Operating System

**Chrysalis Foundation Specification · v1 · Status: CHARTERED 2026-07-16 (operator direction, from Aletheon's generalization of the external reviewer's capability probe).**
Companion to: **CRP-002** (whose EXP-010 prerequisites are this spec's first two built instances), **CFS-019** (the IRL charter — this spec is Layer I/II infrastructure for its experimental method), **IRL-010** (whose "internal adjudication" honesty note §Experimental Methods is the limitation this spec's judging/adjudication split formalizes a path out of), **CFS-016/CFS-025** (the receipt + hash-committed publication disciplines this spec composes, never re-invents).

## 0. The reframe — infrastructure, not a concession

The external reviewer asked for an "externally specified judge configuration." Built as a feature for one reviewer, that is a concession. Aletheon's reframe, adopted as this spec's founding move: build it as a first-class capability of the AgentiQ Runtime, and it becomes **scientific infrastructure** — the thing scientific computing has lacked for AI:

> Today every lab invents its own scripts, its own prompts, its own judges, its own evaluation, its own logging, its own replication. You're slowly standardizing all of that. — Aletheon, 2026-07-16

**The constitutional principle this spec ratifies** (spec-level; deliberately NOT seeded as a crystal invariant yet, per the unseeded-vocabulary discipline):

> **Evaluation is a pluggable, receipted, versioned component of every experiment.**

The reviewer's request is then simply one instance of a general capability, alongside: another researcher supplying a different adjudication strategy, a journal requiring a particular rubric, a regulator specifying an approved benchmark, a community replication network contributing independent receipts.

## 1. What already exists (verified against the code, not asserted)

The principle is not being invented from nothing — the platform already holds real fragments, built for other reasons, that this spec names as the seed of the architecture:

| Component (Aletheon's tree) | What exists today | Where |
|---|---|---|
| Task | Externalized task/question banks | `services/experiments/exp001-config.json` (seedIds, artifacts, 15-question bank), `exp003-config.json` |
| Grounding Slice | Verbatim, hash-committed slice export | `scripts/export-grounding-slice.mjs` (EXP-010 prerequisite (i), 2026-07-16) |
| Judge Configuration | External JSON artifact — provider, model, rubric overrides; sha256 printed + recorded in results | `scripts/evaluate-exp001.mjs --judge-config` (EXP-010 prerequisite (ii), 2026-07-16) |
| Receipt | `experiment_result_published` (DVN-anchorable, sha256 content commitment in summary); `research_lifecycle_transition` | receipt service + DVN pipeline |
| Version IDs | Hash-committed `experiment_results` rows; the versioned-crystal discipline (Crystal vN — EXP-009 design); CIRS versioning (CIRS-v0.1 → v1.0) | `experiment_results`, EXP-009 charter, CRP-002 |
| Judge independence | The Independence Protocol — generative/evaluative/constitutional roles resolved to DIFFERENT providers by routing, not promise | CRP-002 amendment 2026-07-09 |
| Replication (concept) | `replicated` is already a lifecycle state DERIVED from ≥2 distinct providers producing the result | `services/research/lifecycle.ts`, CFS-019 §Phase C1 |

**What does NOT exist:** these fragments are not composed into one object. There is no `EvaluationConfiguration` type, no Research Package exporter, no multi-judge panel, no adjudication layer, no import/replay mechanism. §2–§5 name that architecture as VISION.

## 2. The Evaluation Configuration — the target object (vision, unbuilt)

Adopted from Aletheon verbatim as the architecture to build toward — one portable object per experiment:

```
Evaluation Configuration
├── Task                      (the held-out task set + selection procedure)
├── Inputs                    (per-arm inputs, verbatim)
├── Grounding Slice           (hash-committed — the exporter's artifact)
├── Runtime Configuration     (provider, model, temperature, token budgets)
├── Judge Configuration       (the --judge-config artifact, generalized)
├── Adjudication Strategy     (§4 — distinct from judging)
├── Success Metrics           (pre-registered thresholds + falsification criteria)
├── Receipt Schema            (what gets receipted, at which steps)
└── Export Package            (§3)
```

Every component versioned, every component hash-committable, the whole thing serializable. The two built instruments (slice export, judge config) are components 3 and 5 of this tree, already conforming to its discipline (sha256 pre-registration commitments) — built bottom-up, exactly as the ModelQube router was.

## 3. Research Packages — publication-grade reproducibility (vision, unbuilt)

The generalization of "export the grounding slice": export the ENTIRE experiment as a **Research Package** — hypothesis, protocol, grounding, configurations, receipts, evaluation, results, variance, raw outputs, canonical ratification status. The contrast Aletheon draws is the point: today's AI papers say *"we prompted GPT-5 — good luck reproducing that"*; a Research Package says *"EXP-NNN · receipt id · download the grounding slice · download the evaluation protocol · download the judge specification · replay."* Anyone can re-run it. This is the versioned-crystal discipline (a crystal version is a scientific artifact anyone can re-run against — EXP-009) extended from the KNOWLEDGE substrate to the ENTIRE experimental apparatus.

## 4. Judging ≠ Adjudication — an architectural distinction, adopted

**Judges score; adjudication resolves disagreement.** These are different functions and this spec keeps them architecturally separate. Multi-judge panels (a GPT judge, a Claude judge, a human judge, a rubric judge, a statistical judge — compare agreement) are the judging layer; the adjudication strategy (majority, weighted-by-calibration, human-final-authority, escalate-on-split) is a separate, independently pluggable component. **Prior grounding:** IRL-010's experimental-methods honesty already names "internal adjudication" as a limitation of every result to date, and the EXP-001 protocol already assigns final rubric authority to a HUMAN scorer over the machine-assisted pass — the platform has been informally adjudicating all along; this spec names the seam so it can be formalized rather than remain implicit. The Independence Protocol's three cognitive roles (generative/evaluative/constitutional) are the closest existing machinery — adjudication is a refinement WITHIN the evaluative role, not a fourth role.

## 5. Distributed replication — the furthest horizon (vision, explicitly a product idea, unbuilt)

`Export Experiment → anyone imports → runs locally → submits receipt → the Institute compares outcomes.` Distributed REPLICATION, not distributed inference — a distributed scientific instrument ("Invariant Intelligence Research Kit"). The lifecycle already defines `replicated` as ≥2 distinct providers; this vision extends "distinct providers" to "distinct PARTIES." Named here so that, when built, it is built as this spec's terminal capability rather than a bolt-on — and named honestly as the component furthest from existing.

## 6. Naming rule

In architecture and code, the capability is **Constitutional Evaluation** (or the Evaluation Configuration object) — never "externally specified judge configuration," which describes one consumer of the capability, not the capability. The reviewer's request is an instance; the abstraction is the asset.

## 7. Honest limits

- **Only components 3 and 5 of §2's tree exist** (the slice exporter and the judge-config artifact, both built 2026-07-16 for EXP-010). No `EvaluationConfiguration` type, no Research Package export, no multi-judge panel, no adjudication layer, no import/replay path exists.
- **The ratified principle (§0) is spec-level, not a seeded invariant.** If it earns a crystal entry, that is a future seed-and-ratify pass (the CFS-031 §6 discipline).
- **"Experimental Operating System" is a framing**, useful for seeing the target; it is not a claim that such a system exists.
- **Build order is deliberately unspecified.** The natural next slice — the `EvaluationConfiguration` type + folding the two existing instruments under it — is a candidate increment, not a commitment; EXP-010's Phase 1 (which needs only the two built instruments) does not wait for it.
- This spec composes the EXISTING receipt, hash-commitment, and lifecycle disciplines — any implementation that forks a parallel receipt or versioning path violates it.

## 8. UI surface — IRL OS, the public cartridge (decided + built 2026-07-16)

**Operator decision:** the public face of the institute — and this spec's external-researcher front door — is a **new public-facing cartridge, "IRL OS"** (id `irl-os-cartridge`, slug `irl-os`), exactly as AgentiQ OS is the open public-facing version of AgentiQ. A standalone cartridge, not a tab inside the internal IRL cartridge, so it has **its own URL** (`/triad/embed/codex/irl-os`) that can be surfaced in the runtime and embedded elsewhere.

**v1 is content-only**: the published research corpus (charter, the three constitutional layers, protocols & experiment records, glossary, publications record, programmes) plus a dedicated **Constitutional Evaluation** tab fronting this spec — consuming the SAME `irl` pack as the internal cartridge (single source of truth; the pack is already in the packRegistry skip list, so no auto-generated duplicate). A metaMe QuickLinks entry surfaces it in the runtime.

**Never public:** the internal Experiment Lab (`InvariantExperimentLab`, admin-only, runs spend provider credits). **Named follow-on:** the four interactive-but-public instruments (Dashboard, Research Copilot, Invariant Field Explorer, Invariant Registry) join IRL OS only after an anonymous-read API audit of each. "IRL OS" is the cartridge/product name; CFS-019's pending external-banner decision (Aletheon's proposed "Invariant Intelligence Research Institute") remains pending and is not resolved by this naming.

## Ratification record

- [x] **CHARTERED 2026-07-16 by operator direction**, from Aletheon's proposal generalizing the external reviewer's capability probe. The two built instances (slice export, judge config) predate the charter by hours — the abstraction was named from working code, not speculation.
- [x] **§8 UI surface — DECIDED + BUILT 2026-07-16 by operator direction** ("create a new public facing cartridge for this like AgentiQ OS is the open public facing version of AgentiQ"; name confirmed "IRL OS"). `IRL_OS_CARTRIDGE` registered in `CODEX_DEFINITIONS` (`data/codex-configs.ts`), 9 content tabs, `permissions.view: ['*']`, QuickLinks entry added.
