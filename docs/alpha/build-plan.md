# AgentiQ Alpha — Build Plan

**Status:** canonical  
**Authority:** product owner  
**Last updated:** 2026-04-06  
**Version:** alpha-1.0

This is the implementation plan for the AgentiQ Alpha Closed-Loop Launch Program. It maps the Master Operator Brief and PRD against the existing codebase, identifies exactly what is built/aligned/stitched/needs light build, and sequences the work across acceptance gates.

**Core constraint:** Use what already exists. Inventory before building. Align before inventing. Stitch before re-architecting.

---

## Program-level assessment

### Already built

The codebase is substantially complete. These assets are production-grade and usable now:

| Asset | Location | Status |
|-------|----------|--------|
| Registry Ingestion Factory | `types/registryIngestion.ts` + `services/registry/*` | Full pipeline: intake → classify → validate → trust score → publish → receipt |
| Cartridge/Codex structural model | `types/codex.ts` + `app/api/codex/registry/*` + `codexes/packs/` | Dynamic codex with tabs, permissions, liquid UI, RBAC |
| Experience Model | migration `20260402000000` + `app/api/runtime/experience/*` | Full schema + API: strategies, models, matrices, journey_states, nbe_plans, goals |
| $KNYT Contained Economy | `app/types/knyt.ts` + `app/api/codex/knyt/*` | Balance, pricing, voting+reward, remix lineage, elections, treasury, milestones |
| Studio Composition | `components/composer/` + `services/composer/*` | Full workflow: registry mapping, session persistence, liquid templates |
| SmartTriad Runtime | `app/components/content/SmartTriad*.tsx` | Ownership, wallet, DVN Q¢, content viewer, persona-scoped library |
| AgentiQ SDK | `packages/agentiq-sdk/` | `AgentIQClient`, `A2AClient`, typed messages, default personas |
| Aigent Z + metaMe Guardian | `.claude/agents/aigent-z-orchestrator.md` + `metame-guardian.md` | Full charters, authority, routing, escalation |
| Golden path traceability | `types/studioArtifact.ts` + `services/registry/invocationGateway.ts` | Traceable: intake → validation → trust → publication → invocation → receipt |
| KNYT signal (voting + remix) | `app/api/codex/knyt/living-canon/vote/` + `remix/` | Voting with reward emission, bounded remix with lineage |
| ExperienceDashboardTab | `app/triad/components/codex/tabs/ExperienceDashboardTab.tsx` | Stage distribution and depth progression UI |
| ArtifactTraceabilityTab | `app/triad/components/codex/tabs/ArtifactTraceabilityTab.tsx` | Studio artifact trace surface |

### Needs alignment

These exist but need repositioning, updating, or boundary-clarification:

| Item | Current state | Required alignment |
|------|--------------|-------------------|
| Aigent C | Defined in `docs/agent-harness/aigent-z-aigent-c-contract.md` | Needs dedicated charter scoped to AgentiQ OS builder onboarding *(done this session)* |
| Kn0w1 | Named in briefs, no charter | Needs `.claude/agents/kn0w1.md` *(done this session)* |
| Marketa | Pack structure exists, no agent charter | Needs `.claude/agents/marketa.md` *(done this session)* |
| metaMe experience model | Tables exist, PCS stage names are generic | Seed `experience_matrices.depth_ladder` with PCS stage labels |
| Q¢ vs $KNYT framing | Both work technically; no surface distinguishes them | Add economic split framing component and narrative |
| AgentiQ OS positioning | SDK + Factory exist as internal services | Frame and document as public contributor-facing layer |
| Factory visibility | Full backend pipeline, no admin/contributor UI | Add Factory intake trace tab (Gate 3) |

### Needs stitching

These exist separately and need connecting:

| Item | Exists separately | Connection needed |
|------|------------------|------------------|
| Factory → Registry → Studio | Each service works independently | Visible trace from intake through to composition in one surface |
| Registry → Codex tab | Accepted supply not browsable in codex | Registry supply browser tab in AgentiQ codex |
| metaMe NBE → KNYT handoff | NBE plans exist; KNYT participation exists | Route from NBE "participate in KNYT" disposition into KNYT codex tab |
| Studio artifact → Runtime delivery | Artifact model and Runtime both exist | Surface artifact state (draft/canonical) in Runtime/experience dashboard |
| PCS depth ladder → user-visible UI | Depth ladder in `experience_matrices`; ExperienceDashboard for operators | User-facing progression ladder showing current stage and next step |
| $KNYT reward → SmartWalletDrawer | Vote reward emits; wallet shows only Q¢ | Add $KNYT balance section to SmartWalletDrawer |
| Share link → KNYT loop | Article share page renders preview | Connect back to KNYT participation/PCS signal |

### Needs light build

Genuine gaps requiring new but small builds:

| Item | Effort | Gate |
|------|--------|------|
| Aigent C, Kn0w1, Marketa charters | 3 text files *(done this session)* | Gate 1 |
| Architecture memo | 1 doc *(done this session)* | Gate 1 |
| Asset placement map | 1 doc *(done this session)* | Gate 1 |
| `docs/agentiq-os/` documentation package | 5 markdown files | Gate 2 |
| Factory intake trace tab (`FactoryIntakeTab.tsx`) | ~150 lines + 1 API route | Gate 3 |
| Registry supply browser tab (`RegistrySupplyTab.tsx`) | ~120 lines + 1 API route | Gate 4 |
| PCS progression ladder UI | ~80 lines in ExperienceDashboardTab | Gate 5 |
| PCS stage seed data | SQL seed migration | Gate 5 |
| Like signal route | ~60 lines | Gate 6 |
| Spark signal route | ~60 lines | Gate 6 |
| $KNYT balance in SmartWalletDrawer | ~40 lines | Gate 6 |
| Economic split framing component | ~40 lines | Gate 7 |
| Golden-path demo doc | 1 doc | Gate 8 |
| Launch package copy | 4 docs *(done this session)* | Gate 8 |

---

## Gate-by-gate status

| Gate | Name | Current status | Blocking gap | Fix |
|------|------|---------------|-------------|-----|
| **1** | Structural coherence | ✅ Done | All Aigent charters + asset map + build plan complete | A1+A2+A3 |
| **2** | Builder coherence | ✅ Done | AgentiQ OS docs + SDK personas + codex tab complete | B1+B2+B3 |
| **3** | Governance coherence | ⚠️ Partial | Codex delivered WS4 (intake/assets routes + receipt emission) on local branch — **awaiting push to dev** | C1 |
| **4** | Production coherence | ⚠️ Partial | Codex delivered WS4 (studio artifact state surface) on local branch — **awaiting push to dev** | C2+C3 |
| **5** | Sovereignty coherence | ✅ Done | PCS ladder seeded + visible in ExperienceDashboardTab individual view | D1+D2 |
| **6** | KNYT coherence | ✅ Done | Like/spark/curate/remix routes live; $KNYT wallet section distinct; NBE→KNYT CTA wired; KnytRuntimeSurface wired to journey_states | D3+D4+D5 |
| **7** | Economic coherence | ✅ Done | EconomicSplitBanner in KNYT + AgentiQ codex headers | E1 |
| **8** | Flywheel coherence | ✅ Done | Golden-path demo + full launch package (WS9) complete | C3+E2 |

---

## Workstream plan

### WS1 — Alpha architecture and boundary freeze

**Owner:** Claude  
**Gate:** 1

Deliverables:
- [x] Architecture memo (`docs/alpha/architecture-memo.md`) *(done)*
- [x] Asset placement map (`docs/alpha/asset-placement-map.md`) *(done)*
- [x] Aigent C charter (`.claude/agents/aigent-c.md`) *(done)*
- [x] Kn0w1 charter (`.claude/agents/kn0w1.md`) *(done)*
- [x] Marketa charter (`.claude/agents/marketa.md`) *(done)*
- [x] Build plan (`docs/alpha/build-plan.md`) *(this document)*

Acceptance test: an external stakeholder can read the architecture memo and understand the four-cartridge topology, the Aigent roles, and the economic split without needing to ask.

---

### WS2 — Cartridge/codex topology alignment

**Owner:** Claude + Codex  
**Gate:** 1

Deliverables:
- [x] Asset placement map confirms no code moves needed (existing file placement matches cartridge model)
- [ ] `codexes/packs/agentiq/` extended with Alpha Program collection and content *(this session)*
- [ ] Alpha Program tab added to `data/codex-configs.ts` AGENTIQ_CARTRIDGE *(this session)*

Acceptance test: all four cartridges are represented as real homes with documented assets.

---

### WS3 — AgentiQ OS alpha packaging

**Owner:** Claude  
**Gate:** 2  
**Status:** ✅ Complete

Deliverables:
- [x] `docs/agentiq-os/README.md` — what AgentiQ OS is, the closed-loop model, where it fits
- [x] `docs/agentiq-os/quickstart.md` — 5-step get started guide
- [x] `docs/agentiq-os/contribution-categories.md` — ToolQube, SkillQube, WorkflowQube, ConnectorQube
- [x] `docs/agentiq-os/packaging-standards.md` — manifest schema, policy classes, validation stages, trust band ceilings
- [x] `docs/agentiq-os/submission-guide.md` — full submission flow with error handling and tracking
- [x] SDK audit: `packages/agentiq-sdk/src/index.ts` exports are clean — no internal leakage
- [x] Aigent C persona registered in `packages/agentiq-sdk/src/utils.ts` `defaultPersonas`
- [x] Kn0w1 persona registered in `packages/agentiq-sdk/src/utils.ts` `defaultPersonas`
- [x] `col_agentiq_os` collection added to `codexes/packs/agentiq/collections.json`
- [x] AgentiQ OS tab (order 7, Code icon, green) added to AGENTIQ_CARTRIDGE in `data/codex-configs.ts`
- [x] Codex-facing summary items created in `codexes/packs/agentiq/items/OS_*.md`

Acceptance test: a developer with no prior knowledge can read `docs/agentiq-os/` and know exactly what to build, how to package it, and how to submit it. ✓

---

### WS4 — Factory/Registry/Studio/Runtime stitching

**Owner:** Codex (primary) + Claude (support)  
**Gates:** 3 + 4  
**Status:** ⚠️ Delivered by Codex on local branch — **awaiting push to dev/origin**

Deliverables:
- [x] `GET /api/registry/intake` route — list intakes with graceful 42P01 empty-state fallback *(Codex, commit 8f2a0bc)*
- [x] `app/triad/components/codex/tabs/FactoryIntakeTab.tsx` — shows intake status, validation stage, trust band *(pre-built)*
- [x] `GET /api/registry/assets` route — list published assets with graceful 42P01 empty-state fallback *(Codex, commit 8f2a0bc)*
- [x] `app/triad/components/codex/tabs/RegistrySupplyTab.tsx` — browse accepted supply, click to open in Studio *(pre-built)*
- [x] Studio `StudioArtifact` receipt emission on composition save via `POST /api/registry/receipts` *(Codex, commit 5899dbd)*
- [x] Artifact state (draft/working/canonical) badge in ExperienceDashboardTab via `GET /api/registry/studio-artifacts` *(Codex, commit b64fa35)*
- [x] Factory tab + Registry supply tab wired in `data/codex-configs.ts` *(pre-built)*

**Blocker:** Codex pushed to local branch `work` — commits 8f2a0bc, 5899dbd, b64fa35 not yet in `origin/dev`. Gates 3+4 open until Codex pushes.

Acceptance test:
- A stakeholder can click into the Factory tab and see a submission moving through validation stages
- A stakeholder can click Registry supply and see accepted assets
- Clicking an asset opens it in Studio

---

### WS5 — metaMe sovereignty alignment

**Owner:** Claude  
**Gate:** 5  
**Framework spec:** `codexes/packs/metame/items/METAME_EXPERIENCE_FRAMEWORK.md`

The metaMe Experience Framework v1 is now fully specced. The canonical architecture is:

```
Experience Strategy   → macro intent, who, when, success, macro_intent
Experience Model      → structural, emotional, transactional tiers
Governance Overlay    → role_permissions, access_rules, trust_requirements
Experience Matrix     → state transitions: entry_state → target_state + moment + levers + signals + NBE
Experience Ladder     → Recipient → Selector → Modifier → Producer → Builder → Steward
Semantic Rendering    → lens × sector × cartridge × persona adapts language, not architecture
```

PCS rendered form for AgentiQ alpha:
```
Participant → Community → Correspondent → Operator → Creator → Upstream contributor
```

KNYT rendered form: `Observer → Collector → Curator → Remixer → Creator → Correspondent → Steward → Franchise-aligned`

Deliverables:

**Phase D — stack implementation:**
- [x] SQL seed migration: populate `experience_matrices.depth_ladder` with PCS stage labels for the AgentiQ strategy (`supabase/migrations/20260407000000_pcs_seed_agentiq.sql`) *(done)*
  - Level 0: Participant (unlock: first_participation_signal)
  - Level 1: Community (unlock: repeat_participation + 3 signals)
  - Level 2: Correspondent (unlock: curation_or_remix + community_action)
  - Level 3: Operator (unlock: contribution_submission_accepted)
  - Level 4: Creator (unlock: repeated_accepted_contributions)
  - Level 5: Upstream contributor (unlock: contributor_pathway_flag + Aigent C handoff)
- [x] `PCSLadderSection` added to `ExperienceDashboardTab.tsx` — shows current PCS stage, depth ladder, next unlock criteria *(done)*
- [x] NBE→KNYT routing CTA in individual view: `disposition=act` shows "Go to KNYT →" or "Continue →" based on rationale content *(done)*

**Already complete (this session):**
- [x] metaMe Experience Framework v1 spec (`codexes/packs/metame/items/METAME_EXPERIENCE_FRAMEWORK.md`)
- [x] Canonical schemas v1 (`codexes/packs/metame/items/METAME_EXPERIENCE_SCHEMAS.md`)
- [x] Experience Ladder detail (`codexes/packs/metame/items/METAME_EXPERIENCE_LADDER.md`)
- [x] METAME_CODEX added to `data/codex-configs.ts` (Experience Framework tab + Journey Dashboard tab)
- [x] metaMe codex pack created (`codexes/packs/metame/`)

Acceptance test: a logged-in user can see their current PCS stage, the next step, and what unlocks it.

---

### WS6 — KNYT live world activation

**Owner:** Claude  
**Gate:** 6  
**Experience spec:** `codexes/packs/knyt/items/KNYT_EXPERIENCE_PACK_PRD.md`  
**Matrix spec:** `codexes/packs/knyt/items/KNYT_MATRIX_SHEET.md`  
**Runtime spec:** `codexes/packs/knyt/items/KNYT_RUNTIME_SURFACE_SPEC.md`  
**Wireframe:** `codexes/packs/knyt/items/KNYT_RUNTIME_SURFACE_MAP.md`

KNYT uses a dual-axis model: **Patronage Axis** (Outside Order → Acolyte → Keta → Keji → First → Zero → Satoshi) × **PCS Axis** (Observer → Collector → Curator → Remixer → Creator → Correspondent → Steward → Franchise-aligned).

5 alpha-active matrices are fully specced. Runtime surface map defines ownership split between Codex (feature UI) and Lovable (shell/thin-client only).

**Already complete (this session):**
- [x] KNYT Experience Pack PRD (`codexes/packs/knyt/items/KNYT_EXPERIENCE_PACK_PRD.md`)
- [x] KNYT Matrix Sheet v1 — 5 matrices (`codexes/packs/knyt/items/KNYT_MATRIX_SHEET.md`)
- [x] KNYT Runtime Surface Spec v1 (`codexes/packs/knyt/items/KNYT_RUNTIME_SURFACE_SPEC.md`)
- [x] KNYT Runtime Surface Map v1 — wireframe for Codex + Lovable (`codexes/packs/knyt/items/KNYT_RUNTIME_SURFACE_MAP.md`)
- [x] Experience Pack tab added to KNYT_CODEX (adminOnly, order 9)

**Phase D — stack implementation:**
- [x] `app/api/codex/knyt/living-canon/like/route.ts` — like signal + 1.0 KNYT micro-reward *(done)*
- [x] `app/api/codex/knyt/living-canon/spark/route.ts` — spark signal + 2.5 KNYT micro-reward *(done)*
- [x] `app/api/codex/knyt/living-canon/curate/route.ts` — curate signal (editorial, no direct reward) *(done)*
- [x] `supabase/migrations/20260407000001_knyt_signals.sql` — knyt_signals table (like/spark/curate) *(done)*
- [x] $KNYT distinct balance section in `SmartWalletDrawer.tsx` — amber section header separates $KNYT from Q¢ *(done)*
- [x] Kn0w1 persona registered in `agentiq-sdk` default personas (in-world guide role) *(done — Phase B)*
- [ ] KNYT Runtime surface cards: World Header, Dual Status Rail, Featured Moment, Signal Action Tray, Next-Best-Pathway Card (P0 — per surface map)
- [ ] Reward + Progress Card, Kn0w1 + metaMe handoff cards (P1)
- [ ] Aigent C builder path handoff card (P2 — conditional on `contributor_pathway_flag`)
- [ ] User state model wired: `knyt_runtime_state` populated from `journey_states` + KNYT-specific fields

Acceptance test:
- A user can like, spark, and vote in KNYT (all routes respond)
- The Runtime surface shows patronage and PCS status
- SmartWalletDrawer shows $KNYT balance alongside Q¢
- Next-best-step card updates after a signal action

---

### WS7 — Economic framing

**Owner:** Claude  
**Gate:** 7

Deliverables:
- [x] `EconomicSplitBanner` component — two-column: Q¢ (platform base rail) vs $KNYT (KNYT cartridge economy), one-line descriptions each *(done)*
- [x] Render `EconomicSplitBanner` in KNYT codex header and AgentiQ codex header *(done)*

Acceptance test: any user who opens the KNYT or AgentiQ codex immediately sees which economy they are in and what it means.

---

### WS8 — Golden-path demo

**Owner:** Claude + product owner  
**Gate:** 8

Deliverables:
- [x] `docs/alpha/golden-path-demo.md` — narrated step-by-step walkthrough of the complete loop *(done)*
- [x] Live surface map linking every step to a real URL/tab *(done)*
- [x] Gate 8 acceptance checklist *(done)*

Acceptance test: a stakeholder can be walked through the full loop (contribution → Factory → Registry → Studio → Runtime → KNYT → PCS → reward → signal) in one continuous narrative.

---

### WS9 — Launch packaging

**Owner:** ChatGPT (primary) + Claude (support)  
**Gate:** 8  
**Status:** ✅ Complete

Deliverables:
- [x] `docs/alpha/launch/one-pager.md` *(ChatGPT, commit d2c33248)*
- [x] `docs/alpha/launch/faq.md` *(ChatGPT, commit ac36638d)*
- [x] `docs/alpha/launch/developer-value-prop.md` *(ChatGPT, commit 16215247)*
- [x] `docs/alpha/launch/ecosystem-stack-chart.md` *(ChatGPT, commit b20fa193)*

Acceptance test: a developer, contributor, or ecosystem partner can read the launch package and understand what AgentiQ is, how the closed loop works, what alpha includes, and how to enter the current intake window.

---

### WS10 — Internal Aigent operating model

**Owner:** Claude  
**Gate:** 1

Deliverables:
- [x] Aigent Z charter (`.claude/agents/aigent-z-orchestrator.md`) — pre-existing
- [x] metaMe guardian charter (`.claude/agents/metame-guardian.md`) — pre-existing
- [x] Aigent C charter (`.claude/agents/aigent-c.md`) — *(done this session)*
- [x] Kn0w1 charter (`.claude/agents/kn0w1.md`) — *(done this session)*
- [x] Marketa charter (`.claude/agents/marketa.md`) — *(done this session)*
- [ ] Update process: all charter changes require product owner approval before merge
- [ ] Role handoff chain documented in architecture memo *(done)*

Acceptance test: every Aigent has a charter. Every charter defines authority, home cartridge, escalation chain, and update ownership.

---

## Recommended sequencing

```
Week 1 — Phase A: Freeze truth (WS1, WS10)
  A1. Aigent charters: aigent-c, kn0w1, marketa       [done]
  A2. Architecture memo                                [done]
  A3. Asset placement map                              [done]
  A4. Build plan                                       [done]
  A5. AgentiQ codex Alpha Program tab                  [this session]

Week 2 — Phase B: Package the upstream layer (WS3)
  B1. docs/agentiq-os/ package (5 markdown files)
  B2. SDK export audit
  B3. Aigent C persona in SDK
  B4. AgentiQ OS docs added to codex pack

Week 3 — Phase C: Stitch the system loop (WS4)
  C1. Factory intake trace route + tab
  C2. Registry supply route + tab
  C3. Studio artifact receipt emission + state in dashboard
  (Run in parallel with Codex on integration work)

Week 4 — Phase D: Activate sovereignty and world (WS5, WS6)
  D1. PCS seed migration
  D2. PCS ladder UI in ExperienceDashboardTab
  D3. Like + Spark signal routes
  D4. NBE → KNYT routing in SmartTriadProvider
  D5. $KNYT balance in SmartWalletDrawer

Week 5 — Phase E: Demo and launch (WS7, WS8, WS9)
  E1. EconomicSplitBanner component
  E2. Golden-path demo doc
  E3. Launch package copy (with ChatGPT)       [done]
```

---

## What is out of scope

- Full trust score system
- Full risk/value research layer
- Enterprise governance suite
- Generalized marketplace maturity
- Finalized ecosystem-wide fair-launch tokenomics
- Full-scale public developer program beyond alpha entry path

---

## Delivery team prompts (from program brief)

**Claude:** Focus on OS package coherence, SDK/CLI/template unification, metaMe experience-model alignment, KNYT signal service packaging.

**Codex:** Focus on cartridge/codex asset mapping, Factory traceability, Registry exposure, Studio integration, Runtime integration, golden-path stitching.

**Lovable:** Thin-client/shell support only — metaMe Runtime shell support, Qriptopian shell support, demo-friendly shell coherence.

**ChatGPT:** Architecture memo, workbacks, specs, prompts, messaging, launch framing, review/QA criteria.

**Product owner:** Scope discipline, approvals, sequencing, prioritization, final truth.

---

## Related documents

- `docs/alpha/architecture-memo.md` — topology, flywheel, Aigent map, economic model
- `docs/alpha/asset-placement-map.md` — file-to-cartridge mapping
- `docs/agent-harness/metaproof-core.md` — role hierarchy and NBE contract
- `docs/agent-harness/aigent-z-aigent-c-contract.md` — routing and handoff rules
- `docs/agent-harness/journey-state-schema.md` — JourneyState and ExperienceModel interfaces
- `docs/agent-harness/studio-artifact-schema.md` — StudioArtifact and Codex↔Studio sync
