# EXP-001 — The First Living KnowledgeQube

**Chrysalis Foundation · Experiment 001 · Status: artifacts authored, evaluation pending**
Domain: **The Constitutional Internet**
Constitutional anchor: `codexes/packs/polity-core/constitutional-records/invariant-intelligence.md`

## Hypothesis

Content generated from a fixed, validated invariant collection — rather than from open-ended prompting — exhibits measurably higher **consistency** (across formats), **explainability** (every claim traces to an invariant), lower **hallucination** (no claims outside the collection), and higher **coherence** (no internal contradiction), when evaluated by an independent model.

If confirmed, this is the first scientific validation of the compression theory: the same compressed expertise renders faithfully across arbitrarily many surfaces. Then every paper becomes: Paper → Invariant Extraction → KnowledgeQube → Registry → Runtime → aigentMe → Studio → Differ → Citizen → Standing → Registry → Knowledge Evolution. Not a workflow — a living knowledge ecosystem.

## The invariant collection — "The Constitutional Internet"

Every artifact in this experiment is generated from **only** these 18 invariants (seed ids; create the Level-2 collection from these, then publish as the experiment's InvariantQube):

| Seed id | Statement |
|---|---|
| inv.constitutional.011 | Personhood precedes identity. |
| inv.constitutional.012 | Standing follows action. |
| inv.constitutional.013 | Authority follows standing. |
| inv.constitutional.014 | Delegation never removes accountability. |
| inv.constitutional.015 | Authority may be delegated; sovereignty may not. |
| inv.constitutional.016 | Sovereignty remains exclusively with human citizens. |
| inv.constitutional.017 | An agent may exercise delegated authority but may never create new authority. |
| inv.constitutional.018 | Standing is confidence in the veracity of declarations, not reputation. |
| inv.constitutional.019 | Citizens are responsible for veracity, not for predicting consequences of truthful information. |
| inv.constitutional.020 | Permanent and unlimited delegation is prohibited. |
| inv.constitutional.021 | Humans define semantics; AI optimizes implementation. |
| inv.constitutional.022 | Canonical status requires human ratification. |
| inv.constitutional.023 | Constitutional memory is append-only; supersession replaces deletion. |
| inv.constitutional.024 | Identifiers that re-identify a subject never leave the server. |
| inv.constitutional.059 | Invariants themselves accrue Standing. |
| inv.constitutional.060 | Truth is established through validation within a domain of applicability, not by popularity. |
| inv.constitutional.061 | Standing expresses constitutional confidence in an invariant and shall never be interpreted as a measure of truth. |
| inv.constitutional.062 | Reach measures adoption rather than validity; constitutional knowledge preserves the distinction between Truth, Standing, and Reach. |

## The five artifacts (same collection, five renderings)

1. `canonical-article.md` — the canonical article
2. `report.md` — structured report
3. `story.md` — narrative fiction
4. `infographic.md` — infographic spec (layout + copy blocks)
5. Video — the 24s and 48s productions in `../exp-002-invariant-video/` (same collection)

**Grounding discipline:** every artifact cites its grounding invariants inline as `[C-NNN]` markers (e.g. `[C-015]` = inv.constitutional.015). Explainability is by construction — the reasoning path is visible in the text.

## Evaluation protocol

See `evaluation-protocol.md`: an independent model (one that did NOT author the artifacts) answers 15 questions using each artifact alone, then all five together. Score:

- **Consistency** — same answer derivable from every artifact (per-question agreement across formats)
- **Explainability** — answers cite the correct `[C-NNN]` markers
- **Hallucination** — claims not traceable to any of the 18 invariants (target: zero)
- **Coherence** — no answer contradicts another artifact's answer

## Flywheel closure

After evaluation, feed results back through the operating model: confirmed answers → `recordConsequence(id, 'confirmed')` on the cited invariants (standing accrues); contradictions or hallucinations traced to ambiguous statements → refinement proposals via the Invariant Service. The experiment itself exercises Intent → Knowledge → Capability → Consequence → Standing → Knowledge.

## Operator steps

1. Create the collection: `POST /api/invariants/collections` with the 18 invariant ids (look up ids by seed id via `GET /api/invariants?namespace=constitutional`).
2. Publish: `POST /api/registry/invariant-qube` `{ "collectionId": "...", "title": "The Constitutional Internet — KnowledgeQube 001" }`.
3. Hand `evaluation-protocol.md` + one artifact at a time to an independent model; record scores.
4. Feed outcomes back: `POST /api/consequence/run` with `execute=true` / `outcome` per finding — or via the Phase 3b chain.
