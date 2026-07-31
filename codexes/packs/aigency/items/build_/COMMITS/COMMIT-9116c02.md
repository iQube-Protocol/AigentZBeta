# Commit Brief: `9116c02` — Execute CCRL Phase D: physical migration of the research corpus into the ccrl pack (atomic)

| Field | Value |
|-------|-------|
| SHA | [`9116c02`](https://github.com/iQube-Protocol/AigentZBeta/commit/9116c0219aaf12be53ee8c6580675c18151f0b9b) |
| Author | Claude |
| Date | 2026-07-06T22:40:17Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Execute CCRL Phase D: physical migration of the research corpus into the ccrl pack (atomic)

The entire constitutional research corpus (CFS-000..020, CRP-001, glossary,
seed crystal, Appendix A, constitutional record, experiments) moves from
codexes/packs/agentiq/foundation/ to codexes/packs/ccrl/foundation/ via
git mv, with every path coupling updated in this same commit (CFS-019 §7
preflight inventory):

- codexes/packs/ccrl/collections.json: created — col_foundation +
  col_experiments (pack-relative item paths preserved), pack name/description
  'CCRL — Constitutional Cybernetics Research Laboratory'
- codexes/packs/agentiq/collections.json: col_foundation + col_experiments
  removed (col_updates and all other collections untouched)
- data/codex-configs.ts: every tab consuming those collections repointed
  packId 'agentiq' -> 'ccrl' (AGENTIQ_CARTRIDGE foundation + experiments tabs;
  CCRL_CARTRIDGE charter, layer-i/ii/iii, protocols, glossary, programmes
  tabs) — collectionIds and defaultPaths unchanged
- services/constitutional/ontologyResolver.ts: CANON_SOURCES glossary path
- scripts/ingest-canonical-invariants.mjs: SEED_PATH + header comment
- tests/constitutional-contracts.test.ts: seed-crystal import path
- types/research.ts: protocolRefs (EXP-001/002/003) + charterRefs
  (CFS-015, CFS-018)
- services/experiments/exp001.ts: EXP-001 artifact directory
- app/api/experiments/results/backfill/route.ts: three result-JSON imports
- scripts/benchmark-rediscovery.mjs: OUT_DIR (+ header comment)
- scripts/evaluate-exp001.mjs: EXP_DIR
- next.config.js: outputFileTracingIncludes for /api/experiments/exp001
- canonical-invariants.seed.json: source field
- app/api/codex/registry/_lib/packRegistry.ts: 'ccrl' added to the
  auto-generation skip list (CCRL_CARTRIDGE is the canonical registration)
- CFS-019: Phase D marked delivered with the coupling list; CFS-015: Phase D
  record paragraph appended

Verified: zero 'agentiq/foundation' references remain in ts/tsx/mjs/json/js;
esbuild parses every touched code file; both collections.json load; the
130-invariant seed crystal loads from its ccrl path; resolveOntology resolves
glossary terms with invariant ids from the moved glossary; every ccrl-tab
defaultPath exists on disk under codexes/packs/ccrl/.

Co-Authored-By: Claude <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Y98FMjkM8zUDsYqJikzsMB
```

## Body

The entire constitutional research corpus (CFS-000..020, CRP-001, glossary,
seed crystal, Appendix A, constitutional record, experiments) moves from
codexes/packs/agentiq/foundation/ to codexes/packs/ccrl/foundation/ via
git mv, with every path coupling updated in this same commit (CFS-019 §7
preflight inventory):

- codexes/packs/ccrl/collections.json: created — col_foundation +
  col_experiments (pack-relative item paths preserved), pack name/description
  'CCRL — Constitutional Cybernetics Research Laboratory'
- codexes/packs/agentiq/collections.json: col_foundation + col_experiments
  removed (col_updates and all other collections untouched)
- data/codex-configs.ts: every tab consuming those collections repointed
  packId 'agentiq' -> 'ccrl' (AGENTIQ_CARTRIDGE foundation + experiments tabs;
  CCRL_CARTRIDGE charter, layer-i/ii/iii, protocols, glossary, programmes
  tabs) — collectionIds and defaultPaths unchanged
- services/constitutional/ontologyResolver.ts: CANON_SOURCES glossary path
- scripts/ingest-canonical-invariants.mjs: SEED_PATH + header comment
- tests/constitutional-contracts.test.ts: seed-crystal import path
- types/research.ts: protocolRefs (EXP-001/002/003) + charterRefs
  (CFS-015, CFS-018)
- services/experiments/exp001.ts: EXP-001 artifact directory
- app/api/experiments/results/backfill/route.ts: three result-JSON imports
- scripts/benchmark-rediscovery.mjs: OUT_DIR (+ header comment)
- scripts/evaluate-exp001.mjs: EXP_DIR
- next.config.js: outputFileTracingIncludes for /api/experiments/exp001
- canonical-invariants.seed.json: source field
- app/api/codex/registry/_lib/packRegistry.ts: 'ccrl' added to the
  auto-generation skip list (CCRL_CARTRIDGE is the canonical registration)
- CFS-019: Phase D marked delivered with the coupling list; CFS-015: Phase D
  record paragraph appended

Verified: zero 'agentiq/foundation' references remain in ts/tsx/mjs/json/js;
esbuild parses every touched code file; both collections.json load; the
130-invariant seed crystal loads from its ccrl path; resolveOntology resolves
glossary terms with invariant ids from the moved glossary; every ccrl-tab
defaultPath exists on disk under codexes/packs/ccrl/.

Co-Authored-By: Claude <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Y98FMjkM8zUDsYqJikzsMB

## Files Changed

| Change | File |
|--------|------|
| Modified | `app/api/codex/registry/_lib/packRegistry.ts` |
| Modified | `app/api/experiments/results/backfill/route.ts` |
| Modified | `codexes/packs/agentiq/collections.json` |
| Deleted | `codexes/packs/agentiq/foundation/CFS-000_vision-and-computational-architecture.md` |
| Deleted | `codexes/packs/agentiq/foundation/CFS-000a_invariant-manifesto.md` |
| Deleted | `codexes/packs/agentiq/foundation/CFS-001_the-invariant-primitive.md` |
| Deleted | `codexes/packs/agentiq/foundation/CFS-002_the-invariant-ontology.md` |
| Deleted | `codexes/packs/agentiq/foundation/CFS-003_the-invariant-graph.md` |
| Deleted | `codexes/packs/agentiq/foundation/CFS-003a_the-invariant-service.md` |
| Deleted | `codexes/packs/agentiq/foundation/CFS-004_iqube-evolution.md` |
| Deleted | `codexes/packs/agentiq/foundation/CFS-005_registry-evolution.md` |
| Deleted | `codexes/packs/agentiq/foundation/CFS-006_adaptive-runtime.md` |
| Deleted | `codexes/packs/agentiq/foundation/CFS-006a_consequence-operating-model.md` |
| Deleted | `codexes/packs/agentiq/foundation/CFS-007_adaptive-experience-rendering.md` |
| Deleted | `codexes/packs/agentiq/foundation/CFS-008_reasoning-compression.md` |
| Deleted | `codexes/packs/agentiq/foundation/CFS-008a_reasoning-compression-paper.md` |
| Deleted | `codexes/packs/agentiq/foundation/CFS-009_development-constitution.md` |
| Deleted | `codexes/packs/agentiq/foundation/CFS-010_migration-strategy.md` |
| Deleted | `codexes/packs/agentiq/foundation/CFS-011_style-invariant-specification.md` |
| Deleted | `codexes/packs/agentiq/foundation/CFS-012_narrative-invariant-specification.md` |
| Deleted | `codexes/packs/agentiq/foundation/CFS-013_invariant-composition-laws.md` |
| Deleted | `codexes/packs/agentiq/foundation/CFS-014_constitutional-coherence-engine.md` |
| Deleted | `codexes/packs/agentiq/foundation/CFS-015_operation-chrysalis-2-prd.md` |
| Deleted | `codexes/packs/agentiq/foundation/CFS-016_constitutional-deployment.md` |
| Deleted | `codexes/packs/agentiq/foundation/CFS-017_a2ui-coherence-seam.md` |
| Deleted | `codexes/packs/agentiq/foundation/CFS-018_platform-sovereignty.md` |
| Deleted | `codexes/packs/agentiq/foundation/CFS-019_ccrl-charter.md` |
| Deleted | `codexes/packs/agentiq/foundation/CFS-020_dcir-charter.md` |
| Deleted | `codexes/packs/agentiq/foundation/CRP-001_constitutional-research-program-charter.md` |
| Deleted | `codexes/packs/agentiq/foundation/appendix-a_canonical-invariants.md` |
| Deleted | `codexes/packs/agentiq/foundation/canonical-invariants.seed.json` |
| Deleted | `codexes/packs/agentiq/foundation/constitutional-glossary.md` |
| Deleted | `codexes/packs/agentiq/foundation/constitutional-record.md` |
| Deleted | `codexes/packs/agentiq/foundation/experiments/exp-001-living-knowledgeqube/README.md` |
| Deleted | `codexes/packs/agentiq/foundation/experiments/exp-001-living-knowledgeqube/canonical-article.md` |
| Deleted | `codexes/packs/agentiq/foundation/experiments/exp-001-living-knowledgeqube/evaluation-protocol.md` |
| Deleted | `codexes/packs/agentiq/foundation/experiments/exp-001-living-knowledgeqube/evaluation-results-2026-07-04.json` |
| Deleted | `codexes/packs/agentiq/foundation/experiments/exp-001-living-knowledgeqube/infographic.md` |
| Deleted | `codexes/packs/agentiq/foundation/experiments/exp-001-living-knowledgeqube/report.md` |
| Deleted | `codexes/packs/agentiq/foundation/experiments/exp-001-living-knowledgeqube/story.md` |

_…and more (truncated at 40 files)._

## Stats

 99 files changed, 7444 insertions(+), 7431 deletions(-)
