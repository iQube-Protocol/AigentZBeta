# PROPOSED — Datasets & metrics for EXP-007 / EXP-008 / EXP-P1 / EXP-P2

**Status: `proposed` — NOT ratified, NOT sealed, NOT canonical.**
Authored 2026-07-19 by an agent at the operator's request to unblock the in-app
runners. Everything here is a **draft for operator review**. Per the repo's
epistemic-honesty discipline (CLAUDE.md — Hypothesis vs Canon; No Guessing):
nothing below enters a canon or a runner until the operator ratifies it, and no
result may be published from these until the dataset is **sealed** (ground truth
fixed before any forecast/measurement). An agent must never seal or canonize
these itself.

Why this doc instead of runners: a faithful automated runner needs the
experiment's real dataset + operationalized metric. Those are research-design
acts. Below are concrete, reviewable proposals so you can ratify (or correct)
them; once sealed, the runners can be built for real (mirroring the EXP-006 and
EXP-P3/D1 harness pattern already shipped).

---

## EXP-007 — Reasoning Entropy Reduction

**What's missing (per CRP-002 charter §5 + Amendment §3):** no task/corpus
dataset; the `naive-rag` and `existing-kb` baseline arms have no runner; and
"reasoning fidelity" + "entropy/drift" are never operationalized.

### Proposed metric definitions (for ratification)

- **Reasoning fidelity** (per generation): LLM-judge score, 0–100 rubric — the
  same blind judge-config pattern as `scripts/evaluate-exp001.mjs --judge-config`
  (hashable, provider-pinned). Rubric axes (proposed): grounded-claim rate,
  contradiction count (penalty), and task-answer correctness against a sealed key.
- **Reasoning entropy / drift** (per task, across k reps at temperature 0.7):
  mean pairwise Jaccard distance of the *claim sets* extracted from the k
  generations (1 − mean pairwise Jaccard). Lower = more stable = lower drift.
  This reuses the `jaccard` + claim-extraction shape already in the
  instrument-validation harness. (Proposed k = 5.)
- **Matched budget:** each arm capped at the same input-token budget B; report
  actual tokens per arm so the "at matched or lower budget" clause is auditable.

### Proposed four-arm wiring

| Arm | Init | Runner organ (proposed) |
|---|---|---|
| `large-context` | dump full corpus slice, no retrieval | `callSovereign('draft', …)` with the corpus in-context |
| `naive-rag` | top-k embedding retrieval | **NEW baseline** — needs an embedding index; propose reusing the same keyword/overlap retriever shipped in `services/experiments/expP3.ts` as a v0 stand-in, clearly labelled "lexical-RAG v0", until a real embedding index is wired |
| `existing-kb` | the platform's production KB retrieval | **NEW** — needs the production retrieval organ exposed to experiments; flagged as a build dependency |
| `invariant-runtime` | `resolveConstitutionalField` grounding | already live |

### Proposed dataset schema (`services/experiments/exp-007-tasks.json`)

```json
{
  "sealed": false,
  "status": "proposed",
  "tokenBudget": 4000,
  "reps": 5,
  "tasks": [
    { "id": "e7-001", "domain": "<domain>", "prompt": "<task>",
      "answerKeyHash": "<sha256 of sealed answer key>",
      "corpusRef": "<slice id or path the large-context/rag arms draw from>" }
  ]
}
```

**Blocker that remains after ratification:** the `existing-kb` arm needs the
production retrieval path exposed to the experiment harness. Until that exists,
EXP-007 can run 3 of 4 arms honestly (with `naive-rag` as lexical-RAG v0) — which
must be disclosed in any result, never presented as the full four-arm test.

---

## EXP-008 — Cross-Modal Invariant Reuse (Propagation Fidelity)

**What's missing:** the protocol's scorer is **blind human reviewers**
reconstructing the seed set; the `image` modality has no in-app generator; no
seed dataset.

### Proposed dataset schema (`services/experiments/exp-008-seeds.json`)

```json
{
  "sealed": false,
  "status": "proposed",
  "modalities": ["article", "story", "image", "ux", "prd"],
  "seedSets": [
    { "id": "p8-001", "invariantIds": ["inv.…", "inv.…", "inv.…"],
      "brief": "<what to generate across modalities from this ONE seed set>" }
  ]
}
```

### Proposed scoring (needs an explicit operator decision)

The charter fixes the scorer as **blind human reviewers**. Two honest options —
**ratify one**:
1. **Human panel (faithful to charter):** generate the modality artifacts in-app
   (text modalities via `callSovereign`; image modality deferred until an image
   organ is wired), then export for a blind human-reviewer reconstruction pass.
   The runner produces the artifacts + a reviewer packet; it does **not** score.
2. **LLM-judge substitute (a METHODOLOGY CHANGE — must be ratified as such):** an
   LLM judge attempts to reconstruct the seed set from each artifact; Propagation
   Fidelity = reconstruction overlap (precision/recall/F1 vs the seed set). Faster
   and automatable, but it is **not** the charter's protocol and must be labelled
   a substitute, never conflated with a human-reviewed result.

**Recommendation:** ship option 1's generator now (real, faithful) and treat
option 2 as an optional, clearly-labelled pre-screen — never the published metric.

---

## EXP-P1 — Representation & Runtime Gauntlet

**This is a two-party, externally-countersigned protocol.** An agent must NOT
draft the held-out task set or the Arm D expert prose — §5.1/§5.4 require Austin
to author/select them and require IRL to not see them before freeze.
Self-authoring them **voids the experiment**. So there is no dataset for me to
propose here.

### What IS appropriate to prepare (IRL-side, non-voiding)

- The **pre-registration bundle template** (arms, k=5 reps, 24-task slots,
  0–100 rubric, bootstrap-CI spec, the five pre-specified comparisons) as an
  empty, hash-committable form — already largely specified in the README.
- The **Arm B/C wiring**: Arm B ↔ `resolveConstitutionalField` + runtime; Arm C ↔
  `scripts/export-grounding-slice.mjs`. These can be built ahead of the freeze.
- The **bootstrap-CI + rubric-judge module** (shared with P2/P3).

**Proposal:** build the gauntlet runner + stats module against the *frozen bundle
interface*, so that the moment Austin's countersigned freeze + sealed tasks
arrive, execution is one call. No dataset is authored by the agent.

---

## EXP-P2 — Structural Invariance

**What's missing:** no frozen `Corpus vP2`, no hash-committed extraction
procedure, no held-out tasks; the "same-corpus" control forbids improvising them;
4 of 5 battery runners unbuilt.

### Proposed corpus + extraction (for ratification)

- **Corpus vP2 (proposed):** a frozen slice of the existing canonical corpus —
  propose a single namespace band (e.g. `inv.reasoning.*` canonical) exported
  verbatim via `scripts/export-grounding-slice.mjs` with a sha256 manifest, so
  the raw arm (R), the summary arm (S), and the invariant arm (I) all draw from
  the **same** frozen text. This satisfies the load-bearing same-corpus control
  *only if* the invariant field (I) is extracted from that same slice, not
  hand-authored.
- **Extraction procedure (proposed):** run `resolveConstitutionalField` /
  the discovery ranking over the frozen corpus ≥2× independently (B1 convergence),
  publishing the procedure hash. No hand-authoring of the substrate.

### Proposed dataset schema (`services/experiments/exp-p2-tasks.json`)

```json
{
  "sealed": false,
  "status": "proposed",
  "corpusManifestSha256": "<from export-grounding-slice>",
  "tasks": [
    { "id": "p2-001", "type": "recall|derivation", "prompt": "<task>",
      "answerKeyHash": "<sha256 sealed key>",
      "selectionSensitive": true }
  ]
}
```

### Proposed battery metrics (B1–B5, for ratification)

- **B1 discovery/convergence:** statement- + edge-level Jaccard across ≥2
  independent extractions.
- **B2 minimal sufficiency K\*:** accuracy vs |invariant set| sweep; report the
  floor where accuracy plateaus.
- **B3 ablation:** derivation-accuracy delta of structural-role removal vs
  random-token removal at equal token cut.
- **B4 projection vs retrieval:** reuse the live `/api/public/irl/invariant-field`
  (already built) vs the lexical retriever on selection-sensitive tasks.
- **B5 field vs co-occurrence:** graph-structure metrics (degree distribution,
  compressibility) of the invariant field vs a co-occurrence graph on the same
  corpus.

All arms report medians + bootstrap 95% CIs (10k resamples), ≥5-point threshold —
shared stats module with P1/P3.

---

## Shared build (once any of the above is ratified + sealed)

- A **bootstrap-CI + rubric-judge module** (`services/experiments/stats.ts` +
  reuse of the `--judge-config` blind judge) — used by P1, P2, P3.
- Each runner mirrors the shipped EXP-P3/D1 pattern: a service that runs the arms
  over a **sealed** dataset, a route gated admin-OR-entitled, a runner component
  with an honest "awaiting sealed dataset" empty state, and no fabricated numbers.

## Next step for the operator

Review + ratify (or correct) the metric definitions and dataset schemas above.
For each experiment you seal a dataset for, the runner is then a mechanical build
(1–2 of the shared organs already exist). Flag which to build first.
