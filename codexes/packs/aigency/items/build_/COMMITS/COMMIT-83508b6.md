# Commit Brief: `83508b6` — wire discovery-dimension standing priors so the shadow flip diverges

| Field | Value |
|-------|-------|
| SHA | [`83508b6`](https://github.com/iQube-Protocol/AigentZBeta/commit/83508b6497dc35da01894a31db9497397986ef41) |
| Author | Claude |
| Date | 2026-07-16T17:52:10Z |
| Branch | dev (direct push) |
| Type | `feat` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
wire discovery-dimension standing priors so the shadow flip diverges

Ratify the four discovery invariants (inv.reasoning.134-137) to validated
and give each a seed_validations prior (need 5 > importance 4 > trust 3 >
novelty 2). Standing is derived from times_validated via computeStandingScore
(lifecycle.ts), so seeding the validation count is the recompute-safe, ledger-
honest lever — a direct standing column write would be wiped by the next
recompute. The ingest now honours seed_validations: sets times_validated +
derived standing on insert, and on update only when the row has not earned
real validation yet (never clobbers accrued evidence). The priors make
deriveDimensionWeights re-balance the four dimensions (need 1.25 / importance
1.11 / trust 0.93 / novelty 0.71) so the SHADOW projection diverges from the
flat incumbent sum — served ranking is unchanged (discovery still observe-only).
Faithful all-1 fallback preserved when no snapshot or zero standing.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Y98FMjkM8zUDsYqJikzsMB
```

## Body

Ratify the four discovery invariants (inv.reasoning.134-137) to validated
and give each a seed_validations prior (need 5 > importance 4 > trust 3 >
novelty 2). Standing is derived from times_validated via computeStandingScore
(lifecycle.ts), so seeding the validation count is the recompute-safe, ledger-
honest lever — a direct standing column write would be wiped by the next
recompute. The ingest now honours seed_validations: sets times_validated +
derived standing on insert, and on update only when the row has not earned
real validation yet (never clobbers accrued evidence). The priors make
deriveDimensionWeights re-balance the four dimensions (need 1.25 / importance
1.11 / trust 0.93 / novelty 0.71) so the SHADOW projection diverges from the
flat incumbent sum — served ranking is unchanged (discovery still observe-only).
Faithful all-1 fallback preserved when no snapshot or zero standing.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Y98FMjkM8zUDsYqJikzsMB

## Files Changed

| Change | File |
|--------|------|
| Modified | `codexes/packs/irl/foundation/appendix-a_canonical-invariants.md` |
| Modified | `codexes/packs/irl/foundation/canonical-invariants.seed.json` |
| Modified | `scripts/ingest-canonical-invariants.mjs` |
| Modified | `services/invariants/nodes/discoveryRanking.ts` |

## Stats

 4 files changed, 63 insertions(+), 25 deletions(-)
