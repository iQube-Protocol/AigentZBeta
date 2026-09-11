# Commit Brief: `a6baa9b` — CFS-035 Phase 1 finish: grounding consolidation + node invariants + flip-receipt CHECK fix

| Field | Value |
|-------|-------|
| SHA | [`a6baa9b`](https://github.com/iQube-Protocol/AigentZBeta/commit/a6baa9bf3c3f76ee0bc5c956479a09442d460322) |
| Author | Claude |
| Date | 2026-07-16T22:29:04Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
CFS-035 Phase 1 finish: grounding consolidation + node invariants + flip-receipt CHECK fix

- Consolidation: route the 5 remaining grounded surfaces through the engine's
  Reasoning face (groundReasoning) instead of hand-rolled buildInvariantSlice —
  specialist (ask-agent), runArtifact, ontology resolver, renderInstrumentation,
  composeArtifact. Behaviour-identical (groundReasoning composes buildInvariantSlice);
  one seam now, so future grounding changes land in one place.
- Shared node helpers in engine.ts: deriveWeightsFromStanding + getCachedFieldSnapshot
  (the discovery pattern generalised). discoveryRanking refactored onto them;
  nbeRanking now derives importance/need weights (faithful at equal weights).
- Seed node-governing invariants 151-156 (nbe importance/need, standing veracity/
  contribution, journey one-rung/sovereign-ask), proposed — nodes stay faithful
  until validated (shadow-first). + appendix mirror.
- FIX (flip-DVN-anchor bug): migration 20260718020000 adds invariant_node_flipped
  to the activity_receipts action_type CHECK — without it the flip receipt insert
  violates the constraint and the on-chain anchor is silently lost (flip still
  succeeds; receipt is best-effort). Complete union preserved + the new type.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Y98FMjkM8zUDsYqJikzsMB
```

## Body

- Consolidation: route the 5 remaining grounded surfaces through the engine's
  Reasoning face (groundReasoning) instead of hand-rolled buildInvariantSlice —
  specialist (ask-agent), runArtifact, ontology resolver, renderInstrumentation,
  composeArtifact. Behaviour-identical (groundReasoning composes buildInvariantSlice);
  one seam now, so future grounding changes land in one place.
- Shared node helpers in engine.ts: deriveWeightsFromStanding + getCachedFieldSnapshot
  (the discovery pattern generalised). discoveryRanking refactored onto them;
  nbeRanking now derives importance/need weights (faithful at equal weights).
- Seed node-governing invariants 151-156 (nbe importance/need, standing veracity/
  contribution, journey one-rung/sovereign-ask), proposed — nodes stay faithful
  until validated (shadow-first). + appendix mirror.
- FIX (flip-DVN-anchor bug): migration 20260718020000 adds invariant_node_flipped
  to the activity_receipts action_type CHECK — without it the flip receipt insert
  violates the constraint and the on-chain anchor is silently lost (flip still
  succeeds; receipt is best-effort). Complete union preserved + the new type.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Y98FMjkM8zUDsYqJikzsMB

## Files Changed

| Change | File |
|--------|------|
| Modified | `app/api/assistant/ask-agent/route.ts` |
| Modified | `codexes/packs/irl/foundation/appendix-a_canonical-invariants.md` |
| Modified | `codexes/packs/irl/foundation/canonical-invariants.seed.json` |
| Modified | `services/artifact/runArtifact.ts` |
| Modified | `services/composition/composeArtifact.ts` |
| Modified | `services/constitutional/ontologyResolver.ts` |
| Modified | `services/constitutional/renderInstrumentation.ts` |
| Modified | `services/invariants/engine.ts` |
| Modified | `services/invariants/nodes/discoveryRanking.ts` |
| Modified | `services/invariants/nodes/nbeRanking.ts` |
| Added | `supabase/migrations/20260718020000_invariant_node_flipped_receipt_type.sql` |

## Stats

 11 files changed, 243 insertions(+), 61 deletions(-)
