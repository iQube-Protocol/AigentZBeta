# Commit Brief: `3a4b251` — Fix Track 2 EXP-P1 state oscillation: stop swallowing substrate errors as empty [merge fix/track2-crystal-state-projection]

| Field | Value |
|-------|-------|
| SHA | [`3a4b251`](https://github.com/iQube-Protocol/AigentZBeta/commit/3a4b2516a5422e561b78fe41d861ae65540fbbd2) |
| Author | Claude |
| Date | 2026-09-01T11:21:53Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Fix Track 2 EXP-P1 state oscillation: stop swallowing substrate errors as empty [merge fix/track2-crystal-state-projection]

Root cause of the Review & Admit <-> Discover Sources oscillation (34/18
admitted/pending flipping to 0/0 discovered): listCandidateSources
(services/corpusScout/provenance.ts) and listCandidates
(services/invariants/discoveryEngine.ts) both caught a genuine Supabase
query failure and returned [] — a confidently-empty, successfully-resolved
result — defeating two already-correct fail-soft safeguards
(loadTrack2ProgrammeState's null-on-error contract, resolveTrack2Population's
own unreadable-signal reporting) that assumed a failure would actually
propagate. Live Postgres logs showed statement-timeout events in the
incident window; the underlying data was never wrong (34 admitted / 18
pending / 8 ratified institutions, stable throughout) — one reader was
lying about its own failures.

Semantic repair, now enforced:
  successful read + zero rows  -> true empty
  failed/timed-out read        -> unknown/unreadable
  never: failed read -> [] -> false "nothing discovered"

Both functions now throw on a query error instead of swallowing it; every
existing caller already had the correct contract for that (a .catch(() =>
[]), a .catch(() => null), or an explicit try/catch) and is now genuinely
reachable instead of dead code. IRLResearchCopilotTab.tsx's "Track 2 — you
are here" headline now prefers the pending-decision signal over the raw
currentStageId label, and a transient unreadableSignals read no longer
overwrites an already-shown pending judgment.

Verified against current dev (re-synced from the older fd1faa1e baseline
this fix was originally built against): 1282/1283 targeted Track2/Crystal/
CorpusScout/IRL tests pass (the one failure is the pre-existing, unrelated
canon-document-resolution baseline gap); typecheck holds at 677 pre-existing
errors; full suite's failing set is byte-identical to the established
17-file/50-test baseline — no new failures, no fixed-then-reintroduced ones.

Resolution record: RES-2026-09-01-TRACK2-FAIL-SOFT-SWALLOWED-001
Candidate invariant: CI-2026-09-01-FAIL-SOFT-MUST-THROW-001

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01S5Y1pnDdW3LyguwPdfJjXy
```

## Body

Root cause of the Review & Admit <-> Discover Sources oscillation (34/18
admitted/pending flipping to 0/0 discovered): listCandidateSources
(services/corpusScout/provenance.ts) and listCandidates
(services/invariants/discoveryEngine.ts) both caught a genuine Supabase
query failure and returned [] — a confidently-empty, successfully-resolved
result — defeating two already-correct fail-soft safeguards
(loadTrack2ProgrammeState's null-on-error contract, resolveTrack2Population's
own unreadable-signal reporting) that assumed a failure would actually
propagate. Live Postgres logs showed statement-timeout events in the
incident window; the underlying data was never wrong (34 admitted / 18
pending / 8 ratified institutions, stable throughout) — one reader was
lying about its own failures.

Semantic repair, now enforced:
  successful read + zero rows  -> true empty
  failed/timed-out read        -> unknown/unreadable
  never: failed read -> [] -> false "nothing discovered"

Both functions now throw on a query error instead of swallowing it; every
existing caller already had the correct contract for that (a .catch(() =>
[]), a .catch(() => null), or an explicit try/catch) and is now genuinely
reachable instead of dead code. IRLResearchCopilotTab.tsx's "Track 2 — you
are here" headline now prefers the pending-decision signal over the raw
currentStageId label, and a transient unreadableSignals read no longer
overwrites an already-shown pending judgment.

Verified against current dev (re-synced from the older fd1faa1e baseline
this fix was originally built against): 1282/1283 targeted Track2/Crystal/
CorpusScout/IRL tests pass (the one failure is the pre-existing, unrelated
canon-document-resolution baseline gap); typecheck holds at 677 pre-existing
errors; full suite's failing set is byte-identical to the established
17-file/50-test baseline — no new failures, no fixed-then-reintroduced ones.

Resolution record: RES-2026-09-01-TRACK2-FAIL-SOFT-SWALLOWED-001
Candidate invariant: CI-2026-09-01-FAIL-SOFT-MUST-THROW-001

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01S5Y1pnDdW3LyguwPdfJjXy

## Files Changed

| Change | File |
|--------|------|
| Modified | `.amplify-deploy` |
| Added | `codexes/packs/agentiq/resolution-records/candidate-invariants/CI-2026-09-01-FAIL-SOFT-MUST-THROW-001.json` |
| Added | `codexes/packs/agentiq/resolution-records/records/RES-2026-09-01-TRACK2-FAIL-SOFT-SWALLOWED-001.json` |
| Modified | `components/composer/IRLResearchCopilotTab.tsx` |
| Modified | `services/corpusScout/provenance.ts` |
| Modified | `services/invariants/discoveryEngine.ts` |
| Modified | `tests/corpus-scout-list-projection.test.ts` |

## Stats

 7 files changed, 259 insertions(+), 5 deletions(-)
