# Commit Brief: `8ae5dec` — Chrysalis 2.0 Phase 1: ratify CFS-015 + constitutional contracts, ontology resolver, model router

| Field | Value |
|-------|-------|
| SHA | [`8ae5dec`](https://github.com/iQube-Protocol/AigentZBeta/commit/8ae5deccaa944588bf2b2cf3a51b31fa6e3a1732) |
| Author | Claude |
| Date | 2026-07-06T03:59:39Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Chrysalis 2.0 Phase 1: ratify CFS-015 + constitutional contracts, ontology resolver, model router

Operation Chrysalis 2.0 begins (plan operator-approved 2026-07-06).
Strand One foundations, contracts single-authored per the sequencing
discipline (Appendix B):

- CFS-015 ratified as the canonical implementation PRD, with Appendix A
  (organ map: most named services already exist as production organs —
  Chrysalis 2.0 is promotion + adoption + four new builds) and Appendix
  B (strand dependency spine; deployment autonomy operator-gated per
  Law XI). CRP-001 charter created as the companion research program —
  explicitly out of implementation scope, founding assets transferred
  (Foundational Validation Series, Experiment Lab, EXP-002b, the
  sovereignty drill). Chrysalis Contract recorded in CFS-009 as Law X
  restated at program level. Both docs registered in col_foundation.

- types/constitutional.ts: contract-first interfaces for the six
  reasoning services (facades over existing organs, never forks), the
  honest-stub envelope (MaybeEvaluated — CFS-014 discipline), stub
  slots (RiskQube/ValueQube/PriceQube/routers/intelligence), the named
  NBEPlan type, and the pinned pipeline constant (order is
  constitutional data).

- Canonical Ontology Service (services/constitutional/ontologyResolver):
  resolves terms against the terminology canon (parsed from
  docs/platform-ontology.md incl. its own forbidden-variant lists —
  "black qube" resolves to BlakQube, "agent me" to aigentMe) and the
  invariant ontology (curated concept->seed map, canary-guarded against
  the seed crystal); surfaces unresolvable qube-flavoured drift instead
  of dropping it; assembles ContextPacks; emits the system-prompt
  guidance block; cites governing invariants (Reach) via a new
  getInvariantsBySeedIds store helper.

- Model Router v1 (services/constitutional/modelRouter): per-stage
  provider/model routing over the existing usage-instrumented chain
  (wraps, never forks); allowlist-disciplined env overrides (invalid ->
  ignored, never guessed through); fallback ladder terminates at the
  open-weight provider (venice) per sovereign survivability — a call
  may degrade (flagged), it does not constitutionally fail while any
  provider is reachable.

- Vertical slice: the main copilot chat resolves ontology per turn in
  the existing parallel fetch, appends canonical-term guidance to the
  system prompt, and fire-and-forgets Reach citation. Enrichment-only;
  failures never block a turn. platform-ontology.md traced into the
  chat route bundle.

- Canary suite tests/constitutional-contracts.test.ts (pure-logic,
  substrate mocked): canon parsing, drift resolution, seed-map
  integrity, router allowlists/overrides, sovereign-fallback
  reachability, pipeline order pin. Resolver logic additionally drilled
  green via stubbed esbuild bundle in-session (vitest unavailable in
  sandbox).

Co-Authored-By: Claude <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Y98FMjkM8zUDsYqJikzsMB
```

## Body

Operation Chrysalis 2.0 begins (plan operator-approved 2026-07-06).
Strand One foundations, contracts single-authored per the sequencing
discipline (Appendix B):

- CFS-015 ratified as the canonical implementation PRD, with Appendix A
  (organ map: most named services already exist as production organs —
  Chrysalis 2.0 is promotion + adoption + four new builds) and Appendix
  B (strand dependency spine; deployment autonomy operator-gated per
  Law XI). CRP-001 charter created as the companion research program —
  explicitly out of implementation scope, founding assets transferred
  (Foundational Validation Series, Experiment Lab, EXP-002b, the
  sovereignty drill). Chrysalis Contract recorded in CFS-009 as Law X
  restated at program level. Both docs registered in col_foundation.

- types/constitutional.ts: contract-first interfaces for the six
  reasoning services (facades over existing organs, never forks), the
  honest-stub envelope (MaybeEvaluated — CFS-014 discipline), stub
  slots (RiskQube/ValueQube/PriceQube/routers/intelligence), the named
  NBEPlan type, and the pinned pipeline constant (order is
  constitutional data).

- Canonical Ontology Service (services/constitutional/ontologyResolver):
  resolves terms against the terminology canon (parsed from
  docs/platform-ontology.md incl. its own forbidden-variant lists —
  "black qube" resolves to BlakQube, "agent me" to aigentMe) and the
  invariant ontology (curated concept->seed map, canary-guarded against
  the seed crystal); surfaces unresolvable qube-flavoured drift instead
  of dropping it; assembles ContextPacks; emits the system-prompt
  guidance block; cites governing invariants (Reach) via a new
  getInvariantsBySeedIds store helper.

- Model Router v1 (services/constitutional/modelRouter): per-stage
  provider/model routing over the existing usage-instrumented chain
  (wraps, never forks); allowlist-disciplined env overrides (invalid ->
  ignored, never guessed through); fallback ladder terminates at the
  open-weight provider (venice) per sovereign survivability — a call
  may degrade (flagged), it does not constitutionally fail while any
  provider is reachable.

- Vertical slice: the main copilot chat resolves ontology per turn in
  the existing parallel fetch, appends canonical-term guidance to the
  system prompt, and fire-and-forgets Reach citation. Enrichment-only;
  failures never block a turn. platform-ontology.md traced into the
  chat route bundle.

- Canary suite tests/constitutional-contracts.test.ts (pure-logic,
  substrate mocked): canon parsing, drift resolution, seed-map
  integrity, router allowlists/overrides, sovereign-fallback
  reachability, pipeline order pin. Resolver logic additionally drilled
  green via stubbed esbuild bundle in-session (vitest unavailable in
  sandbox).

Co-Authored-By: Claude <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Y98FMjkM8zUDsYqJikzsMB

## Files Changed

| Change | File |
|--------|------|
| Modified | `app/api/codex/chat/route.ts` |
| Modified | `codexes/packs/agentiq/collections.json` |
| Modified | `codexes/packs/agentiq/foundation/CFS-009_development-constitution.md` |
| Added | `codexes/packs/agentiq/foundation/CFS-015_operation-chrysalis-2-prd.md` |
| Added | `codexes/packs/agentiq/foundation/CRP-001_constitutional-research-program-charter.md` |
| Modified | `next.config.js` |
| Added | `services/constitutional/modelRouter.ts` |
| Added | `services/constitutional/ontologyResolver.ts` |
| Modified | `services/invariants/store.ts` |
| Added | `tests/constitutional-contracts.test.ts` |
| Added | `types/constitutional.ts` |

## Stats

 11 files changed, 1139 insertions(+), 1 deletion(-)
