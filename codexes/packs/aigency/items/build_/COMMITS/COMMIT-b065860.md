# Commit Brief: `b065860` — intent chains: feedback table + spec §6.7 — like/dislike learning loop

| Field | Value |
|-------|-------|
| SHA | [`b065860`](https://github.com/iQube-Protocol/AigentZBeta/commit/b06586021ef524b9528dee8089268dc558372166) |
| Author | Claude |
| Date | 2026-06-02T00:44:01Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
intent chains: feedback table + spec §6.7 — like/dislike learning loop

Per operator addition: chains gain a like/dislike rating + optional
comment captured on termination. This closes the efficacy loop —
operator + Aigent Z can prioritise template revisions based on dislike
trends + comment corpus.

Spec §6.7:
- Data shape (intent_chain_feedback table)
- UNIQUE (chain_id, persona) — PUT semantics; updates emit a fresh receipt
- DVN receipt event 'intent_chain_feedback_recorded' carries
  comment_present (bool) only — comment text is T1 (training corpus,
  not cross-chain ledger)
- API: PUT/GET /api/intent-chains/[chain_id]/feedback +
  GET /api/intent-chains/feedback/aggregate (admin)
- UI: Chain Detail Drawer footer on terminated chains; like = single
  click, dislike expands a "what didn't work" comment textarea
- v1.5+ downstream: cluster comments for failure-mode analysis;
  template-health metric on cartridge Browse; feed comments into
  Aigent Z's per-template tuning loop

Migration extended:
- Add intent_chain_feedback table to the same migration file (operator
  hasn't applied yet — single SQL paste covers the full v1 surface)
- 2000-char CHECK on comment as safety net (API enforces too)
- 2 indexes: chain_id (lookup), (rating, rated_at) (aggregate stats)
- ENABLE RLS

OrchestrationEventType: + 'intent_chain_feedback_recorded'
```

## Body

Per operator addition: chains gain a like/dislike rating + optional
comment captured on termination. This closes the efficacy loop —
operator + Aigent Z can prioritise template revisions based on dislike
trends + comment corpus.

Spec §6.7:
- Data shape (intent_chain_feedback table)
- UNIQUE (chain_id, persona) — PUT semantics; updates emit a fresh receipt
- DVN receipt event 'intent_chain_feedback_recorded' carries
  comment_present (bool) only — comment text is T1 (training corpus,
  not cross-chain ledger)
- API: PUT/GET /api/intent-chains/[chain_id]/feedback +
  GET /api/intent-chains/feedback/aggregate (admin)
- UI: Chain Detail Drawer footer on terminated chains; like = single
  click, dislike expands a "what didn't work" comment textarea
- v1.5+ downstream: cluster comments for failure-mode analysis;
  template-health metric on cartridge Browse; feed comments into
  Aigent Z's per-template tuning loop

Migration extended:
- Add intent_chain_feedback table to the same migration file (operator
  hasn't applied yet — single SQL paste covers the full v1 surface)
- 2000-char CHECK on comment as safety net (API enforces too)
- 2 indexes: chain_id (lookup), (rating, rated_at) (aggregate stats)
- ENABLE RLS

OrchestrationEventType: + 'intent_chain_feedback_recorded'

## Files Changed

| Change | File |
|--------|------|
| Modified | `codexes/packs/agentiq/items/AGENTIQ_INTENT_CHAINS_SPEC.md` |
| Modified | `supabase/migrations/20260602100000_intent_chains.sql` |
| Modified | `types/orchestration.ts` |

## Stats

 3 files changed, 115 insertions(+)
