# EXP-P2 — Consequential Performance (family index)

**Invariant Research Lab (IRL) · Validation Programme series (P1 / P2 / P3 / P4)**
**Experiment ID: IRL-EXP-P2 · Registered causal construct: Condition-Directed Gated Verification Workflow**
**Status: v0.5 filed · architecture settled · PREREGISTRATION NOT YET AUTHORIZED**

> **The authoritative text is [`02_protocol-v0.5.md`](02_protocol-v0.5.md).** This index does not
> restate it. It records the ruling that created the family, the map of the document set, and the
> two views of the programme — the only things that are not v0.5's to hold.

---

## 1. The ruling that created the family

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

v0.5 §3 states the primary scientific question in the registered mechanism-level vocabulary that
must carry every confirmatory headline (v0.5 §7.3). The constitutional question above is the
programme-facing framing; **it is not the registered claim**, and the two must not be swapped.

## 2. The family

| Id | Instantiation | Consequence domain | Domain protocol | Directory |
|---|---|---|---|---|
| **EXP-P2** | — (the family; holds the constitutional question and the protocol) | both | v0.5 whole | `exp-p2-consequential-performance/` |
| **EXP-P2A** | Software Consequences | software engineering outcomes | **v0.5 §19** | [`../exp-p2a-software-consequences/`](../exp-p2a-software-consequences/README.md) |
| **EXP-P2B** | Physical Consequences | real-world physical construction | **v0.5 §20** | [`../exp-p2b-physical-consequences/`](../exp-p2b-physical-consequences/README.md) |

Both are registered in `EXPERIMENT_REGISTRY` (`types/research.ts`) with
`instantiationOf: 'EXP-P2'`. They are **not** foundational slots: they carry no `programmeFocus`
and are not members of the VP1 foundational series. EXP-P2 remains the slot. v0.5 §9 makes them
**independently confirmatory** domains, and v0.5 §9.3 bars any additional domain from entering the
confirmatory claim after either domain's results are known.

## 3. Document set

| File | What it is |
|---|---|
| [`02_protocol-v0.5.md`](02_protocol-v0.5.md) | **AUTHORITATIVE.** The full protocol — Parts I–X (§§1–50), Appendices A–D. Filed verbatim. |
| [`03_operational-amendment-v0.5.md`](03_operational-amendment-v0.5.md) | Amendment 1 — W2.5 diagnostic cell · four feasibility gates · the unresolved stopping-rule item · three recorded observations |
| [`04_statistical-analysis-plan-skeleton.md`](04_statistical-analysis-plan-skeleton.md) | SAP skeleton — structure frozen, every number unresolved |
| [`01_shared-constitutional-framework.md`](01_shared-constitutional-framework.md) | Pointer index mapping the ruling's seven shared concerns to the v0.5 sections that own them |
| [`05_v0.2-recovered-historical-draft.md`](05_v0.2-recovered-historical-draft.md) | **RECOVERED HISTORICAL DRAFT · NON-NORMATIVE.** EXP-P2 v0.2 (22 July 2026), recovered 2026-07-28 from operator-supplied text. Never contemporaneously canonized; does not govern execution. Recovered so that amendment §A6.1's citation of "v0.2 §38" can be checked against real text. |

**No document in this set other than v0.5 holds normative protocol content.** A canary in
`tests/source-of-truth-parity.test.ts` fails the build if any of them reproduces a normative
sentence of v0.5.

## 4. RSS-001 in EXP-P2 — narrower than the family ruling first stated

The ruling that created the family made RSS-001 certification an admissibility precondition in five
steps. **v0.5 §14 narrows RSS-001's P2 role to three functions** — atomic decomposition,
within-modality equivalence audit, completeness and consistency certification — and states that it
"does not serve its P3 role of comparing different representational substrates." v0.5 governs. The
supersession, and which RSS-001 sections remain in play, are recorded in
[`01_shared-constitutional-framework.md`](01_shared-constitutional-framework.md) §3.

## 5. Two views of the programme — both true, neither a renumbering

The ruling records two complementary views. They answer different questions and must never be
collapsed into one another. v0.5 §2 carries the same distinction.

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

v0.5 §2 states it in the protocol's own words: the conceptual sequence remains
Compression → Consequence → Representation → Interaction, while "the methodological dependency is
not strictly sequential." This is consistent with the operator's earlier recorded reframing that
the programme is cybernetic rather than sequential — "P3 doesn't come after P2. P3 continually
refines the representation used by P1 and P2" (`CFS-053_constitutional-binding.md` §10.0b).

> "The research is cumulative: later experiments don't merely answer new questions, **they improve
> the scientific rigor of earlier experimental families.**"

## 6. What is not yet resolved

v0.5's own candidate disposition: **architecture settled · protocol engineering incomplete until
Appendix C is resolved · preregistration not yet authorized.**

| Outstanding | Where |
|---|---|
| 20 unresolved parameters requiring freeze | v0.5 Appendix C |
| 21 distinct `⟦…⟧` placeholders in the protocol text | v0.5, throughout |
| Programme stopping-rule decision point | **STILL UNRESOLVED, but for a narrower reason as of 2026-07-28.** Amendment §A6.1 said its source documents "are not present in this repository". **v0.2 is now present** — recovered verbatim from operator-supplied text as [`05_v0.2-recovered-historical-draft.md`](05_v0.2-recovered-historical-draft.md), where §38 is the programme-level stopping rule the amendment cites. Recovery is not ratification: v0.2 was never canonized, so §38 is historical evidence, not a governing provision. Resolving this now requires an operator act — either bind §38 (stating how a rule written for the A/B/C/B+R/D arms and a single physical substrate applies to v0.5's W0–W3 ladder and its two independent domains), or author a new stopping rule. The **v0.3 binding is still absent** and no reconstruction of it has been attempted. |
| Correctness-at-cost treatment in cross-domain aggregation | v0.5 §41 delegates it to the SAP; Appendix C item 20 |
| Placeholders introduced by the amendment | amendment §A1.5, §A2, §A3, §A4, §A5 |
| Pilot design and parameter resolution (artifact 3) | not started — requires the operator |
| Sealed pilot report (artifact 4); SAP freeze and preregistration (artifact 5) | not started |

## 7. Standing

Every P2 hypothesis is an empirical hypothesis under test. Per the IRL Hypothesis vs Canon
discipline it enters and remains `proposed` until the registered Decision and Falsification
Procedure (v0.5 Part IX) produces supporting evidence. Nothing in this directory may be cited as an
established result, and v0.5 §7.2 lists the claims EXP-P2 may never support at all.

Null and adverse findings are first-class outcomes here: v0.5 Principle VII (null symmetry) and
Principle IX (adverse-result priority) are protected elements, and v0.5 §43 records that "a null or
falsifying result is a valid completion of EXP-P2."

## 8. Downstream consequence — CFS-053 Law XVII

`CFS-053_constitutional-binding.md` §10.0 holds Law XVII (Constitutional Binding) at `proposed`
until **three** conditions hold:

> "**CFS-053 therefore stays `PROPOSED`** until all three hold: P2A exists; software consequence is
> formally in the programme; at least one experimental result supports the principle."

**The first two now hold.** P2A exists as a registered experiment, and v0.5 §19 puts software
consequence formally in the programme as an independently confirmatory domain with its own protocol.
**The third does not**, and is furthest from holding: no experiment has run, v0.5 is a candidate
awaiting final adversarial review, and preregistration is not yet authorized. Law XVII therefore
remains `proposed`, and nothing in this directory may be cited as evidence for it.
