# CFS-035 — The Invariant Engine: constitutional runtime, the layer × surface matrix, and the Field Snapshot

**Status:** Ratified (charter) — ratify-before-build gate for the invariant-engine workstream.
**Date:** 2026-07-18
**Depends on:** CFS-000 §1 (Compression Theory), CFS-008 (Reasoning Compression), CRP-002 (intent as a projection operator), IRL-011 §6.3 (`K*`), CFS-019 (IRL charter + the three layers + the structural/constitutional and three-functions amendments), CFS-017 (observe-mode-first seam), CFS-020 (DCIR adoption seam), CFS-021 (representation invariants), `types/constitutional.ts` (the six Constitutional Reasoning Services).
**Origin:** the three-way convergence (operator × Aletheon × Claude, 2026-07-18) on making the entire agentic platform invariant-intelligent. This charter is the ratification gate; **no engine code lands until it is ratified.**

---

## 1. The governing law

> **Every consequential decision should be a projection of the constitutional field, not an isolated heuristic.**

This is the central rule the whole workstream serves. It unifies prompt grounding, magic numbers, journey progression, standing, ranking, and routing as instances of one thing: a decision *projected* from the validated invariant field, cited and standing-ranked, rather than an operator-guessed constant. It gives a concrete, finite, code-searchable directive (§2), and it independently re-derives the already-ratified **projection-operator** doctrine (CRP-002: intent projects knowledge onto the minimal governing set; IRL-011 §6.3: `K*` is the object the discipline optimizes). Convergence noted in the Convergence Log.

**Axis-precision (binding, per CFS-019):** "constitutional runtime" spans **Layers II/III** (governance engineering). The invariant substrate/field is **Layer I** (the science). The engine *reasons from* structural invariants and *governs with* constitutional ones; "everything constitutional" is the right spirit but must never collapse the register.

---

## 2. The wedge — four forms of compressed reasoning

Most of the platform's intelligence is embedded, **uncaptured** compressed reasoning (CFS-008: reasoning that was done once and frozen, with no provenance, standing, reuse, or accrual). It takes four code-searchable forms, each an unstated invariant:

1. **Magic numbers** — `+10`, `0.7`, `120` (`scoreCapsule` weights, NBE `weight`s, Standing coefficients).
2. **Thresholds** — `if confidence > 0.8`, `if standing > 100`, `if rank > 4`.
3. **Hard-coded branches** — `if founder → founder dashboard else citizen` (journey disposition switch, Aigent-C/Z ternary, active-interpretation default).
4. **Ordering** — every `sort()` / `priority` / `rank` / `next` / `best` / `top` / `recommended`. The largest class.

**The inversion the engine performs:** `Invariant → Projection → weight / threshold / branch / ordering → Decision` replaces `hidden reasoning → magic number`. **The candidate rule:** every ranking, threshold, branch, or ordering in the codebase is a candidate to migrate from embedded heuristic to constitutional projection. The set is finite and enumerable — it decomposes the effort into a measurable list of **Invariant Decision Nodes** (§6).

---

## 3. Constitutional Projection

The engine does not *retrieve policy*; it **projects constitutional state into executable decisions** — weights, thresholds, priorities, routing, permissions, rankings, UI, delegation, recommendations. "Constitutional Projection" is the canonical name for this face (it supersedes the working term "policy grounding"), and it is deliberately the same word — *projection* — the ratified corpus already uses for intent → invariant set.

---

## 4. The three runtime levels

| Level | What | Status in code |
|---|---|---|
| **1 — Invariant Registry** | Truth: definitions, ontology, research, the field graph | **Exists** — `services/invariants/store.ts` + `canonical-invariants.seed.json` + `index.ts`; `invariant_edges` + `services/research/invariantFieldQuery.ts` |
| **2 — Invariant Engine** | Projection: the four faces (§5) over one Field Snapshot | **Partly exists** — ~80% composition of existing façades + the new pieces (§10) |
| **3 — Invariant Operating System** | Everything consumes the engine: search, planner, memory, artifact, journey, UI, research, commerce, governance, agents, Studio, Founder Office, Passport | **The rollout** — surfaces delegate via the seam (§9) |

**The keystone discipline:** *the engine stays constitutional; the OS composes it.* Application logic never accretes inside the engine — Level 3 consumers compose Level 2 projections. This is the guardrail that keeps a single source of constitutional truth from rotting into a god-object, and it is the same "compose, never fork" law the DCIR seam and `runArtifact` already embody.

---

## 5. The engine's four faces + the Field Snapshot

The engine computes **one Field Snapshot per intent/request** — the shared interface every consumer reads. This is the fix for today's fragmentation, in which every consumer hand-rolls its own `GroundingContext` and calls `buildInvariantSlice` independently. Over that snapshot sit four faces:

1. **Reasoning** — LLM ← invariant slice → better reasoning. *Exists* (NBE rerank, specialist router, `runArtifact`, ontology resolver); consolidated through `groundReasoning`.
2. **Constitutional Projection** — decision → projection → weight/threshold/branch/ordering → execution. *New* (`resolvePolicy`). The wedge.
3. **Experience** — field → UI / journey / recommendations / progressive sovereignty. The **field-based, not role-based** interface: two personas with identical experience can see different systems because their constitutional state differs.
4. **Evolution** — outcome → reflection → standing → receipts → invariant learning. The scientific-instrument face; without it the runtime never gets smarter. Realized as the shadow loop + `services/invariants/measurement.ts` + `recomputeStanding`, made continuous.

Together the four faces finally give the six Constitutional Reasoning Services in `types/constitutional.ts` (Intent, Context, Capability, Consequence, Validation, Receipt) a single runtime that composes them — plus the Perception and Evolution bookends (§6).

---

## 6. The Invariant Decision Node (the research ↔ engineering bridge)

Every consequential decision the engine governs is formalized as a **node** with a rigorous, measurable schema — not a loose label. This is what makes the constitutional surface finite, receipted, and experimentally testable while invariant *discovery* continues independently.

```
InvariantNode {
  inputs          // the context signals — e.g. query, standing, intent, authority, evidence
  projection      // the invariant dimensions projected — e.g. importance, novelty, trust, need
  outputs         // the decision — e.g. ranking / weight / threshold / disposition / route
  receipts        // "why this decided this way" — the cited invariant ids (Reach accrual)
  metrics         // observable outcome — e.g. CTR, selection, task success
  standingEffects // did the decision improve the outcome? — feeds the Evolution face
  lens?           // which pathway lens shaped the projection (§8)
}
```

Every node is thereby an **experiment**: receipted, A/B-able against the incumbent heuristic it replaces, with outcome metrics that feed the Evolution face. The platform's decision surface becomes a measurable constitutional instrument.

### The layer × surface matrix (the node library)

Two orthogonal decompositions over one field. **Cognitive layers** (Aletheon — *what function*): Perception → Interpretation → Memory → Planning → Execution → Reflection → Experience → Evolution. **Product surfaces** (*where the decision is made*): each an embedded-heuristic node today.

| Surface | Embedded form today | Node | Cognitive layers |
|---|---|---|---|
| Discovery ranking (`scoreCapsule`) | magic numbers + ordering | `inv.discovery.*` | Perception / Interpretation / Memory |
| Journey depth / disposition | branches + `array[i+1]` (two unreconciled models) | `inv.progression.*` | whole pipeline → Experience |
| Next-Best-Experience | weights + ordering | `inv.nbe.*` | Planning / Experience |
| Consequence classification | 4 hard-coded rules; gates unimplemented | `inv.consequence.*` | Planning / Execution |
| Standing | coefficients + thresholds | `inv.standing.*` | Reflection |
| Agent routing | weights + branch; grounding opt-in | `inv.routing.*` | Planning |
| Representation / UI | grounded, but branch-selected default + local contract | `inv.representation.*` | Experience |

Reference surfaces already grounded (replicate, do not rebuild): the representation contract (CFS-021), NBE LLM rerank, `runArtifact` (CVR-003), the specialist router when a slice is threaded.

---

## 7. Perception (the one genuinely new component — deferred)

The **Field Extractor** answers "what invariant structures are present in this input?" (document / conversation / email / artifact / API response) — estimating which invariants are present, how strongly, with what evidence. It is the input side of the pipeline (cognitive layers 1–2) and the only substantially new, inference-heavy component; everything else is composition of existing façades. It is scoped to **Generation 3 / Phase 2+** and is explicitly **not** the pilot — the workstream must not over-invest here before the projection wedge is proven.

---

## 8. Invariant Lenses

The same field projects differently per pathway — **a lens is not a separate invariant set; it is a different projection of one field.** Research (maximize discovery, surface contradictions) · Founder/Entrepreneur (maximize progress, reduce uncertainty) · Citizen (maximize clarity, simplify choices) · Developer (maximize observability, expose runtime) · Creative (maximize inspiration, preserve intent). Lenses map **1:1 to the five `OperatorArchetype` pathways** (`services/iqube/experienceQube.ts` — citizen · entrepreneurial · technical · creative · research). The lens is how the Experience face renders the field-based interface and the mechanism by which each pathway is a projection of the same constitutional field. `lens` is a projection parameter on every node.

---

## 9. The three generations

- **Gen 1 — Grounded Reasoning:** invariant slices in prompts/planning. *Largely underway.*
- **Gen 2 — Constitutional Projection:** replace magic numbers, thresholds, branches, ordering with projections. **The current wedge** — where the distinctive, under-served, *measurable* value is right now.
- **Gen 3 — Emergent Intelligence:** the field is the substrate from which behaviour emerges; gated on the Field Extractor (§7). *The endgame.*

Not a hierarchy — a temporal arc. Reasoning grounding is not lesser; it is Gen 1, mostly done. Projection is Gen 2, the current move. Emergence is Gen 3.

---

## 10. The reference first node — Discovery Ranking (Phase 0 pilot)

The first node built, and the charter's canonical worked example. Today `scoreCapsule()` (`app/api/runtime/capsules/route.ts`) is a hand-tuned additive scorer (`+10` deployed, `+6` resolved asset, `+4` smart-content, …) — pure magic numbers + ordering, no standing or invariant grounding.

```
Node: Discovery Ranking
  inputs        : { query, standing, intent, authority, evidence }
  projection    : { importance, novelty, trust, need }     // invariant dimensions
  outputs       : ranking                                   // ordered capsule list
  receipts      : cited invariant ids ("why this ranked")
  metrics       : { CTR, selection, task_success }
  standingEffects: did the surfaced capsule improve the operator's outcome?
  lens          : the active pathway lens
```

It is chosen as the pilot because it is self-contained, obviously numeric, immediately measurable, and needs **no** Field Extractor. It runs in **shadow mode** (§11) alongside the incumbent scorer before any flip.

---

## 11. Rollout discipline (reuse the adoption machine; shadow-first; Evolution is the proof)

1. **Engine core = one pure service seam** — `services/invariants/engine.ts` (Field Snapshot + the four faces), composing existing façades (`grounding.ts`, `ontologyResolver.assembleContextPack`, `modelRouter.callSovereign`, `citeInvariants`). Single source of truth; a parallel implementation is an infraction.
2. **Thin adoption affordances** — a `useInvariantSeam` client hook (mirror `useDcirSeam` / `useSurfaceStyle`) + an additive route seam (mirror the AR tiering adapters). A surface adopts by declaration.
3. **Shadow-mode / observe-first (CFS-017).** Each node runs its projection *alongside* the incumbent heuristic, **receipts the comparison** (projection decision vs magic-number decision), and only a **separate ratification** flips it authoritative once evidence supports it. This is the Evolution face and the measurable demonstration that invariant projection beats heuristics — proven numerically, not rhetorically, and the raw material for the "mathematics of invariants" research.
4. **Per-surface canary** (the zero-literal test template, `tests/irl-dashboard-adoption.test.ts`) proving the surface delegates to the engine and has not reintroduced a raw constant.
5. **Chrysalis tracker** rows — "N named surfaces + frontier," each frontier surface gated by ratify-before-build.
6. **Parallel, always-on:** invariant *discovery* per node's field continues independently; the engine improves as the invariants do. The engine is agnostic to how good the invariants are — it gets better as they do.

**Sequencing:** Phase 0 — engine seam + Field Snapshot + `resolvePolicy` on Discovery Ranking in shadow. Phase 1 — route the already-grounded LLM surfaces through `groundReasoning` (consolidation, no behaviour change). Phase 2 — frontier projection nodes one ratification each (journey, NBE, standing, routing) + the Experience face (lenses) + begin the Field Extractor as its own scoped workstream. Phase 3 — Gen 3 emergent surfaces.

---

## 12. Relationship to the existing canon

- **CFS-008 / CFS-000 §1:** the engine is the operational expression of reasoning compression — it captures the reasoning frozen in heuristics as cited, reusable projections.
- **CRP-002 / IRL-011 §6.3:** "Constitutional Projection" is the same projection-operator the corpus already ratified; the engine is its runtime.
- **CFS-019:** the four faces give the three layers a runtime; the axis-precision guard (§1) is carried from the 2026-07-18 three-functions amendment (compression = substrate / orchestration = projection / governance = runtime).
- **`types/constitutional.ts`:** the six Constitutional Reasoning Services finally get one runtime that composes them.
- **CFS-017 / CFS-020 / CFS-021:** the rollout reuses the observe-mode seam, the DCIR adoption pattern, and the representation-invariant precedent — no new adoption mechanism is invented.

---

## 13. What this charter does NOT do (scope guards)

- **It ships no engine code.** It is the ratification gate; Phase 0 is a separate, later step.
- **It mints no invariant.** The `inv.<namespace>.*` nodes name *where* invariants will govern; the statements are ongoing discovery work.
- **It does not rebuild the substrate.** Level 1 and most of Level 2 exist; the engine is composition + the Field Snapshot + `resolvePolicy` + (Gen 3) the Field Extractor.
- **It does not collapse the layer register** (§1 axis-precision).
- **It does not reconcile the two journey models** — that is a prerequisite flagged for the `inv.progression.*` node, not resolved here.

**Ratified 2026-07-18 by operator direction**, from the operator × Aletheon × Claude three-way convergence. The Phase-0 build (engine seam + Field Snapshot + Discovery Ranking in shadow mode) is authorized to be chartered as a separate increment under this gate.
