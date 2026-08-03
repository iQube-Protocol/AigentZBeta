# Track 2 Stage 2 — governed bulk admission, and the silent ingestion failure it uncovered

**Status:** shipped, 2026-08-03. Stage 2 (Review & Admit) remains the current stage; nothing
downstream was built.

---

## Why Stage 2 and not Stage 5

The stage-gated cadence (`2026-08-02_track2-stage-gated-development-cadence.md`) is explicit:
build only the operator workflow the NEXT stage needs, once the PREVIOUS stage's real outputs
exist. The committed record puts the programme at **Stage 2 — 47 discovered sources, 41 awaiting a
decision**, with Stage 3 onward not built and gated on sources having been admitted.

A Stage 5 (Classify Provenance) queue was considered and **not** built: the ratified crystal domain
`financial-risk-value-systems` is still empty (`2026-08-02_track2-freeze-path-readiness.md` §0), so
there are no real promoted invariants to classify. Building it would repeat the exact mistake the
cadence exists to stop.

---

## The defect this found (the reason it matters more than the feature)

The Track 2 review queue posted `{ decision, notes }` — and **never a `provenanceClass`**.

`ingestApprovedSource` requires one and refuses without it (PRD-ICA-001 §0.3). The review route
answered:

```json
{ "ok": true, "candidate": { … }, "ingestion": { "ok": false, "error": "provenanceClass is not set…" } }
```

The client checked only the outer `ok`. So every `approve_exp_p1` / `approve_general_finance`
decision made through that queue:

- moved the source's `reviewWorkflowStatus` to `approved_*` — Stage 2's own signals then counted it
  as **admitted**, and it **left the pending queue**;
- produced **no evidence row at all**;
- reported success.

This is "safe read as finished" — the failure mode Al named for Stage 5 — occurring one stage
earlier, and invisible because nothing inspected `ingestion.ok`. An operator working the queue would
have watched 41 sources drain into an apparently-admitted corpus containing zero evidence.

**Closed three ways:**

1. `applyCandidateReviewDecision` **refuses** an ingesting decision with no `provenanceClass`,
   before any write. A named refusal replaces a swallowed failure.
2. The queue now **asks for** the class (required only where it is required) and sends it.
3. The card **reads `ingestion.ok`** and renders an admitted-but-not-ingested source as the amber
   half-state it is, rather than a plain green success.

---

## One applier, two routes

`services/corpusScout/reviewDecision.ts` (new) is the single place a review decision is validated
and applied. `DECISION_TO_STATUS`, `INGESTING_DECISIONS`, the `mark_duplicate` rule, the
provenanceClass validation, and the approve-then-ingest sequencing all live there.

- `POST /api/corpus-scout/candidates/[sourceId]/review` — refactored to call it. It now validates
  request shape only and holds no rule of its own.
- `POST /api/corpus-scout/candidates/bulk-review` — **new**, loops the same function.

There is **no bulk-only path into the corpus**: every refusal a single decision meets, a batched one
meets identically. Parity is canaried in `tests/source-of-truth-parity.test.ts`
(`Corpus Scout review decision — ONE applier, two routes`).

---

## What the bulk act is, constitutionally

| Property | Behaviour |
|---|---|
| `dryRun` | **defaults to `true`** (`body.dryRun !== false`) — a forgotten flag inspects, never admits |
| rationale | required to WRITE, not to inspect; written onto **every** source in the batch |
| provenance class | required for an ingesting decision, and **one class for the whole batch** — a batch whose members don't share one must be split, not guessed |
| `mark_duplicate` | **refused in bulk** — it records *which* source each duplicate points at, a per-source fact |
| batch size | capped at 25, **refused by name** rather than truncated (a partially applied batch reporting success is worse than a refusal) |
| prior status | read **before** any write, so a re-run over already-decided sources renders as `would OVERWRITE`, not silently repeat |
| receipt | **one per batch**, via `writeLifecycleReceipt` on the existing `research_lifecycle_transition` action type. No new `ActivityActionType`, no migration. Attribution is `personaPublicRef` — never a raw personaId |
| receipt failure | never rolls back an admission, never silent: `[CORPUS BULK REVIEW]` error log + `receiptWarning` on the response |
| outcomes | reported **per source**, ingestion failures included — a batch is never summarised as "succeeded" when a member did not |

The client mirrors the crystal-assignment control's two-step posture: **Inspect** (writes nothing) →
**Record**, with the record button locked until an inspection *of that exact selection and decision*
has been seen. Changing either invalidates it, so a stale dry run cannot authorise a different act.

### Selection affordances, from real signals only

- **By institution** — issuer groups with more than one member, with the tier read from the ratified
  Institutional Registry via `findRegistryEntry(domain, pillarKey, institution)` (keyed by both, so
  one pillar's tradition is never reported for another's source). An issuer with no registry entry
  reads **"tier undeclared"** — never assumed authoritative, the same fail-closed posture
  `assessRegistryDiversity` takes.
- **Exact-duplicate groups** — surfaced in the review queue for the first time, from the existing
  `findDuplicateCandidates`. `CorpusScoutTab` has rendered these since Phase 3; the Track 2 queue,
  where these forty sources are actually decided, did not. Admitting both members of a byte-identical
  pair ingests the same document twice. Selecting duplicates is **warned, never blocked** — only the
  steward can say which copy is canonical.
  - The list projection carries no `normalizedTextHash`, so that axis genuinely cannot be checked
    here; `null` is passed. Substituting the artifact hash would fabricate a match on an axis never
    checked.

---

## Verification

- `tests/track2-steward-workflow.test.ts` — **40 tests**, 15 new (the whole
  `Track 2 Stage 2 — governed bulk admission` block plus three on the ingestion defect).
- `tests/source-of-truth-parity.test.ts` — **83 tests**, 3 new parity canaries.
- Full suite: **4,608 tests, 244 files** — 6 failures, all pre-existing and reproduced on a clean
  tree (`bitcent-name-availability` ×3, `principal-wallet-surface` ×2,
  `validation-programme-finalization` ×1). None in files this change touches.
- `npm run type-check:research` — **10 errors, the same 10 pre-existing ones in the same seven
  files.** Scope was WIDENED (`services/corpusScout/**`, `app/api/corpus-scout/**` added to
  `tsconfig.research.json`) and the baseline did not move: the newly covered code contributes zero.

---

## Files

| File | Change |
|---|---|
| `services/corpusScout/reviewDecision.ts` | NEW — the one decision applier; adds the provenanceClass pre-check |
| `app/api/corpus-scout/candidates/bulk-review/route.ts` | NEW — the governed batch act |
| `app/api/corpus-scout/candidates/[sourceId]/review/route.ts` | refactored onto the shared applier |
| `components/research/Track2ProgrammePanel.tsx` | provenance class on the card; ingestion-failure state; selection, issuer groups, duplicate groups, `BulkAdmissionControl` |
| `tests/track2-steward-workflow.test.ts` | 15 new canaries |
| `tests/source-of-truth-parity.test.ts` | 3 new parity canaries |
| `tsconfig.research.json` | corpus-scout service + routes added to the scoped gate |

## Still open

- **Stage 3 (Extract Candidates) is not built**, and should not be until sources have actually been
  admitted and extraction has produced candidates.
- **Stage 5 (Classify Provenance) is not built** — the crystal domain is empty; there is nothing
  real to classify.
- `normalizedTextHash` is absent from the list projection, so the strongest duplicate axis is
  unavailable to the review queue. Adding it to the projection is a deliberate, separate change
  (it is a hash, not text, so the 2026-07-28 payload-cap concern does not apply).
