# Canonical Completion Rule — PROPOSED

**Invariant Research Lab (IRL) · Governance rule proposed by the operator, 2026-07-28**
**Status: `proposed` — NOT ratified, NOT canon. Enforcement canaries exist regardless (see §4).**
**Scope: experimental drafts, amendments, decision procedures, review findings, stopping rules.**

> **Why this is filed `proposed` and not `canonical`.** The IRL Hypothesis vs Canon discipline
> reserves `canonical` for what the operator has ratified. This rule was *proposed* in session; it
> has not been through a ratification act. Filing it as canon would be the platform asserting its
> own doctrine — precisely the move the rule itself exists to forbid. It becomes canonical when the
> operator ratifies it, and not before.
>
> The canaries in §4 are engineering guards, and engineering guards do not wait for ratification —
> but they enforce the rule's *mechanics*, not its constitutional standing.

---

## 1. The rule (operator's words, verbatim)

> "No experimental draft, amendment, decision procedure, review finding, or stopping rule shall be
> treated as an inherited normative authority unless it has been persisted and registered as a
> canonical platform artifact."

**Corollary:**

> "A review cycle is not constitutionally complete until its accepted output, disposition, and
> protected design elements have been canonized on-platform."

## 2. What problem it closes

EXP-P2 v0.5 is the worked example. Its supersession notice and Appendix A attribute load-bearing
design elements to v0.2, v0.3 and v0.4 — the directed-review control, the content-equivalence audit,
the failure taxonomy, the acceptance threshold, the fabrication anchor, and the programme stopping
rule. When v0.5 was filed, **none of those drafts existed as an artifact anywhere on the platform.**
The lineage column read as provenance but resolved to nothing.

The specific cost was recorded in `exp-p2-consequential-performance/03_operational-amendment-v0.5.md`
§A6.1: an instruction to copy the stopping rule "faithfully from the existing v0.2 §38 and its v0.3
binding rather than reconstructed from memory" could not be executed, because there was nothing to
copy from. A plausible reconstruction would have been indistinguishable from the real thing to every
future reader — the failure mode this rule prevents by construction.

v0.2 has since been **recovered** (`exp-p2-consequential-performance/05_v0.2-recovered-historical-draft.md`),
which demonstrates the rule's other half: **recovery is not ratification.** The text is now
inspectable and still carries no normative authority, because it was never canonized.

## 3. Two dispositions for an uncanonized element

| Disposition | When it applies | What it permits |
|---|---|---|
| **Recovered historical draft** | The text exists and its provenance is traceable | Reading, citing as lineage. **Not** governing, **not** inheritable authority. Must be labelled non-normative. |
| **Attested but unrecovered** | Only a later document's claim that it existed | Naming the claim. **Nothing else.** Must be labelled absent. |

Neither disposition is upgraded by age, by repetition across documents, or by a successor's
confidence. Only a ratification act moves an element into normative standing.

## 4. The six canaries

Proposed by the operator, and their enforcement status in this repository. All enforced canaries
live in `tests/source-of-truth-parity.test.ts` and were verified by mutation — the canary was
broken deliberately, the failure observed, and the file restored.

| # | Canary | Status |
|---|---|---|
| 1 | A document may not claim to supersede a version with no canonical artifact unless it names that version as an uncanonized historical draft | **ENFORCED** |
| 2 | A protected element marked `inherited` must resolve to an inspectable canonical source | **ENFORCED** — against Appendix A's lineage column, which is EXP-P2's inheritance claim |
| 3 | Historically attested but uncanonized elements must be labelled as such | **ENFORCED** |
| 4 | No experiment review cycle may be marked complete until its accepted artifact and disposition are registered | **ENFORCED** — registration means presence in the pack's `collections.json` |
| 5 | A new experiment version may not rely normatively on a missing draft | **ENFORCED** |
| 6 | Completing an experimental protocol must emit a canonical capability/research artifact carrying its protected invariants, decisions and provenance | **CONDITIONALLY ENFORCED** — see §5 |

## 5. Canary 6 — what is enforced, and what needs an operator decision

Canary 6 governs an event that **has not happened**: no EXP-P2 protocol is complete, and v0.5's own
disposition states that preregistration is not yet authorized. A canary asserting "on completion,
emit an artifact" with no completion to observe would be inert — a mechanism that exists and can
never fire, which is the CB-1 defect class (`CFS-053_constitutional-binding.md`).

**What is enforced instead is the conditional:** if any protocol draft in an experiment directory
declares its review cycle complete — its disposition authorizing preregistration — then its accepted
artifact and disposition must be registered in the pack `collections.json`. Today every draft takes
the not-complete branch; the canary fires the moment one flips. That was verified by flipping a
disposition in a scratch copy and observing the failure.

**What requires an operator decision, and is therefore NOT canaried:** the *form* of the emitted
artifact. "A canonical capability/research artifact carrying its protected invariants, decisions and
provenance" could mean a `capability completion artifact`
(`services/constitutional/capabilityCompletionArtifact.ts`), a `ResearchPublication` in
`types/research.ts`, or a new artifact kind. Those are different persistence paths with different
registries and different receipt behaviour. **Choosing one is an operator act**, and writing a
canary against a guessed choice would enforce a decision nobody made. Named here rather than
invented.

## 6. Relationship to existing discipline

This rule generalizes what `inv.engineering.036` does for code — one authoritative location per
concern — to *inherited authority over time*. A citation of a non-existent draft is the temporal
form of the same defect: two things describing one rule, where the one being relied on cannot be
inspected.

It also sharpens the Hypothesis vs Canon discipline. That rule governs *claims about the world*;
this one governs *claims about what has already been decided*. Both fail the same way — an
unratified thing acquiring the authority of a ratified one by being repeated confidently.

## 7. What ratification would require

Nothing in this document is self-executing. To make the rule canonical the operator would need to:

1. ratify the rule text in §1 (the rule and its corollary);
2. rule on canary 6's artifact form (§5);
3. decide the disposition of the two lineage gaps this rule surfaces in EXP-P2 — the absent **v0.3**
   and **v0.4** drafts — as either recoverable or permanently attested-only;
4. decide whether the recovered v0.2 §38 is bound to v0.5's stopping rule or superseded by a newly
   authored one (`03_operational-amendment-v0.5.md` §A6.1 — still open).

Until then this file records a proposal, and the canaries enforce its mechanics without asserting
its standing.
