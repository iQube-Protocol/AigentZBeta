# AgentiQ Alpha — Asset Map (Codex Summary)

**Status:** canonical  
**Authority:** product owner  
**Last updated:** 2026-04-06

> Full detail: `docs/alpha/asset-placement-map.md`  
> This is the codex-surfaced summary for stakeholder reference.

---

## Principle

No assets were moved to create this program. The codebase already reflects the four-cartridge model. This map documents where things live.

---

## AgentiQ OS Cartridge

| Asset | Path |
|-------|------|
| SDK | `packages/agentiq-sdk/` |
| Low-level AA client | `packages/aa-client/` |
| OS documentation | `docs/agentiq-os/` *(Phase B — to be built)* |
| Intake schema | `types/registryIngestion.ts` (`IntakeQube`) |
| Aigent C charter | `.claude/agents/aigent-c.md` |

## AgentiQ Platform Cartridge

| Asset | Path |
|-------|------|
| Registry Ingestion Factory | `services/registry/` |
| Factory types | `types/registryIngestion.ts` |
| Registry API | `app/api/registry/` |
| Invocation gateway | `services/registry/invocationGateway.ts` |
| Codex config model | `types/codex.ts` |
| Codex definitions | `data/codex-configs.ts` |
| Studio artifact type | `types/studioArtifact.ts` |
| Orchestration types | `types/orchestration.ts` |
| Aigent Z charter | `.claude/agents/aigent-z-orchestrator.md` |
| Agent harness specs | `docs/agent-harness/` |
| Harness DB migration | `supabase/migrations/20260402000000_experience_model_journey_state.sql` |
| AgentiQ pack | `codexes/packs/agentiq/` |

## metaMe Cartridge

| Asset | Path |
|-------|------|
| Experience model schema | `supabase/migrations/20260402000000_experience_model_journey_state.sql` |
| Experience API | `app/api/runtime/experience/` |
| Experience dashboard | `app/triad/components/codex/tabs/ExperienceDashboardTab.tsx` |
| ComposerStudio | `components/composer/ComposerStudio.tsx` |
| Composer service | `services/composer/` |
| SmartTriad runtime | `app/components/content/SmartTriadProvider.tsx` |
| SmartTriad surfaces | `app/components/content/SmartTriadSurfaces.tsx` |
| SmartWalletDrawer | `app/components/content/SmartWalletDrawer.tsx` |
| metaMe guardian charter | `.claude/agents/metame-guardian.md` |

## KNYT Cartridge

| Asset | Path |
|-------|------|
| $KNYT token types | `app/types/knyt.ts` |
| KNYT balance API | `app/api/codex/knyt-balance/route.ts` |
| Living Canon vote | `app/api/codex/knyt/living-canon/vote/route.ts` |
| Living Canon remix | `app/api/codex/knyt/living-canon/remix/route.ts` |
| Like signal *(Phase D)* | `app/api/codex/knyt/living-canon/like/route.ts` |
| Spark signal *(Phase D)* | `app/api/codex/knyt/living-canon/spark/route.ts` |
| KNYT migrations | `supabase/migrations/20260329*_knyt_*` |
| Kn0w1 charter | `.claude/agents/kn0w1.md` |

## Cross-cutting: Marketa

| Asset | Path |
|-------|------|
| Marketa tab | `app/triad/components/codex/tabs/MarketaTab.tsx` |
| Marketa pack | `codexes/packs/marketa/` |
| Marketa charter | `.claude/agents/marketa.md` |

## Alpha program documentation

| Asset | Path |
|-------|------|
| Architecture memo | `docs/alpha/architecture-memo.md` |
| Asset placement map | `docs/alpha/asset-placement-map.md` |
| Build plan | `docs/alpha/build-plan.md` |
| AgentiQ OS docs *(Phase B)* | `docs/agentiq-os/` |
| Golden-path demo *(Phase E)* | `docs/alpha/golden-path-demo.md` |
| Launch package *(Phase E)* | `docs/alpha/launch/` |
