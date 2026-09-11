# Commit Brief: `b80f4ae` — Chrysalis Phase 2 Agent A: adopt constitutional cycle in assistant surfaces

| Field | Value |
|-------|-------|
| SHA | [`b80f4ae`](https://github.com/iQube-Protocol/AigentZBeta/commit/b80f4ae563bb7b26caf39483bdcf3cac4ce38a07) |
| Author | Claude |
| Date | 2026-07-06T05:33:58Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Chrysalis Phase 2 Agent A: adopt constitutional cycle in assistant surfaces

Strand-1 adoption stream (scope: services/orchestration/nbeLlmRerank.ts
+ app/api/assistant/intent/route.ts — frozen Phase-1 contracts consumed,
never modified; ask-agent untouched as the pattern exemplar):

- nbeLlmRerank (ONE seam covering both /api/assistant/brief and
  /api/assistant/move-forward): invariant grounding slice (cartridge-
  scoped, whole-canon fallback, 8 items, seedId-cited statements) +
  canonical-ontology resolution over the journey context text, both
  fetched in parallel and appended to the rerank prompt only when
  non-empty. Reach citation (citeInvariants + citeResolvedConcepts)
  fires only on the llmApplied:true path — cite what was actually
  used. NO receipts on these hot surfaces (ledger-noise discipline;
  Learning flows via Reach).
- intent route: ontology resolution over the intent's operator-facing
  text; the EXISTING intent_queued receipt gains invariantsUsed
  (governing invariants of resolved concepts, seed->row mapped) with
  omit-not-empty discipline; fire-and-forget Reach citation. No new
  action types, response shape unchanged.

All instrumentation enrichment-only: a request never blocks or fails
on it. Quality Authority review: parse gates green, diff scope-exact,
zero protected-file changes.

Co-Authored-By: Claude <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Y98FMjkM8zUDsYqJikzsMB
```

## Body

Strand-1 adoption stream (scope: services/orchestration/nbeLlmRerank.ts
+ app/api/assistant/intent/route.ts — frozen Phase-1 contracts consumed,
never modified; ask-agent untouched as the pattern exemplar):

- nbeLlmRerank (ONE seam covering both /api/assistant/brief and
  /api/assistant/move-forward): invariant grounding slice (cartridge-
  scoped, whole-canon fallback, 8 items, seedId-cited statements) +
  canonical-ontology resolution over the journey context text, both
  fetched in parallel and appended to the rerank prompt only when
  non-empty. Reach citation (citeInvariants + citeResolvedConcepts)
  fires only on the llmApplied:true path — cite what was actually
  used. NO receipts on these hot surfaces (ledger-noise discipline;
  Learning flows via Reach).
- intent route: ontology resolution over the intent's operator-facing
  text; the EXISTING intent_queued receipt gains invariantsUsed
  (governing invariants of resolved concepts, seed->row mapped) with
  omit-not-empty discipline; fire-and-forget Reach citation. No new
  action types, response shape unchanged.

All instrumentation enrichment-only: a request never blocks or fails
on it. Quality Authority review: parse gates green, diff scope-exact,
zero protected-file changes.

Co-Authored-By: Claude <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Y98FMjkM8zUDsYqJikzsMB

## Files Changed

| Change | File |
|--------|------|
| Modified | `app/api/assistant/intent/route.ts` |
| Modified | `services/orchestration/nbeLlmRerank.ts` |

## Stats

 2 files changed, 119 insertions(+), 1 deletion(-)
