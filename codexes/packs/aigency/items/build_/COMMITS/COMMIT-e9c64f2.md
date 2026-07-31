# Commit Brief: `e9c64f2` — implement invariant collections + invariantqube publication (chrysalis phase 2)

| Field | Value |
|-------|-------|
| SHA | [`e9c64f2`](https://github.com/iQube-Protocol/AigentZBeta/commit/e9c64f2adc10aa5f7198ff0864ded5396b7c668c) |
| Author | Claude |
| Date | 2026-07-03T20:30:22Z |
| Branch | dev (direct push) |
| Type | `feat` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
implement invariant collections + invariantqube publication (chrysalis phase 2)

CFS-001 Level 2/3, CFS-004 §3, CFS-005. Additive migration: invariant_collections + invariant_collection_members (Level 2), invariant_qubes (Level 3 registry link + composition manifest), invariant_qube_published action type. services/invariants/collections.ts (grouping) + publish.ts (composeManifest with weakest-link aggregate confidence, mean aggregate standing, coherence gate rejecting contradicting members; publishInvariantQube registers a DataQube via the VentureQube precedent — meta record + iqube_id_map source=triad_meta + ownership + DVN-anchored receipt). Spine-gated routes: /api/invariants/collections{,/[id]}, /api/registry/invariant-qube{,/[id]}. 5 new aggregation/coherence canaries (17 passing total).

Co-Authored-By: Claude <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Y98FMjkM8zUDsYqJikzsMB
```

## Body

CFS-001 Level 2/3, CFS-004 §3, CFS-005. Additive migration: invariant_collections + invariant_collection_members (Level 2), invariant_qubes (Level 3 registry link + composition manifest), invariant_qube_published action type. services/invariants/collections.ts (grouping) + publish.ts (composeManifest with weakest-link aggregate confidence, mean aggregate standing, coherence gate rejecting contradicting members; publishInvariantQube registers a DataQube via the VentureQube precedent — meta record + iqube_id_map source=triad_meta + ownership + DVN-anchored receipt). Spine-gated routes: /api/invariants/collections{,/[id]}, /api/registry/invariant-qube{,/[id]}. 5 new aggregation/coherence canaries (17 passing total).

Co-Authored-By: Claude <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Y98FMjkM8zUDsYqJikzsMB

## Files Changed

| Change | File |
|--------|------|
| Added | `app/api/invariants/collections/[id]/route.ts` |
| Added | `app/api/invariants/collections/route.ts` |
| Added | `app/api/registry/invariant-qube/[id]/route.ts` |
| Added | `app/api/registry/invariant-qube/route.ts` |
| Modified | `services/dvn/activityReceiptDvnPipeline.ts` |
| Added | `services/invariants/collections.ts` |
| Modified | `services/invariants/index.ts` |
| Added | `services/invariants/publish.ts` |
| Modified | `services/receipts/activityReceiptService.ts` |
| Added | `supabase/migrations/20260703210000_invariant_collections_and_qubes.sql` |
| Modified | `tests/invariant-substrate.test.ts` |
| Modified | `types/invariants.ts` |

## Stats

 12 files changed, 972 insertions(+), 1 deletion(-)
