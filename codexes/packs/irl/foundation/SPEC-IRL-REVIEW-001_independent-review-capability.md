# SPEC-IRL-REVIEW-001 — IRL Independent Review Capability

**Status:** draft for ratification · **Capability ID:** `IRL-REVIEW-001`
**Owning institution:** Invariant Research Lab
**Initial use case:** EXP-P1 crystal admissibility review
**Design principle:** independent review without heavy procedural overhead

**Supersedes as the general contract:** `codexes/packs/agentiq/updates/2026-07-29_external-review-rulings.md`,
whose rulings remain binding but are now the **Phase 1 instantiation** of this capability rather than
a standalone process. Where the two differ, this spec governs the general case and that doc governs
the EXP-P1 specifics.

---

## 1. Purpose

A reusable way to submit an experiment asset, procedure, result or governance artefact to one or more
independent reviewers and return a structured, auditable adjudication.

Supports: invariant admissibility and contamination review; protocol and preregistration review;
procedure and rubric review; artifact-completeness review; falsifiability and confound review;
result-claim review; constitutional-compliance review; replication-readiness review.

It does **not** canonize, ratify, grant Standing, alter lifecycle state, or freeze an experiment.

> **Independent review produces evidence and recommendations. The Lab retains authority for
> acceptance, ratification, freeze, publication or rejection.**

## 2. Objectives

Reusable across experiments and asset types · minimal overhead · one or two reviewers · external
models, internal models or humans · privacy through commitments and signed evidence summaries ·
frozen versioned packages · disagreement surfaced not averaged · fail closed on insufficient
evidence · reviewers cannot write to source records · a compact capability artefact on completion.

## 3. Review modes

**Single** — low-consequence or diagnostic: early red-team, protocol clarity, missing controls,
artifact completeness, procedure readability.

**Dual** — where the outcome affects a confirmatory experiment population, exclusions, a freeze, a
public claim, a ratified result, or constitutional/governance consequences.

> **Two instances of the same model do not count as independent reviewers.**

**Human** — a human may occupy either slot using the same package, rubric and output schema.

## 4. Core objects

```ts
type ReviewRequest = {
  reviewId: string;
  experimentId?: string;
  assetType: 'invariant-set' | 'protocol' | 'procedure' | 'preregistration' | 'result'
    | 'artifact' | 'governance-record' | 'replication-package' | 'other';
  reviewMode: 'single' | 'dual';
  reviewQuestion: string;
  targetDefinition?: string;
  rubricId: string;
  packageRef: string;
  packageHash: string;
  requestedAt: string;
  requestedByRef: string;
};

type ReviewPackage = {
  packageId: string; reviewId: string;
  assetRef: string; assetCommitment: string;
  sourceRefs: string[]; evidenceSummaries?: string[]; chronology?: string[];
  targetDefinition?: string; rubricRef: string;
  exclusionsFromPackage: string[];
  createdAt: string; packageHash: string;
};

type ReviewerAssignment = {
  reviewerSlot: 'R1' | 'R2';
  reviewerType: 'external-model' | 'internal-model' | 'human';
  provider?: string;
  requestedModelId?: string; resolvedModelId?: string; modelFamily?: string;
  promptVersion: string; rubricVersion: string;
  determinismSettings?: Record<string, unknown>;
};

type ReviewDecision = {
  reviewId: string; reviewerSlot: 'R1' | 'R2'; subjectRef: string;
  decision: string; reason: string;
  evidenceRefs: string[]; limitations: string[];
  reviewedAt: string; rawOutputRef: string; outputHash: string;
};

type ReviewResolution = {
  reviewId: string; subjectRef: string;
  status: 'agreed' | 'contested' | 'accepted' | 'rejected' | 'deferred' | 'unknown';
  reviewer1Decision?: string; reviewer2Decision?: string; operatorDecision?: string;
  resolutionReason?: string; resolvedAt?: string; resolutionReceiptRef?: string;
};
```

## 5. Standard workflow

```text
1. Select asset
2. Select review template
3. Freeze and hash review package
4. Run Reviewer 1
5. Run Reviewer 2 when required
6. Parse outputs into a common schema
7. Surface agreement and contested rows
8. Record governed resolution
9. Emit review receipt and capability artefact
```

External reviewers receive **no live database access** and cannot modify the reviewed asset.

## 6. Standard review templates

**Independence and contamination** — `independent` · `domain-adjacent` · `target-derived` ·
`task-derived` · `outcome-informed` · `unknown`.

**Experimental design integrity** — falsifiability; controls; arm symmetry; confounds; leakage;
stopping rules; measurement validity; sequence integrity.

**Constitutional compliance** — personhood and authority; bounded delegation; attribution; receipts;
privacy; Standing consequences; fail-closed behaviour; non-redelegation.

**Artifact completeness** — required fields; evidence links; hashes; versioning; reproducibility;
unresolved decisions; implementation reachability.

**Result and claim review** — whether claims follow from evidence; overstatement; diagnostic versus
confirmatory findings; limitations; unsupported generalisation; replication readiness.

## 7. Minimal-overhead rule

Use the lightest mode consistent with consequence.

| Consequence | Default |
|---|---|
| Early draft or diagnostic review | Single |
| Internal procedure refinement | Single |
| Confirmatory experiment input | Dual |
| Exclusion from experimental population | Dual |
| Public claim or ratified result | Dual |
| Canon or constitutional amendment | Dual plus governed approval |

A single review may escalate to dual only when consequence, uncertainty or disagreement requires it.

## 8. Reviewer independence

For dual-model review: model IDs must differ; **model families must differ**; aliases resolving to
the same underlying model must be refused; silent fallback to a shared default must be refused;
requested **and resolved** model IDs must be recorded; unknown lineage fails closed.

Shared hosting is acceptable where model lineage is genuinely distinct.

## 9. Privacy and private evidence

Private material remains inside the runtime. A trusted local reviewer may emit a **signed evidence
summary** containing: source commitment; chronology; derivation method; target/task/outcome
relationships; factual basis; reviewer attribution; receipt or signature reference.

It must **not** disclose: raw private documents; passport or persona identifiers; proprietary
expected answers; desired result or population size; a preferred classification.

If the summary is insufficient, contradictory, unverifiable or unavailable → **`unknown`**.

## 10. Disagreement handling

```text
agreement     → eligible for local adoption
disagreement  → contested → fail closed → governed resolution required
```

**Reviewer decisions are never averaged.** The operator or designated steward resolves only contested
items, not the full review set.

## 11. Receipt and audit model

Each run emits a DVN-anchorable review receipt: review ID; asset commitment; package hash; rubric and
prompt versions; reviewer assignments; requested and resolved model IDs; raw-output commitments;
parsed-output commitments; agreement and contested counts; final resolution status; timestamps.

> **The receipt records the review event. It does not ratify the asset.**

## 12. Lab UI

One lightweight **Independent Review** capability in the Research Workspace.

- **New Review** — choose asset, template, single/dual mode, reviewers; preview the redacted package;
  freeze and run.
- **Review Queue** — running · completed · contested · awaiting resolution.
- **Review Result** — compact summary; reviewer agreement; contested items; limitations; hashes and
  receipts; accept, revise, defer or reject.

Reuse the existing workspace, receipts, evidence and agent-routing primitives. **Do not build a
separate review-management product.**

## 13. Initial implementation

**Phase 1 — EXP-P1 admissibility.** Frozen package exporter; independence rubric; Venice Reviewer 1;
a second distinct model-family reviewer; schema parser; contested queue; review receipt; relations
and exclusions export.

**Phase 2 — reusable templates.** Experimental-design; constitutional-compliance;
artifact-completeness; result-claim.

**Phase 3 — human reviewer support.** Assignable human slots using the same package and decision
schemas.

## 14. Acceptance criteria

1. A Lab user can submit an asset without granting live database access.
2. The package is frozen and hashed before review.
3. Single and dual modes both work.
4. Dual mode refuses identical model IDs or families.
5. **Reviewers receive the same package and rubric but not each other's decisions.**
6. Current labels, Standing, desired counts and expected outcomes can be blinded.
7. Private evidence can be represented through signed summaries.
8. `unknown` and disagreement fail closed.
9. Contested items are surfaced individually.
10. Reviewers cannot modify source assets.
11. Raw and parsed outputs are versioned.
12. Every run produces a DVN-anchorable review receipt.
13. Final acceptance or freeze remains a separate governed act.
14. Completion emits a reusable capability artefact.

## 15. Capability artefact

```text
Capability: Independent Review
Location: Research Workspace → Independent Review
Use: submit an experiment asset for single or dual independent adjudication
Inputs: frozen asset package, target statement, rubric, reviewer assignments
Outputs: decisions, contested queue, hashes, receipt, resolution record
Invariants:
- reviewers never write to source assets
- dual reviewers have distinct judgement lineage
- desired outcomes and counts remain blinded
- disagreement is surfaced, never averaged
- unknown fails closed
- review is evidence, not ratification
```

## 16. Constitutional rule

> The Invariant Research Lab shall maintain an independent-review capability for experimental assets
> and procedures. Review packages must be frozen, attributable, privacy-preserving and reproducible.
> Independent reviewers provide evidence and adjudication but may not alter source records, grant
> Standing, canonize findings, or perform the final governed act. Review disagreement must remain
> visible, and unresolved assets must fail closed where confirmatory integrity depends upon the
> decision.
