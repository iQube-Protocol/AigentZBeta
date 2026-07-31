# Commit Brief: `42849c3` — Add canonical results publication: hash-committed, DVN-anchored, verifiable

| Field | Value |
|-------|-------|
| SHA | [`42849c3`](https://github.com/iQube-Protocol/AigentZBeta/commit/42849c3939c0b750a15c4e1d5ba902d52756e92c) |
| Author | Claude |
| Date | 2026-07-04T20:41:43Z |
| Branch | dev (direct push) |
| Type | `feat` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Add canonical results publication: hash-committed, DVN-anchored, verifiable

The Experiment Lab gains a Results tab and a publish pipeline. Publish
stores the EXACT serialized results string (text, never jsonb — jsonb
re-serialization breaks hash reproduction) with its sha256 content
commitment (T2-safe, no identifiers) in a new experiment_results table,
and emits an experiment_result_published activity receipt carrying the
same hash in its summary. That action type is added to the receipt
union and to ANCHORABLE_ACTION_TYPES (the one permitted unilateral DVN
change), so the commitment lands in tamper-evident constitutional
memory. Verification is trustless: the Results tab recomputes sha256
over the stored text in-browser via SubtleCrypto and compares against
the anchored hash — no server assertion taken on faith — alongside the
receipt's DVN lifecycle chip and raw/download views. Publish buttons on
the EXP-001/003 runners (post-completion; EXP-001 carries the
human-scorer-authority note); the receipt records the grounding
collection ids for reuse-count instrumentation. GET spine-gated, POST
admin-gated.

Co-Authored-By: Claude <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Y98FMjkM8zUDsYqJikzsMB
```

## Body

The Experiment Lab gains a Results tab and a publish pipeline. Publish
stores the EXACT serialized results string (text, never jsonb — jsonb
re-serialization breaks hash reproduction) with its sha256 content
commitment (T2-safe, no identifiers) in a new experiment_results table,
and emits an experiment_result_published activity receipt carrying the
same hash in its summary. That action type is added to the receipt
union and to ANCHORABLE_ACTION_TYPES (the one permitted unilateral DVN
change), so the commitment lands in tamper-evident constitutional
memory. Verification is trustless: the Results tab recomputes sha256
over the stored text in-browser via SubtleCrypto and compares against
the anchored hash — no server assertion taken on faith — alongside the
receipt's DVN lifecycle chip and raw/download views. Publish buttons on
the EXP-001/003 runners (post-completion; EXP-001 carries the
human-scorer-authority note); the receipt records the grounding
collection ids for reuse-count instrumentation. GET spine-gated, POST
admin-gated.

Co-Authored-By: Claude <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Y98FMjkM8zUDsYqJikzsMB

## Files Changed

| Change | File |
|--------|------|
| Added | `app/api/experiments/results/route.ts` |
| Modified | `components/composer/Exp001EvaluationRunner.tsx` |
| Modified | `components/composer/Exp003RediscoveryRunner.tsx` |
| Added | `components/composer/ExperimentResultsTab.tsx` |
| Modified | `components/composer/InvariantExperimentLab.tsx` |
| Modified | `services/dvn/activityReceiptDvnPipeline.ts` |
| Modified | `services/receipts/activityReceiptService.ts` |
| Added | `supabase/migrations/20260704120000_experiment_results.sql` |

## Stats

 8 files changed, 515 insertions(+), 3 deletions(-)
