# Threshold 007 Research Edition — Citation Resolution and Publication (2026-09-12)

## What this is

The Research Edition of **Threshold 007 — Invariant Intelligence** (Structural Reasoning
Compression, Cybernetic Amplification and Constitutional Expansion), published as the citable
companion to the already-live essay (`invariant-intelligence`, content ID
`a61343cb-d000-4359-a307-e9d380740eaa`, published 2026-09-11). This supersedes the earlier
same-day staging pass recorded in this same file (see git history for the prior version) — that
pass explicitly left several gaps unresolved rather than guessed; this pass resolves as many of
those gaps as could be honestly resolved and leaves the rest explicitly unresolved in the
published text itself, per the paper's own citation-integrity rule.

## Files

- `docs/qriptopian/thresholds/007-research-edition.md` — the full Research Edition manuscript. The
  operator's verbatim prose (hypotheses H1/H2/H3a/H3b, falsification matrix, argument-to-evidence
  graph, implementation-evidence register, references) is preserved exactly as authored; only the
  anchor/citation blocks were edited to carry resolved permalinks or an explicit "Unresolved"
  status. The manuscript's own "Publication Ingestion Note" section was stripped per its own
  instruction before publication.
- `docs/qriptopian/thresholds/007-editions-manifest.json` — mirrors
  `006-editions-manifest.json`'s exact shape (schema `qriptopian.reading-editions.v1`).
- `docs/qriptopian/thresholds/007-research-apparatus.json` — **removed**. The earlier staging pass
  introduced a bespoke `researchApparatus` schema (references/implementationAnchors/claims/
  experiments/evidenceGraph/falsificationConditions) that has no counterpart in how Threshold 006
  is actually published. Per the operator's explicit instruction ("exactly the same way the
  research edition for 006 is managed and published"), this edition instead mirrors T006's real
  `ai_metadata` shape (`sourceGraph`, `readingEditions`, `evidenceDiscipline`, `repositoryCommit`,
  `canonicalMarkdownSha256`) rather than inventing a second, divergent schema.

## Publication mechanism (mirrors Threshold 006 exactly)

The live content row (`a61343cb-d000-4359-a307-e9d380740eaa`) previously held only the essay text
at `modalities.read.text`, with `ai_metadata.researchCompanionStatus: "forthcoming"`. This pass:

1. Added `modalities.read.editions`: a two-entry array — `"reading"` (the original essay text,
   embedded inline, byte-identical to what was already published, `textSha256` verified to match
   the pre-existing `ai_metadata.canonicalMarkdownSha256`) and `"research"` (`source: "canonical"`,
   pointing at the row's own `modalities.read.text` field, per T006's exact convention).
2. Replaced `modalities.read.text` (top level) with the new Research Edition manuscript — this is
   the field the machine endpoint and citation apparatus treat as canonical, exactly as T006's own
   `modalities.read.text` holds ITS Research Edition text, not its Reading Edition text.
3. Set `defaultEdition: "reading"` (T006's own default), so the essay remains what a visitor sees
   first; the Research Edition is one click away, exactly as T006 presents it.
4. Updated `ai_metadata`: `researchCompanionStatus` → `"published"`; added `edition` ("Inspectable
   Academic Draft v0.1"), `version` ("0.1"), `repositoryCommit`, `originPublishedAt` (preserving the
   essay's original 2026-09-11 publish timestamp), `canonicalMarkdownSha256` (now the Research
   Edition's hash), `sourceGraph` (repository_links + inspectability_model + canonical_fact_source +
   an explicit `unresolved_internal_references` list, mirroring T006's `sourceGraph` shape),
   `sourceGraphSha256`, and `readingEditions` (mirroring T006's own `ai_metadata.readingEditions`
   substructure verbatim in shape).
5. Deliberate gap, stated honestly: unlike T006, this edition has **no PDF or cover asset** yet
   (T006's `pdfAssetId`/`pdfCid`/`coverCid`/`coverAssetId` pipeline was not run for 007). Those
   fields were left absent rather than fabricated. `modalities.read.pdf_url` remains `null`.

## Verification basis

All resolved implementation anchors were verified present as real files/directories at commit
`3ab092623e20a11160aed8193aac181a72c6757f` on `iQube-Protocol/AigentZBeta` — this session's own
pushed HEAD, checked directly (`git show`, file-existence checks), not inferred from naming
convention. T004/T005/T006 references were resolved directly against the live Supabase `content`
table (content IDs, slugs, machine endpoints, publish dates) rather than left as placeholders. The
seven-item external bibliography was copied verbatim from T006's own stored `modalities.read.text`
(fetched live from the same `content` row), not reconstructed from memory.

## Resolved this pass (were unresolved in the prior staging draft)

- **T004, T005** — canonical content IDs, slugs and machine endpoints, resolved directly from the
  Supabase `content` table (`constitutional-computing` / `2e85c1eb-...`; `trusted-intelligence` /
  `c25eb589-...`).
- **External bibliography (7 entries)** — copied verbatim from T006's own reference list, fetched
  live from its `content` row.
- **EXP-P2 directory ambiguity** — resolved via the IRL's own series-ratification record
  (`SERIES-RATIFICATION_p1-p2-p3.md`): EXP-P2 is the family directory
  `exp-p2-consequential-performance/`, with P2A (software) and P2B (physical) as its
  instantiations. The paper's own title for this section ("Condition-Directed Gated Verification
  Workflow") does not match the registered protocol's own self-description; this mismatch is
  stated in the published text rather than silently reconciled by rewriting either side.
- **DCIR** — resolved to `codexes/packs/irl/foundation/CFS-020_dcir-charter.md` (a doctrine/charter
  document, not an executable module — stated as such).
- **IDE, Crystal** — resolved to `services/invariants/discoveryEngine.ts` and
  `services/research/crystalDomains.ts` respectively (the latter reusing T006's own precedent
  citation for "the Crystal admission evaluator").
- **Aegis (implementation)** — resolved to `services/aegis/aegisAssessmentService.ts`, with an
  explicit naming-collision caution: this is NOT the same artifact as the "Aegis 0.0" doctrine
  named in the paper's prose, which remains unresolved (see below). The two must not be conflated.

## Still honestly unresolved (published as "Unresolved," not fabricated)

- **DevOn** — referenced across many UI/test/process surfaces in this repository; no single
  canonical orchestration-implementation entry point could be identified without guessing among
  them.
- **Aegis — Constitutional Admission and Calibration Doctrine 0.0**, **Aegis Crucible Submission
  0.0**, **Golden Cycle Research Thesis v0.1** — searched by exact title and by keyword across both
  this repository and the Supabase `content` table; not found in either. T006 itself cites the
  first of these (and IRL-010/IRL-010A) as living only in an external "File Library" outside both
  systems this session can reach — this edition carries that same honest status forward rather
  than inventing a citation.
- **[CI] The Constitutional Internet** and **[PE] The Polity Embodied, Paper I** — same status:
  T006 itself records these as "resolved; canonical public/repo permalink still to be assigned,"
  and this edition inherits that unresolved status rather than assigning one.
- **PDF/cover assets** — no PDF or cover CID pipeline has been run for Threshold 007 yet (unlike
  T006, which has a full PDF/cover asset manifest). This is a real gap, not a parity claim.

## What was deliberately NOT done

- The prior staging pass's bespoke `researchApparatus` JSON schema (claims/experiments/
  evidenceGraph/falsificationConditions as a separate machine-readable object) was retired rather
  than carried forward into `ai_metadata`, per the operator's explicit instruction to publish
  "exactly the same way" as Threshold 006 — which has no such field. The paper's own prose
  (Falsification Matrix, Argument-to-Evidence Graph, Implementation-Evidence Register sections)
  already carries this structure for a human or machine reader of the manuscript itself.
- No measured EXP-P1/P2 numeric results were inserted anywhere in the manuscript. None were
  available from a canonical, commit-pinned evidence package this session could verify, and the
  paper's own instruction is explicit that historical numbers must never be copied from chat or
  secondary summaries.
