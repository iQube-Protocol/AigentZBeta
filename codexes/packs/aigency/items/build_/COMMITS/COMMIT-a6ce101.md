# Commit Brief: `a6ce101` — ratify law xii: truth, standing and reach — canon + code (standing/reach split, epistemic type)

| Field | Value |
|-------|-------|
| SHA | [`a6ce101`](https://github.com/iQube-Protocol/AigentZBeta/commit/a6ce101a3d1b27709911b7b03eaf77c3d30551b8) |
| Author | Claude |
| Date | 2026-07-03T23:18:50Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
ratify law xii: truth, standing and reach — canon + code (standing/reach split, epistemic type)

CFS-009 amendment: Law XII with three corollaries + the canonical paragraph (also added to CFS-000a). Appendix A + seed gain inv.constitutional.060-062 (proposed as INV-055-057; renumbered — ids taken, append-only rule). Code reflects the constitutional text: invariants.reach column + backfill migration splitting adoption out of standing; computeStandingScore now validation-class only, new computeReachScore adoption-class only; 'epistemic' semantic type ratified in CHECKs + TS union; CFS-001 §6.2 updated. New orthogonality canaries (27 passing).

Co-Authored-By: Claude <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Y98FMjkM8zUDsYqJikzsMB
```

## Body

CFS-009 amendment: Law XII with three corollaries + the canonical paragraph (also added to CFS-000a). Appendix A + seed gain inv.constitutional.060-062 (proposed as INV-055-057; renumbered — ids taken, append-only rule). Code reflects the constitutional text: invariants.reach column + backfill migration splitting adoption out of standing; computeStandingScore now validation-class only, new computeReachScore adoption-class only; 'epistemic' semantic type ratified in CHECKs + TS union; CFS-001 §6.2 updated. New orthogonality canaries (27 passing).

Co-Authored-By: Claude <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Y98FMjkM8zUDsYqJikzsMB

## Files Changed

| Change | File |
|--------|------|
| Modified | `codexes/packs/agentiq/foundation/CFS-000a_invariant-manifesto.md` |
| Modified | `codexes/packs/agentiq/foundation/CFS-001_the-invariant-primitive.md` |
| Modified | `codexes/packs/agentiq/foundation/CFS-009_development-constitution.md` |
| Modified | `codexes/packs/agentiq/foundation/appendix-a_canonical-invariants.md` |
| Modified | `codexes/packs/agentiq/foundation/canonical-invariants.seed.json` |
| Modified | `services/invariants/index.ts` |
| Modified | `services/invariants/lifecycle.ts` |
| Modified | `services/invariants/store.ts` |
| Added | `supabase/migrations/20260703230000_law_xii_truth_standing_reach.sql` |
| Modified | `tests/invariant-substrate.test.ts` |
| Modified | `types/invariants.ts` |

## Stats

 11 files changed, 207 insertions(+), 27 deletions(-)
