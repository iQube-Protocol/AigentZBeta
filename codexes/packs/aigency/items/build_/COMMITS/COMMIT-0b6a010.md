# Commit Brief: `0b6a010` — Add Threshold MCP Bridge public knowledge & discovery layer (Qriptopian, IRL OS, AgentiQ OS, Polity Core)

| Field | Value |
|-------|-------|
| SHA | [`0b6a010`](https://github.com/iQube-Protocol/AigentZBeta/commit/0b6a010e89137877b31eb39b11140f4aaaec4876) |
| Author | Claude |
| Date | 2026-09-03T05:27:13Z |
| Branch | dev (direct push) |
| Type | `feat` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Add Threshold MCP Bridge public knowledge & discovery layer (Qriptopian, IRL OS, AgentiQ OS, Polity Core)

Five new unauthenticated, read-only MCP tools (list_public_cartridges,
list_public_documents, read_public_document, search_public_knowledge,
list_public_capabilities) plus an orientation resource/prompt, backed by a
new services/threshold/publicKnowledge.ts adapter. Grants no execution
authority, no delegation, and no access to private/restricted research.

Cartridge identities resolved by direct audit, not assumed: Qriptopian
(qripto-codex) reuses the live public papers/essays REST routes rather than
a parallel query path; IRL OS (irl-os-cartridge, distinct from the private
irl-cartridge workspace) delegates entirely to the existing IrlAdapter,
since its foundation/ pack is a confirmed mixed public/confidential corpus
per the 2026-08-27 containment audit; AgentiQ OS (agentiq-os-cartridge)
allowlists its 16 public guides plus the 7-file Constitutional Capability
Briefs subset, explicitly excluding the 474-file internal updates/ stream
its own non-gated Updates tab otherwise leaks; Polity Core
(polity-core-cartridge) allowlists 23 documents tagged with each one's own
self-declared ratification status (verified per-file, never inferred),
excluding the one adminOnly working-manuscript tab.

Access control is default-deny/allowlist-only throughout — no directory
scan, no caller-supplied path ever reaches the pack-corpus reader. Search
is honestly keyword-only (searchMode:"keyword" in every response); this
layer never calls the confirmed domain-unscoped embedding pipeline
(embeddingService.processUnembeddedChunks, already reachable unscoped from
the admin KB ingest route) or the KB service directly.

Live-verified against the running dev server and the actual Supabase
project (bsjhfvctmduxhohtllly, confirmed via .env.local): all three
prior-review baseline facts for Qriptopian's KB binding state hold exactly
(21 pending/zero-chunk documents, 6 threshold essays with manuscript text,
the Embodiment series_scope misclassification already remediated); the
new tools correctly refuse a non-allowlisted document id before ever
reading it, and a real document returns full text with correct
offset/limit/hasMore pagination and a sha256 that reconstructs across
pages. Qriptopian's own branch of the new layer is blocked in this sandbox
only by a missing SUPABASE_SERVICE_ROLE_KEY (a pre-existing gap in the
underlying qripto routes, confirmed via unit tests mocking the exact real
response shapes read from source).

Extracted the shared resilientFetch helper (services/threshold/
resilientFetch.ts) out of irlAdapter.ts so the new adapter reuses it
rather than forking a second copy.

Full regression: tsc unchanged (678, .next cache noise only); vitest 15
failed files, identical to the pre-existing baseline, none in this area;
new suite (24 tests) plus the full existing threshold-*/irl-* suites (342
tests) all pass.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01S5Y1pnDdW3LyguwPdfJjXy
```

## Body

Five new unauthenticated, read-only MCP tools (list_public_cartridges,
list_public_documents, read_public_document, search_public_knowledge,
list_public_capabilities) plus an orientation resource/prompt, backed by a
new services/threshold/publicKnowledge.ts adapter. Grants no execution
authority, no delegation, and no access to private/restricted research.

Cartridge identities resolved by direct audit, not assumed: Qriptopian
(qripto-codex) reuses the live public papers/essays REST routes rather than
a parallel query path; IRL OS (irl-os-cartridge, distinct from the private
irl-cartridge workspace) delegates entirely to the existing IrlAdapter,
since its foundation/ pack is a confirmed mixed public/confidential corpus
per the 2026-08-27 containment audit; AgentiQ OS (agentiq-os-cartridge)
allowlists its 16 public guides plus the 7-file Constitutional Capability
Briefs subset, explicitly excluding the 474-file internal updates/ stream
its own non-gated Updates tab otherwise leaks; Polity Core
(polity-core-cartridge) allowlists 23 documents tagged with each one's own
self-declared ratification status (verified per-file, never inferred),
excluding the one adminOnly working-manuscript tab.

Access control is default-deny/allowlist-only throughout — no directory
scan, no caller-supplied path ever reaches the pack-corpus reader. Search
is honestly keyword-only (searchMode:"keyword" in every response); this
layer never calls the confirmed domain-unscoped embedding pipeline
(embeddingService.processUnembeddedChunks, already reachable unscoped from
the admin KB ingest route) or the KB service directly.

Live-verified against the running dev server and the actual Supabase
project (bsjhfvctmduxhohtllly, confirmed via .env.local): all three
prior-review baseline facts for Qriptopian's KB binding state hold exactly
(21 pending/zero-chunk documents, 6 threshold essays with manuscript text,
the Embodiment series_scope misclassification already remediated); the
new tools correctly refuse a non-allowlisted document id before ever
reading it, and a real document returns full text with correct
offset/limit/hasMore pagination and a sha256 that reconstructs across
pages. Qriptopian's own branch of the new layer is blocked in this sandbox
only by a missing SUPABASE_SERVICE_ROLE_KEY (a pre-existing gap in the
underlying qripto routes, confirmed via unit tests mocking the exact real
response shapes read from source).

Extracted the shared resilientFetch helper (services/threshold/
resilientFetch.ts) out of irlAdapter.ts so the new adapter reuses it
rather than forking a second copy.

Full regression: tsc unchanged (678, .next cache noise only); vitest 15
failed files, identical to the pre-existing baseline, none in this area;
new suite (24 tests) plus the full existing threshold-*/irl-* suites (342
tests) all pass.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01S5Y1pnDdW3LyguwPdfJjXy

## Files Changed

| Change | File |
|--------|------|
| Modified | `app/api/threshold/mcp/route.ts` |
| Modified | `codexes/packs/agentiq/collections.json` |
| Added | `codexes/packs/agentiq/updates/2026-09-03_threshold-public-knowledge-bridge.md` |
| Modified | `services/threshold/gateway.ts` |
| Modified | `services/threshold/irlAdapter.ts` |
| Added | `services/threshold/publicKnowledge.ts` |
| Added | `services/threshold/resilientFetch.ts` |
| Added | `tests/threshold-public-knowledge-bridge.test.ts` |

## Stats

 8 files changed, 1210 insertions(+), 55 deletions(-)
