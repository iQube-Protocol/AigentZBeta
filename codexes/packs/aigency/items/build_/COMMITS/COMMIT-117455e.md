# Commit Brief: `117455e` — Add Report tab + backfill historical runs into the canonical Results record

| Field | Value |
|-------|-------|
| SHA | [`117455e`](https://github.com/iQube-Protocol/AigentZBeta/commit/117455ee17b9b53ff3a6d5732d66d9bc67d4bd00) |
| Author | Claude |
| Date | 2026-07-06T01:38:28Z |
| Branch | dev (direct push) |
| Type | `feat` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Add Report tab + backfill historical runs into the canonical Results record

The Results tab launched after the first runs completed, so it renders
empty — the run-1 EXP-001/EXP-003 records (2026-07-04) and the EXP-002
run-2 record live only as repo files. Two additions:

- Backfill: publish logic extracted to
  services/experiments/publishResult.ts (results POST refactored onto
  it); new admin POST /api/experiments/results/backfill publishes the
  three bundled historical records through the identical pipeline
  (exact-string serialization -> sha256 commitment -> DVN-anchorable
  receipt), idempotently by content hash. Results tab gains a
  "Backfill historical runs" button. EXP-002 run 2 gets a structured
  results JSON authored from the ratified README record (clip set,
  timeline, findings, control-arm results, constitutional refs).

- Report tab (5th lab tab): the consolidated Foundational Validation
  Series report — introduction, trust model, per-experiment
  aim/methodology/execution/findings, cross-cutting conclusions,
  limitations stated plainly, partner invitation. Composed as ONE
  markdown string: authored narrative + data tables injected live from
  the canonical published results, so new runs update the report
  automatically. Copy button shares exactly what renders (markdown) —
  deliberately copy-based for confidential partner sharing, no public
  URL. Marked CONFIDENTIAL DRAFT throughout.

Co-Authored-By: Claude <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Y98FMjkM8zUDsYqJikzsMB
```

## Body

The Results tab launched after the first runs completed, so it renders
empty — the run-1 EXP-001/EXP-003 records (2026-07-04) and the EXP-002
run-2 record live only as repo files. Two additions:

- Backfill: publish logic extracted to
  services/experiments/publishResult.ts (results POST refactored onto
  it); new admin POST /api/experiments/results/backfill publishes the
  three bundled historical records through the identical pipeline
  (exact-string serialization -> sha256 commitment -> DVN-anchorable
  receipt), idempotently by content hash. Results tab gains a
  "Backfill historical runs" button. EXP-002 run 2 gets a structured
  results JSON authored from the ratified README record (clip set,
  timeline, findings, control-arm results, constitutional refs).

- Report tab (5th lab tab): the consolidated Foundational Validation
  Series report — introduction, trust model, per-experiment
  aim/methodology/execution/findings, cross-cutting conclusions,
  limitations stated plainly, partner invitation. Composed as ONE
  markdown string: authored narrative + data tables injected live from
  the canonical published results, so new runs update the report
  automatically. Copy button shares exactly what renders (markdown) —
  deliberately copy-based for confidential partner sharing, no public
  URL. Marked CONFIDENTIAL DRAFT throughout.

Co-Authored-By: Claude <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Y98FMjkM8zUDsYqJikzsMB

## Files Changed

| Change | File |
|--------|------|
| Added | `app/api/experiments/results/backfill/route.ts` |
| Modified | `app/api/experiments/results/route.ts` |
| Added | `codexes/packs/agentiq/foundation/experiments/exp-002-invariant-video/run2-results-2026-07-05.json` |
| Added | `components/composer/ExperimentReportTab.tsx` |
| Modified | `components/composer/ExperimentResultsTab.tsx` |
| Modified | `components/composer/InvariantExperimentLab.tsx` |
| Added | `services/experiments/publishResult.ts` |

## Stats

 7 files changed, 668 insertions(+), 70 deletions(-)
