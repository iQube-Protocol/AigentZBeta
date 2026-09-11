# Commit Brief: `ff63bfe` — nbeLlmRerank: bump max_tokens 400 → 1500, log parse failures

| Field | Value |
|-------|-------|
| SHA | [`ff63bfe`](https://github.com/iQube-Protocol/AigentZBeta/commit/ff63bfee9a594938d89d0bec840f450f3bc9d610) |
| Author | Claude |
| Date | 2026-05-31T20:41:16Z |
| Branch | dev (direct push) |
| Type | `chore` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
nbeLlmRerank: bump max_tokens 400 → 1500, log parse failures

Operator's brief response carried empty nbaContextualTitles + empty
nbaPromptHints + null topNbeReason after the contextual-titles
landing — classic early-return signature when Anthropic returns a
truncated JSON body and JSON.parse() throws.

Root cause: the system prompt now demands BOTH nbaContextualTitles
(≤140 chars × N candidates) AND nbaPromptHints (≤200 chars × N) plus
the order array + topReason in one response. At 5 candidates that's
~5 × (140 + 200) + ~50 overhead ≈ 425 tokens of content alone, before
JSON structure punctuation. max_tokens was set to 400 from the
pre-titles era — Anthropic truncated mid-response, the closing brace
never landed, JSON.parse threw, the rerank fell back to "deterministic
order, no titles, no hints, no topReason" and the FE rendered the
generic catalogue labels.

Fix:
  - max_tokens 400 → 1500 (covers 10+ candidates comfortably)
  - abort timeout 8s → 12s (matches the new ceiling)
  - parse-fail and shape-mismatch branches now console.warn the first
    200 chars of the raw body so future drift (quota error, schema
    change, etc.) doesn't fall silently into the same empty-result
    pattern.

Operator should see contextualTitles + promptHints populated on the
next brief / move-forward render once the deploy lands.
```

## Body

Operator's brief response carried empty nbaContextualTitles + empty
nbaPromptHints + null topNbeReason after the contextual-titles
landing — classic early-return signature when Anthropic returns a
truncated JSON body and JSON.parse() throws.

Root cause: the system prompt now demands BOTH nbaContextualTitles
(≤140 chars × N candidates) AND nbaPromptHints (≤200 chars × N) plus
the order array + topReason in one response. At 5 candidates that's
~5 × (140 + 200) + ~50 overhead ≈ 425 tokens of content alone, before
JSON structure punctuation. max_tokens was set to 400 from the
pre-titles era — Anthropic truncated mid-response, the closing brace
never landed, JSON.parse threw, the rerank fell back to "deterministic
order, no titles, no hints, no topReason" and the FE rendered the
generic catalogue labels.

Fix:
  - max_tokens 400 → 1500 (covers 10+ candidates comfortably)
  - abort timeout 8s → 12s (matches the new ceiling)
  - parse-fail and shape-mismatch branches now console.warn the first
    200 chars of the raw body so future drift (quota error, schema
    change, etc.) doesn't fall silently into the same empty-result
    pattern.

Operator should see contextualTitles + promptHints populated on the
next brief / move-forward render once the deploy lands.

## Files Changed

| Change | File |
|--------|------|
| Modified | `services/orchestration/nbeLlmRerank.ts` |

## Stats

 1 file changed, 13 insertions(+), 2 deletions(-)
