# IRL-016 — Experimental Freeze & Protocol Governance

**metaMe IRL — Invariant Research Laboratory · Governance specification · `canonical` (operator-ratified 2026-07-21)**
**Governing invariants:** `inv.reasoning.346` (frozen success criteria), `.347` (the three constitutional objects), `.348` (freeze the instrument before the result), `.349` (derived-domain honesty), `.350` (reviewer independence / role separation); `inv.polity.162` (verified over claimed).

> **Designation note.** Aletheon proposed this artifact as "IRL-012". That number is taken (`IRL-012_austin-feedback-integration.md`); per the no-number-reuse rule it is issued as **IRL-016** (next free in the IRL series). Both you and the external reviewer's agent were already *behaving* as though this document existed — formalising it removes the ambiguity for every future collaboration.

## 1. Purpose

Define, once, the governance of an experiment's life: what may change before freeze, what may not change after, the distinction between a reviewer recommendation and a protocol amendment, and the separation of roles that keeps an independent review independent. This is the constitutional frame the Validation Programme (EXP-P1/P2/P3) and every future joint experiment run inside.

## 2. The experiment lifecycle (order is meaning)

```
proposal → design → FREEZE (signature + hash) → execution → interpretation → successor experiment
```

- **Proposal / design** — hypotheses, arms, metrics, controls, the interpretation table, and materials are authored and revised. Reviewer challenge is most valuable here.
- **Freeze** — joint signature + hash commitment of the pre-registration bundle. The moment the protocol becomes immutable for this run.
- **Execution** — arms are built and run against the frozen materials.
- **Interpretation** — outcomes are read against the *pre-signed* interpretation table only.
- **Successor experiment** — new hypotheses and any protocol changes (including reviewer contributions that alter the design) are carried forward into the *next* protocol, never back into this one.

## 3. What may change BEFORE freeze

Everything that is not yet signed: hypotheses, predictions, arms, task-set construction rules, materials, the crystal/collection, the interpretation table, metrics, judge/model pins, and the controls. Pre-freeze is the design phase; revision here is normal and expected. Enlarging a collection, tightening a control, or adopting a reviewer's constraint principle all happen here.

## 4. What may NOT change AFTER freeze

Nothing that was signed. Specifically, and without exception:

- **Success criteria / the interpretation table** (`inv.reasoning.346`): an experiment may generate new hypotheses but may not redefine what counts as success after observation. An outcome's meaning is whatever the signed §12 table says it is.
- **The instrument** (`inv.reasoning.348`): judge, target model, and rubric are fixed; they are not "improved" mid-stream.
- **The materials**: crystal snapshot, exporter, arms, task set, and answer keys are hash-pinned. A post-freeze change *voids* the affected component and is logged, never silently applied.
- **The observation** (`inv.reasoning.347`): the record of what happened is immutable once produced.

## 5. Reviewer recommendation ≠ protocol amendment (`inv.reasoning.350`)

The independent reviewer's role is to **evaluate, challenge, and replicate** — not to co-design or jointly optimise the protocol before execution. This preserves the independence that makes the review worth having.

- A reviewer **recommendation** is an *input* to the design. The originating team may adopt it — as a **constraint principle** (e.g. "the fixed slice must be a genuine subset and live selection must retain discriminatory power"), never as reviewer *authorship* of a specific design parameter.
- Adopting the *principle* is legitimate; freezing the reviewer's *number* into the design is not — the exact value is an implementation parameter the originating team determines from the experimental constraints (EXP-P1 §3 was corrected on exactly this point: the ⊆40% subset principle is binding; a specific crystal size is not).
- A reviewer contribution that would **change the protocol itself** belongs to a **successor experiment**, after the current one concludes — never as a back-door amendment to a running or frozen protocol.

**Role separation (the constitutional boundary):**

| Role | Responsibility |
|---|---|
| Originating research team (IRL) | Designs the protocol, decides implementation parameters, and freezes it. |
| Independent reviewer | Evaluates, challenges, replicates, and attempts to falsify the frozen protocol. Sees the domain boundary, not the crystal contents, before freeze. |
| Successor experiment | Incorporates reviewer feedback and new hypotheses *after* the current protocol concludes. |

## 6. Why this matters

If too much of a protocol is co-designed with its reviewer, the review is no longer independent and the falsification test loses its force. The separation is not about excluding the reviewer — the reviewer is becoming part of the *apparatus*, which is a milestone — it is about keeping the review a review. Held together with the frozen-protocol discipline (`346–349`), this is likely to become one of the Institute's strongest scientific practices: the programme evolves freely from one experiment to the next, while each individual experiment stays incorruptible.

## 7. Standing note

This document governs process, not findings. It is `canonical` because it states *how the Institute runs experiments* — method and governance doctrine, not an empirical claim under test.
