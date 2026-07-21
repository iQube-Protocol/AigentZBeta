# Commit Brief: `12f76e9` — Build CCRL research object model + receipted lifecycles (CFS-019 Phase C1)

| Field | Value |
|-------|-------|
| SHA | [`12f76e9`](https://github.com/iQube-Protocol/AigentZBeta/commit/12f76e9661f4c073565c71260cb7dfcc057b5bb7) |
| Author | Claude |
| Date | 2026-07-06T19:37:54Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Build CCRL research object model + receipted lifecycles (CFS-019 Phase C1)

types/research.ts: experiment/series/publication/finding contracts,
lifecycle orders canary-pinned (sequencing corollary), the four founding
experiments registered with governing invariants verified against the seed
crystal, transition legality (one step forward or re-enter running).
services/research/lifecycle.ts: lifecycle DERIVED from the canonical
record (published = hash-committed run exists; replicated = >=2 distinct
providers) — never asserted; operator transitions receipted as
research_lifecycle_transition (DVN-anchorable; one-line union additions
audited) with evidence required and governing invariants as
invariants_used. Routes /api/research/overview + /api/research/lifecycle;
Dashboard lifecycle strips. C2 (ICE research copilot) split to its own
increment per the dev-loop misroute precedent.

Co-Authored-By: Claude <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Y98FMjkM8zUDsYqJikzsMB
```

## Body

types/research.ts: experiment/series/publication/finding contracts,
lifecycle orders canary-pinned (sequencing corollary), the four founding
experiments registered with governing invariants verified against the seed
crystal, transition legality (one step forward or re-enter running).
services/research/lifecycle.ts: lifecycle DERIVED from the canonical
record (published = hash-committed run exists; replicated = >=2 distinct
providers) — never asserted; operator transitions receipted as
research_lifecycle_transition (DVN-anchorable; one-line union additions
audited) with evidence required and governing invariants as
invariants_used. Routes /api/research/overview + /api/research/lifecycle;
Dashboard lifecycle strips. C2 (ICE research copilot) split to its own
increment per the dev-loop misroute precedent.

Co-Authored-By: Claude <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Y98FMjkM8zUDsYqJikzsMB

## Files Changed

| Change | File |
|--------|------|
| Added | `app/api/research/lifecycle/route.ts` |
| Added | `app/api/research/overview/route.ts` |
| Modified | `codexes/packs/agentiq/foundation/CFS-015_operation-chrysalis-2-prd.md` |
| Modified | `codexes/packs/agentiq/foundation/CFS-019_ccrl-charter.md` |
| Modified | `components/composer/CCRLDashboardTab.tsx` |
| Modified | `services/dvn/activityReceiptDvnPipeline.ts` |
| Modified | `services/receipts/activityReceiptService.ts` |
| Added | `services/research/lifecycle.ts` |
| Modified | `tests/constitutional-contracts.test.ts` |
| Added | `types/research.ts` |

## Stats

 10 files changed, 402 insertions(+), 1 deletion(-)
