# CFS-046 — The Invariant Reasoning Cycle (Inference as Midpoint)

**Status: `ratified` (operator, 2026-07-19 — all five checklist items, including explicit confirmation of the doctrine/hypothesis placements: doctrine candidates 1–4 enter as doctrine; the unit-of-intelligence and compounding time-to-value claims enter as `proposed`). Doctrine-capture over a running mechanism: the cycle described here is already implemented (CFS-045 + A1 + A2 closed the loop on 2026-07-19); this spec names it, locates inference within it, and separates the ratifiable doctrine from the `proposed` hypotheses. EXP-014 is chartered and runs once the trajectory corpus reaches ~200 rows.**
Source: operator synthesis + Aletheon's cycle framing (2026-07-19), reflecting on the memory workstream and the pre-inference compression conversation with Austin's agent.

---

## The conceptual shift

The pre-inference compression workstream asks: *what is the smallest coherent
substrate we can provide to the model before inference?* That question remains
valuable — but it treats the model as the reasoning engine and inference as
the beginning and end of the system. The memory workstream revealed the
larger architecture:

```
Experience
    ↓
Pre-Inference Compression        (IRE resolution, retrieval, projection)
    ↓
Model Inference                  (generative reasoning, composition)
    ↓
Post-Inference Compression       (validation, invariant extraction, memory compilation)
    ↓
Constitutional Memory            (substrate + trajectories + evidence)
    ↓
Observer Evolution               (partnership metrics, invariant-model modelling)
    ↓
Better Pre-Inference Compression (the loop closes)
```

**Inference is the transform in the middle of a larger intelligence cycle —
not the product of the system.** The LLM is one computational stage within an
invariant reasoning architecture, not the intelligence itself.

## Doctrine candidates (ratifiable now — statements about how the runtime works)

1. **Inference is the midpoint, not the product.** The product of an
   interaction is not the response; it is an improved reasoning substrate.
   Every interaction has two outputs: the immediate answer (serving the
   current interaction) and a better invariant foundation (serving every
   future interaction).

2. **Compression is a property of the entire cycle, not a preprocessing
   step.** Before inference the reasoning substrate is compressed; during
   inference the model composes over it; after inference the outcome is
   compressed into durable knowledge. This resolves the standing question
   "where does reasoning compression actually happen": everywhere.

3. **The system breathes.** The canonical rhythm is expand–contract:
   pre-inference compresses knowledge, inference generates possibilities,
   post-inference compresses learning. (Extends the Three Computational
   Compressions doctrine with its dynamic form.)

4. **The runtime improves without retraining.** A conventional LLM starts
   each conversation with approximately the same capabilities. This runtime
   does not: every completed reasoning cycle can improve the next one — the
   model may stay fixed while the reasoning ecosystem evolves. The mechanism
   of improvement is the substrate, not the weights.

## Hypothesis candidates (`proposed` — claims about the world, experiment-gated)

- **The unit-of-intelligence hypothesis:** *intelligence is not the inference
  step; intelligence is the closed-loop process that continually improves
  both the substrate entering inference and the substrate that emerges from
  it.* Under this view an inference is analogous to a single metabolic
  reaction inside a living organism — essential, but not the organism. The
  true unit of intelligence is a complete reasoning cycle. This is a
  foundational-principle *candidate* for the research programme; it is a
  claim about the nature of intelligence and remains `proposed` (alongside
  inv.reasoning.323/329–333) until evidence accumulates.

- **The compounding time-to-value hypothesis:** invariant intelligence
  compresses time to value (PoTS) at every point of the cycle — less
  irrelevant context pre-inference, higher-quality reasoning during, and
  reusable substrate after — so value compounds across cycles rather than
  resetting per interaction. Empirical; see EXP-014.

## Implementation witness (why this is capture, not speculation)

| Cycle stage | Running implementation |
|---|---|
| Pre-inference compression | IRE `resolveConstitutionalField` per message (Phase 2); memory retrieval (CFS-045); L2 corpus refs; session invariants |
| Inference | Model Router / provider chain; smart-triad ground block composition |
| Post-inference compression | Memory Compilation pass via `after()` — taxonomy outcome + trajectory + evidence (CFS-045/A1/A2) |
| Constitutional memory | `memory_invariants` (substrate) + `reasoning_trajectories` (how) + `evidence` (why trusted) |
| Observer evolution | Partnership metrics (A1); observer-modelling slice consumes substrate + trajectories (next in sequence) |
| Loop closure | Retrieval feeds compiled memory back into the next turn's ground truth |

## Relation to prior canon (reconciliation, not duplication)

- **CFS-031 Constitutional Cybernetic Loop** described the macro
  feedback architecture; CFS-046 locates *inference* precisely within it and
  names the midpoint principle.
- **Three Computational Compressions** (canonized doctrine) gave the static
  taxonomy; CFS-046 adds the dynamic rhythm (the breathing cycle).
- **Reasoning-compression locus** (Phase 23 ratification) relativised where
  compression happens; CFS-046 resolves it: compression is cycle-wide.
- **Austin's pre-inference compression workstream** is contextualized, not
  invalidated: it measures the effectiveness of a compressed substrate at a
  point in time ("how much reasoning can we pre-pay before the model
  runs?"); CFS-046 studies how the pre-paid substrate itself evolves through
  repeated cycles ("how do we continuously increase what is pre-paid?").
  Complementary questions — point-in-time effectiveness vs longitudinal
  evolution.

## EXP-014 — Cross-cycle substrate improvement (chartered, not run)

- **Hypothesis (proposed):** as reasoning cycles accumulate for a
  (persona, cartridge), measurable inference efficiency improves — smaller
  activated-invariant sets to reach coherent conclusions, higher share of
  memory-grounded turns, and reduced rediscovery (the EXP-003 savings
  measured longitudinally rather than at a point in time).
- **Method:** longitudinal observation over the trajectory + substrate
  corpus once ≥200 trajectories exist; compare early-cycle vs late-cycle
  cohorts on activated-set size, outcome productivity, and grounding
  composition. Complements EXP-011 (memory representation), EXP-012
  (derivation mode), and EXP-013 (trajectory recurrence).
- **Discipline:** canonical pipeline; proxies with model config; no
  entanglement with structural-thesis evidence.

## Ratification checklist (operator)

1. Ratify doctrine candidates 1–4 (midpoint principle, cycle-wide compression, the breathing rhythm, substrate-not-weights improvement).
2. Register the unit-of-intelligence hypothesis as `proposed` (foundational-principle candidate, evidence-gated).
3. Register the compounding time-to-value hypothesis as `proposed`.
4. Approve chartering EXP-014 (runs once the trajectory corpus reaches ~200 rows).
5. Confirm the reconciliation reading of CFS-031 / Three Compressions / reasoning-compression locus / the pre-inference compression workstream (contextualized, none invalidated).
