# CFS-045-A1 — Partnership Memory Amendment (Memory Belongs to the Collaboration)

**Status: `ratified` (operator, 2026-07-19 — all five checklist items). v1.1 BUILT the same day: migration `20260731000000_memory_invariants_validation.sql` (operator must run it with the base table SQL), `validateMemoryInvariant` + `partnershipMetrics` in the memory service, `PATCH /api/memory/invariants` (validate/reject), retrieval priority + `[validated]` ground-block labels, and the full machine-guard set (refute never auto-retires a validated row; merge/split/compaction never consume one). EXP-012 remains chartered-not-run.**
Source: operator observation + Aletheon's partnership-memory framing (2026-07-19), immediately following the CFS-045 v1 build.

---

## The reframing

CFS-045 v1 was framed as *the operator's* compiled memory. This amendment
corrects the ownership model: **the memory is not the AI's memory, and it is
not merely the human's profile — it is the memory of the collaboration.**

The loop the runtime actually implements is:

```
Human intent → Joint reasoning → Inference → Invariant extraction
     → Constitutional memory → Improved joint reasoning
```

The human contributes intent, judgment, domain knowledge, values, and
validation. The runtime contributes retrieval, composition, inference,
compression, and consistency. **Neither alone produces the stored invariant —
it is a co-created artifact.** This is hybrid intelligence operating, not as
a thesis but as a running mechanism: every interaction incrementally improves
the shared reasoning substrate from which future reasoning begins.

## Constitutional principle candidate (doctrine — ratifiable now)

> Persistent constitutional memory records validated products of
> human–machine reasoning rather than the outputs of either participant
> alone.

This is what distinguishes the substrate from both a chatbot history and a
conventional knowledge base: it is the accumulated reasoning of the
partnership.

## The memory state machine (supersedes v1's machine-only promotion)

v1 promotes `candidate → active` on two machine confirmations. That
conflates *re-evidenced inference* with *ratified memory*. The amendment
introduces the full lifecycle, mirroring the research discipline (discover →
validate → ratify → reuse):

```
candidate  →  human-reviewed  →  validated  →  compressed  →  persisted  →  reused
```

Implementation as a **two-tier promotion**, so memory remains useful without
making human review a bottleneck:

| Tier | How it is reached | Standing |
|---|---|---|
| `active` (machine-promoted) | 2+ independent machine confirmations (v1 behaviour, retained) | Working inference — usable, clearly labelled, freely compactable |
| `validated` (human-ratified) | The operator explicitly approves the invariant in the self-view | Ratified partnership memory — retrieval-priority, protected from machine retirement |

The validation step is constitutionally load-bearing: **only the human can
ratify, and only the human can retire what a human has ratified.** Machine
compaction may merge/retire `candidate` and `active` rows; it must never
touch `validated` rows.

### v1.1 build scope (on ratification)

1. **Migration** — add to `memory_invariants`: `human_validated boolean NOT
   NULL DEFAULT false`, `validated_at timestamptz`.
2. **Validation surface** — `PATCH /api/memory/invariants` (owner
   self-view): `{ id, action: 'validate' | 'reject' }`. Validate ⇒
   `human_validated = true`, `status = 'active'`, confidence floor 0.8.
   Reject ⇒ `status = 'retired'` (human rejection is immediate, no
   two-strike rule).
3. **Retrieval ordering + labels** — human-validated first; the ground block
   annotates `[validated]` vs `[active]` vs `[candidate]` so the model
   weights partnership-ratified memory above working inference.
4. **Compaction guard** — `compactMemory` excludes `human_validated` rows
   from merge/retire ops.
5. **Partnership metrics (observer feed)** — computed from the substrate, no
   new writes: acceptance rate (validated ÷ reviewed), revision rate
   (refuted/merged ÷ total), per-cartridge stability (share of validated).
   These are properties of the hybrid system, not of either participant —
   the observer-modelling slice consumes them to model *the evolution of the
   partnership*, not just the user.

## EXP-012 — Invariant quality across reasoning modes (chartered, not run)

A new, scientifically testable comparison the platform has not articulated
before. **The comparative claim stays `proposed` until evidence exists**
(hypothesis-vs-canon discipline):

- **Hypothesis (proposed):** hybrid derivation (runtime proposes, human
  critiques, convergence before persistence) yields invariants of higher
  stability and downstream reasoning quality than either human-only or
  machine-only derivation, at comparable compression.
- **Arms:** (A) human-only — experts derive invariants manually; (B)
  machine-only — the runtime derives autonomously; (C) hybrid — propose /
  critique / converge / persist.
- **Metrics:** stability · compression · propagation fidelity · downstream
  reasoning quality · reproducibility.
- **Discipline:** canonical experiment pipeline; metrics reported as proxies
  with model config; no entanglement with structural-thesis evidence.

## Relation to the Hybrid Intelligence Thesis

inv.reasoning.329–333 (the Hybrid Intelligence Thesis, `proposed`) gains its
first *operational* instantiation here: the memory substrate is a running
record of hybrid reasoning products. EXP-012 results bear on the thesis's
evidence base — but per the discipline, running the mechanism is not itself
evidence for the thesis; only the controlled comparison is.

## Ratification checklist (operator)

1. Ratify the partnership-memory principle (doctrine).
2. Approve the two-tier promotion model (machine-promoted `active` retained; human `validated` tier added).
3. Approve the human-sovereignty rule: compaction never touches validated rows; only the human retires them.
4. Approve v1.1 build scope §1–5.
5. Register the EXP-012 hypothesis as `proposed`; approve chartering EXP-012.
