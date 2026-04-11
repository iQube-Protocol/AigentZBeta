# AgentiQ Alpha — Asset Placement Map

**Status:** canonical  
**Authority:** product owner  
**Last updated:** 2026-04-06

This document records the canonical home of every significant asset, service, component, and data structure in the codebase, mapped to its owning cartridge. No assets are moved — this is documentation of where things already live.

---

## Cartridge 1: AgentiQ OS

**Role:** Public upstream build and contributor zone  
**Lead Aigent:** Aigent C

| Asset | Path | Description |
|-------|------|-------------|
| SDK public API | `packages/agentiq-sdk/` | `AgentIQClient`, `A2AClient`, typed messages, agent personas |
| Low-level AA client | `packages/aa-client/` | Direct AA-API access |
| OS documentation | `docs/agentiq-os/` | README, quickstart, contribution categories, packaging standards, submission guide |
| Contribution intake schema | `types/registryIngestion.ts` | `IntakeQube` — canonical submission schema |
| Aigent C charter | `.claude/agents/aigent-c.md` | Role, authority, builder journey guidance |
| Operations guide | `docs/AIGENT_OPERATIONS_GUIDE.md` | Comprehensive agent ops, chains, wallet configs |

**Boundary:** Public-facing. Contains no private policies, prompts, or platform secrets. Everything here is contributed or used by external builders.

---

## Cartridge 2: AgentiQ Platform

**Role:** Proprietary platform operations and governance zone  
**Lead Aigent:** Aigent Z

| Asset | Path | Description |
|-------|------|-------------|
| Registry Ingestion Factory | `services/registry/` | Full pipeline: intake → classify → validate → trust score → publish → receipt |
| Factory type system | `types/registryIngestion.ts` | All ingestion types, trust bands, validation stages, receipt model |
| Registry API routes | `app/api/registry/` | REST intake and query routes |
| Invocation gateway | `services/registry/invocationGateway.ts` | Routes invocation calls to published assets |
| Codex config model | `types/codex.ts` | `CodexConfig`, `CodexTab`, permissions, liquid UI config |
| Codex registry API | `app/api/codex/registry/` | CRUD for codexes and tabs |
| Codex definitions | `data/codex-configs.ts` | Hardcoded codex configs: KNYT, Qripto, AgentiQ |
| Studio artifact type | `types/studioArtifact.ts` | `StudioArtifact` — canonical handoff format Studio↔Codex↔Runtime |
| Orchestration events | `types/orchestration.ts` | `OrchestrationEvent`, `HandoffPayload`, `NBEPlan` |
| Copilot actions | `app/(shell)/copilot/actions/` | Platform-internal copilot registry actions |
| Aigent Z charter | `.claude/agents/aigent-z-orchestrator.md` | Role, authority, routing logic |
| Agent harness specs | `docs/agent-harness/` | metaproof-core, aigent-z-aigent-c-contract, journey-state-schema, studio-artifact-schema |
| Harness DB migration | `supabase/migrations/20260402000000_experience_model_journey_state.sql` | Creates harness tables |
| Codex registry migration | `supabase/migrations/20250101_codex_registry.sql` | Creates codex_configs and codex_tabs tables |
| Platform pack | `codexes/packs/agentiq/` | AgentiQ cartridge pack: decisions, system map, work allocation, PR briefs |

**Boundary:** Private. Contains platform governance, orchestration logic, internal workflows. Not accessible to external contributors.

---

## Cartridge 3: metaMe

**Role:** Personal sovereignty, Runtime, Studio, and experience progression zone  
**Lead Aigent:** metaMe

| Asset | Path | Description |
|-------|------|-------------|
| Experience model schema | `supabase/migrations/20260402000000_experience_model_journey_state.sql` | `experience_strategies`, `experience_models`, `experience_matrices`, `journey_states`, `nbe_plans`, `experience_goals` |
| Experience API | `app/api/runtime/experience/` | Fetch/update experience, dashboard data, seed routes |
| Journey cards API | `app/api/runtime/journey/cards/route.ts` | Journey progression cards |
| Experience dashboard UI | `app/triad/components/codex/tabs/ExperienceDashboardTab.tsx` | Stage distribution, depth progression, NBE opportunities |
| Experience block manifest | `services/composer/experienceBlockManifest.ts` | Experience block definitions for composition |
| ComposerStudio | `components/composer/ComposerStudio.tsx` | Main composition UI |
| Composer service | `services/composer/` | Orchestration, state, local DB, persistence, registry mapping |
| Composer API routes | `app/api/composer/` | CRUD experiences, sessions, templates, article drafts |
| Studio shell | `app/(shell)/studio/` | Studio routing entry point |
| SmartTriad runtime | `app/components/content/SmartTriadProvider.tsx` | State, library refresh, ownership, wallet |
| SmartTriad surfaces | `app/components/content/SmartTriadSurfaces.tsx` | Surface layer: content viewer, purchase flow |
| SmartWalletDrawer | `app/components/content/SmartWalletDrawer.tsx` | Q¢/DVN and EVM purchase flows |
| CodexPanelDynamic | `app/triad/components/CodexPanelDynamic.tsx` | Renders any codex into the shell |
| Content entitlements | `app/api/content/pricing/[contentId]/entitlement/` | Grant and query entitlements |
| Codex viewer shell | `app/(shell)/codex/viewer/page.tsx` | Main codex viewer with persona resolution |
| metaMe guardian charter | `.claude/agents/metame-guardian.md` | Sovereign authority, policy veto |
| Composer specs | `docs/specs/composer-copilot/` | Composition, sessions, prompt stack, phase plans |
| Liquid template renderer | `components/composer/ExperienceLiquidRenderer.tsx` | Liquid template rendering for experiences |
| Artifact trace UI | `app/triad/components/codex/tabs/ArtifactTraceabilityTab.tsx` | Studio artifact trace surface |

**Boundary:** User-sovereign. Holds the user's personal goals, progression state, and experience strategy. metaMe Guardian has absolute authority here.

---

## Cartridge 4: KNYT

**Role:** First live world, signal economy, PCS proving ground, contained tokenized pilot economy  
**Lead Aigent:** Kn0w1

| Asset | Path | Description |
|-------|------|-------------|
| $KNYT token types | `app/types/knyt.ts` | `KnytBalance`, `KnytPricing`, `KnytPurchase`, `KnytLiquidUITemplate` |
| KNYT balance API | `app/api/codex/knyt-balance/route.ts` | Fetch user $KNYT balance |
| KNYT purchase API | `app/api/codex/knyt-purchase/route.ts` | Submit purchase |
| Living Canon vote | `app/api/codex/knyt/living-canon/vote/route.ts` | Cast ballot, emit reward |
| Living Canon rewards | `app/api/codex/knyt/living-canon/rewards/route.ts` | Emit LivingCanonVoteCast entitlements |
| Living Canon remix | `app/api/codex/knyt/living-canon/remix/route.ts` | Bounded remix, depth ≤ 3, source attribution |
| Like signal | `app/api/codex/knyt/living-canon/like/route.ts` | Like signal + optional micro-reward *(needs light build)* |
| Spark signal | `app/api/codex/knyt/living-canon/spark/route.ts` | Spark signal + optional micro-reward *(needs light build)* |
| KNYT ledger migration | `supabase/migrations/20251205_knyt_ledger.sql` | Core $KNYT ledger |
| Elections + ballots | `supabase/migrations/20260329020000_knyt_elections_ballots_v1.sql` | Elections, ballots, unique constraints |
| Reactions + milestones | `supabase/migrations/20260329050000_knyt_p1_reactions_milestones.sql` | Reactions and milestone tracking |
| Remix lineage | `supabase/migrations/20260329060000_knyt_remix_lineage.sql` | Remix lineage table |
| KNYT stage templates | `app/triad/components/codex/liquidTemplates/KnytStageTemplates.tsx` | KNYT-specific liquid UI templates |
| PennyDrops tab | `app/triad/components/codex/tabs/PennyDropsTab.tsx` | KNYT content with ownership/premium badges |
| QriptoLiquid tab | `app/triad/components/codex/tabs/QriptoLiquidCodexTab.tsx` | KNYT article content codex tab |
| Kn0w1 charter | `.claude/agents/kn0w1.md` | Role, authority, in-world guidance |

**Boundary:** Live world. External-facing but governed by Kn0w1 and scoped to KNYT lore and economy. $KNYT does not cross cartridge boundaries.

---

## Cross-cutting: Marketa

| Asset | Path | Description |
|-------|------|-------------|
| Marketa tab component | `app/triad/components/codex/tabs/MarketaTab.tsx` | Marketa codex tab |
| Marketa pack | `codexes/packs/marketa/` | Cartridge pack structure with domain types and RBAC |
| Marketa charter | `.claude/agents/marketa.md` | Role, authority, activation narrative |

---

## Cross-cutting: Platform foundations

| Asset | Path | Description |
|-------|------|-------------|
| Shared UI primitives | `components/ui/` | Canonical shared components |
| iQube card primitives | `components/registry/` | Registry UI components |
| Next.js API routes | `app/api/` | All server-side API routes |
| Supabase service layer | `services/` | All backend service implementations |
| SmartTriad package | `packages/smarttriad/` | Social sharing, SmartTriad utilities |
| SmartWallet package | `packages/smartwallet/` | Wallet management |
| Avatar host package | `packages/avatar-host/` | Avatar services |
| QubeTalk bridge | `docs/qubetalk-bridge/` | Claude↔Codex file-based messaging bridge |
| CLAUDE.md | `CLAUDE.md` | Master development rules and patterns |

---

## Alpha program documentation (this session's deliverables)

| Asset | Path | Description |
|-------|------|-------------|
| Architecture memo | `docs/alpha/architecture-memo.md` | Topology, flywheel, Aigent map, economic model |
| Asset placement map | `docs/alpha/asset-placement-map.md` | This document |
| Build plan | `docs/alpha/build-plan.md` | Gate-by-gate status, workstream assignments, sequencing |
| AgentiQ OS docs | `docs/agentiq-os/` | Public contributor-facing documentation package |
