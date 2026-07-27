# EXP-P2 — Consequential Performance (family index)

**Invariant Research Lab (IRL) · Validation Programme series (P1 / P2 / P3 / P4)**
**Experiment ID: IRL-EXP-P2 · Status: FRAMEWORK SET UP — protocols PENDING OPERATOR PROTOCOL**
**Ruling of record: operator, 2026-07-27 (recorded verbatim in §1 below).**

> **This directory carries no experimental protocol.** It carries the *framework* that both
> consequence experiments share, and the index of what is still to come. The operator's words on
> receiving this ruling were: *"I'll provide the protocol presently but in the meantime let's get
> it set up."* Nothing here designs an experiment. Where the ruling gives examples — tasks,
> outcome lists, arm labels — they are recorded **as the operator's examples pending protocol**,
> never as a designed protocol. A later reader must be able to tell the operator's ruling from an
> agent's scaffolding; that is what the `PENDING OPERATOR PROTOCOL` marker exists for.

---

## 1. The ruling — what changed

Until 2026-07-27, EXP-P2 was described as "the consequence experiment": one monolithic protocol.
EXP-P3 established that **representation is itself an experimental variable**. The operator's
ruling:

> "P2 should no longer be one monolithic protocol. It should become **a family of consequence
> experiments** that share the same constitutional framework but operate in different consequence
> domains."

### The constitutional question — unchanged

> "Do invariant-guided representations improve consequential task performance compared with
> conventional documentation under equivalent informational content?"

> "This remains the constitutional question. Everything underneath becomes an instantiation."

## 2. The family

| Id | Instantiation | Consequence domain | Directory | Protocol |
|---|---|---|---|---|
| **EXP-P2** | — (the family; holds the constitutional question and the shared framework) | — | `exp-p2-consequential-performance/` | none, by design |
| **EXP-P2A** | Software Consequences | software engineering outcomes | [`exp-p2a-software-consequences/`](../exp-p2a-software-consequences/README.md) | PENDING OPERATOR PROTOCOL |
| **EXP-P2B** | Physical Consequences | real-world physical construction | [`exp-p2b-physical-consequences/`](../exp-p2b-physical-consequences/README.md) | PENDING OPERATOR PROTOCOL (a prior v1.0 candidate exists — see that README) |

Both instantiations are registered in `EXPERIMENT_REGISTRY` (`types/research.ts`) with
`instantiationOf: 'EXP-P2'`. They are **not** foundational slots: they carry no `programmeFocus`,
and they are not members of the VP1 foundational series. EXP-P2 remains the slot.

## 3. The shared framework — one place, two references

Everything above the experimental domain is written **once**, in
[`01_shared-constitutional-framework.md`](01_shared-constitutional-framework.md). The operator's
ruling is explicit about which concerns those are and that they are identical for both:

> "P2A and P2B should share everything above the experimental domain … **The only thing that
> changes is the domain.**"

P2A and P2B **reference** the framework. They must not restate it. A framework copied into two
documents diverges — that is the `inv.engineering.036` / `inv.engineering.037` defect this repo
spent 2026-07-22 onward eliminating, and it is canary-enforced here
(`tests/source-of-truth-parity.test.ts`).

## 4. The RSS-001 admissibility gate

Every representation entering P2A or P2B must first pass **RSS-001 certification**; only then is
it admissible into the consequence experiment. The gate — with the real RSS-001 section
citations — is §3 of the shared framework. RSS-001 itself lives with EXP-P3:
[`../exp-p3-representation-of-structural-invariants/03_RSS-001_representation-science-standard.md`](../exp-p3-representation-of-structural-invariants/03_RSS-001_representation-science-standard.md).

## 5. Two views of the programme — both true, neither a renumbering

The ruling records two complementary views. They answer different questions and must never be
collapsed into one another.

### 5.1 Conceptual sequence — the programme numbering, UNCHANGED

```
P1 Compression  →  P2 Consequence  →  P3 Representation  →  P4 Interaction
```

> "**The programme numbering should remain P1 → P2 → P3 → P4** because it reflects the conceptual
> progression of the research questions."

The registry preserves this: `SERIES_REGISTRY` VP1 members remain `['EXP-P1', 'EXP-P2', 'EXP-P3',
'EXP-P4']`, in that order, and no P-slot was renumbered by this ruling.

### 5.2 Methodological dependency — RSS-001 is the enabling standard

```
P1 Reasoning Compression → P3 Representation Science → RSS-001 Certification
   → P2 Consequential Performance (P2A Software · P2B Physical) → P4 Interaction
```

> "P3 should become a prerequisite for P2. Originally the flow was P1 → P2 → P3 because we didn't
> yet know whether representation mattered. **Now we do.**"
>
> "However, the **methodological dependency now runs through P3**: every future consequence
> experiment should use the representation certification framework established there."

### 5.3 The distinction — read this before citing either diagram

**§5.2 is not a renumbering, and it does not reorder the programme.** A reader who takes the
dependency graph as the programme order would conclude that P3 comes before P2 in the series,
which the ruling explicitly denies in the same breath that it states the dependency. The numbering
is about the *progression of research questions*; the dependency is about *which method a later
experiment must adopt*. One is conceptual, one is methodological. Both are recorded; neither
overrides the other.

This is consistent with, and does not supersede, the operator's earlier recorded reframing that
the programme is cybernetic rather than sequential — "P3 doesn't come after P2. P3 continually
refines the representation used by P1 and P2" (`CFS-053_constitutional-binding.md` §10.0b). That
statement and §5.2 here are the same observation seen from the method side.

> "The research is cumulative: later experiments don't merely answer new questions, **they improve
> the scientific rigor of earlier experimental families.**"

## 6. What this framework does NOT contain — PENDING OPERATOR PROTOCOL

Named explicitly so no reader mistakes an absence for a decision:

| Missing | Who supplies it |
|---|---|
| The P2A experimental protocol (task corpus, procedure, execution plan) | operator |
| The P2B experimental protocol, revised under this ruling | operator |
| Arm specifications beyond the ruling's A–E labels | operator |
| The statistical analysis plan (shared framework §4) | operator |
| The decision procedure — RSS-001's "Section DP" binding target (shared framework §5) | operator |
| The constitutional principles enumerated for the family (shared framework §1) | operator |
| Power analysis, sample sizes, thresholds, any ⟦ ⟧ parameter freeze | operator |

## 7. Standing of what IS recorded here

Every P2 hypothesis is an empirical hypothesis under test. Per the IRL Hypothesis vs Canon
discipline it enters and remains `proposed` until the registered decision procedure produces
supporting evidence; nothing in this directory may be cited as an established result.

## 8. Downstream consequence — CFS-053 Law XVII

`CFS-053_constitutional-binding.md` §10.0 holds Law XVII (Constitutional Binding) at `proposed`
until **three** conditions hold:

> "**CFS-053 therefore stays `PROPOSED`** until all three hold: P2A exists; software consequence is
> formally in the programme; at least one experimental result supports the principle."

This directory establishes the **first** condition: EXP-P2A exists as a registered experiment with
a directory and a declared consequence domain. It does **not** establish the second or the third —
software consequence is formally in the programme only once the operator's P2A protocol is
ratified into it, and no experimental result exists at all. Law XVII therefore remains `proposed`,
and this document must not be cited as evidence for it.
