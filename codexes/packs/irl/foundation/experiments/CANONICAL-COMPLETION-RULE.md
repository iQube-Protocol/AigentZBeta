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
| 6 | Completing an experimental protocol must emit a canonical capability/research artifact carrying its protected invariants, decisions and provenance | **ENFORCED** — artifact form ruled 2026-07-28: `capabilityCompletionArtifact`. See §5 |

## 5. Canary 6 — the artifact form, ruled 2026-07-28

Canary 6 governs an event that has not happened yet: no EXP-P2 protocol is complete, and v0.5's
disposition states that preregistration is not yet authorized. The canary is therefore
**conditional in trigger** — it takes the not-complete branch today and fires the moment a
disposition flips — but it is **no longer conditional in form.** The operator has ruled:

> "Do not create another artefact kind unless there is a structurally different object. The
> completion rule applies to developed capabilities, **including research instruments**. Therefore
> IDE, IRE and IPE should each conclude with a `capabilityCompletionArtifact`, carrying
> research-specific fields where needed.
>
> A `ResearchPublication` proves findings. **It does not prove that a capability is reproducible,
> locatable and safely usable.** Those are different evidentiary functions."

**The emitted artifact is a `capabilityCompletionArtifact`** (`types/capabilityCompletion.ts`,
schema governed by CCR-001). A `ResearchPublication` is not an acceptable substitute, and the canary
now rejects one offered in its place — the two prove different things, and accepting a publication
as a completion record would leave a capability unreproducible while looking complete.

The capability artifact **references** associated publications rather than becoming one:

```yaml
kind: capabilityCompletionArtifact
capability: IRE
emits:
  - resolution-trace
relatedEvidence:
  - kind: ResearchPublication
    id: EXP-P1-STAGE-0-...
```

### 5.1 `relatedEvidence` does not yet exist on the schema — reported, not invented

The `relatedEvidence` field in the ruling's example **is not present** in
`types/capabilityCompletion.ts` at schema version v2.0, and nothing on the platform carries it.
Adding it is a real schema change, not a documentation edit: it requires a field on
`CapabilityCompletionArtifact`, a section number in CCR-001 §7, a template section, a parser branch,
and a version bump — because the parser pins the schema version exactly and rejects any other.

Those files are owned by another agent mid-ratification at the time of writing, so the change is
**reported rather than made**. The proposed shape, for whoever holds the file:

```ts
/** §7.x — evidence this capability REFERENCES rather than becomes. A
 *  ResearchPublication proves findings; this artifact proves reproducibility.
 *  Composition over merger: the id is a `ResearchPublication['id']`. */
export interface RelatedEvidenceRef {
  kind: 'ResearchPublication';
  id: string;
}
```

Until it lands, a completion artifact can only reference publications through the untyped
`commons.evidenceRefs: string[]`, which carries no `kind` and so cannot distinguish a publication
from any other reference. **Canary 6 does not assert `relatedEvidence`**, because asserting a field
that cannot exist yet would be a canary that can never pass — the mirror of the inert-mechanism
defect, and just as useless.

## 6. Relationship to existing discipline

This rule generalizes what `inv.engineering.036` does for code — one authoritative location per
concern — to *inherited authority over time*. A citation of a non-existent draft is the temporal
form of the same defect: two things describing one rule, where the one being relied on cannot be
inspected.

It also sharpens the Hypothesis vs Canon discipline. That rule governs *claims about the world*;
this one governs *claims about what has already been decided*. Both fail the same way — an
unratified thing acquiring the authority of a ratified one by being repeated confidently.

## 7. What ratification would require

Nothing in this document is self-executing. Status of each item as of 2026-07-28:

1. **Ratify the rule text in §1** (the rule and its corollary). **OPEN.**
2. ~~Rule on canary 6's artifact form.~~ **RULED 2026-07-28** — `capabilityCompletionArtifact`;
   a `ResearchPublication` is referenced, never substituted (§5).
3. **Decide the disposition of the two lineage gaps this rule surfaces in EXP-P2** — the absent
   **v0.3** and **v0.4** drafts — as either recoverable or permanently attested-only. **OPEN.**
4. ~~Decide whether the recovered v0.2 §38 is bound to v0.5 or superseded.~~ **RULED 2026-07-28** —
   neither: §38 is treated as a historical design constraint and a v0.5-native successor derived.
   The derivation is at
   `exp-p2-consequential-performance/06_stopping-rule-reconciliation.md` and is itself `proposed`,
   so **item 4 is discharged as a question and reopened as a ratification**: SR-0…SR-5 need the
   operator's approval before Appendix C item 19 can be marked resolved.
5. **Land `relatedEvidence` on the completion schema** (§5.1) — a real schema change requiring a
   version bump, currently blocked on file ownership. **OPEN, reported.**
6. **Rule on the untested stopping condition** — v0.2 §38's repeated-task/amortization condition has
   no registered experiment anywhere in the programme
   (`06_stopping-rule-reconciliation.md` §6.2). **OPEN.**

Until items 1, 3, 5 and 6 are settled this file records a proposal, and the canaries enforce its
mechanics without asserting its standing.
