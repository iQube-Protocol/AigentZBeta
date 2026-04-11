# Platform Workplan & Context Handoff — Marketa Agent

_Last updated: 2026-04-11. Written for Claude Code agents picking up Marketa work._
_This document covers the current state of the platform, what has been built, what is available for Marketa to use, and what comes next._

---

## 1. What This Platform Is

**AigentZ / iQube Protocol** is a dual-agent AI platform with a sovereign identity layer. The system runs:

| Role | Agent | Notes |
|------|-------|-------|
| System orchestrator | Aigent Z | Routes interactions, enforces policy, selects NBE |
| Customer guide | Aigent C | Faces the user; executes NBE dispositions |
| Sovereign guardian | metaMe | Identity + data sovereignty, final override |
| Marketing operator | **Aigent Marketa** | CMO-for-hire, campaign operator, content orchestrator |

Marketa's mandate: turn strong products and ecosystems into strong market understanding and adoption. She is not a sales bot — she is a trusted strategic operator. Full identity spec: `docs/marketa/MARKETA_CHARTER.md`.

---

## 2. Current Platform State (as at April 2026)

### 2.1 What is live on dev (`dev-beta.aigentz.me`)

- **ComposerStudio** — full content authoring environment with experience, parity, workflows, pipeline, and surfaces tabs
- **iQube Registry** — catalog of templates/instances + Ingestion Factory (see §3)
- **AgentiQ Codex** — knowledge base + pipeline management at `/codex/viewer?id=agentiq-codex`
- **Runtime embeds** — thin-client cartridge runtime at `/triad/embed/codex/[codexSlug]`
- **Admin codex embed** — Autonomys upload panel at `/triad/embed/admin/codex`
- **QriptoCent** — platform currency for service pricing and settlement
- **SmartWallet** — wallet layer for Q¢ and cross-chain value
- **KNYT Codex** — metaKnyts universe codex at `/codex/viewer?id=knyt-codex`
- **Marketa Codex** — Marketa's own codex at `/codex/viewer?id=marketa-codex`

### 2.2 Journey system (live schema, pending production migration)

Journey stages: `prospect → acolyte → keta → keji → first → zero`
(+ `investor`, `collector`, `creator` variants)

Experience depth ladder (one step at a time):
`L0 pill → L1 capsule → L2 mini_runtime → L3 codex`

NBE disposition values: `ask | act | wait | escalate | deny`

Types: `types/orchestration.ts`, `types/studioArtifact.ts`

Supabase migration (run before orchestration API is live):
`supabase/migrations/20260402000000_experience_model_journey_state.sql`

Tables created: `experience_strategies`, `experience_models`, `experience_matrices`,
`experience_goals`, `journey_states`, `nbe_plans`, `analysis_cards`,
`orchestration_events`, `studio_artifacts`

---

## 3. The Ingestion Factory — Key Tool for Marketa

The **Ingestion Factory** is the governed intake pipeline for ToolQubes, SkillQubes, WorkflowQubes, and ConnectorQubes. Assets ingested here become composable Registry supply available in Studio.

### Access points
- **Registry tab**: `/registry?tab=factory` — deep-links directly to the factory panel
- **Studio Workflows tab**: "Open Factory →" button in the planning & parity modal
- **AgentiQ Codex**: Factory Intake tab at `/codex/viewer?id=agentiq-codex&tab=factory-intake`

### Pipeline stages
```
intake → fetching → packaging → validating → scored → asset.published
```

### Source types supported
- GitHub Repo (public URL)
- Package Reference (npm / pip)
- MCP Endpoint
- Manual Bundle
- Workflow Definition

### What Marketa can do with this
1. **Submit a campaign skill** (e.g. a KNYT email generation workflow) as a WorkflowQube
2. **Submit Marketa's own tools** as SkillQubes — make her capabilities formally part of the registry supply
3. **Browse ingested assets** in the "Ingested Assets" sub-tab, filtered by asset class and trust band
4. **Delete non-published intakes** (trash icon on list rows or in detail panel)
5. **View published assets** in Registry Supply tab of the AgentiQ codex (scoped to active cartridge)

### Key services (backend)
```
services/registry/
  persistence.ts          — listIntakes, listAssets, getIntake, createIntake, updateIntake, deleteIntake
  classifierService.ts    — asset class detection
  fetcherService.ts       — fetches source content
  packagerService.ts      — packages into canonical format
  validatorService.ts     — validates against schema
  trustScorerService.ts   — assigns trust band (L1–L5)
  publisherService.ts     — promotes to registry_assets
  receiptEmitter.ts       — emits DVN receipts on publish
```

### Key API routes
```
POST   /api/registry/intake          — create new intake
GET    /api/registry/intake          — list intakes (tenant-scoped)
GET    /api/registry/intake/[id]     — get single intake
PATCH  /api/registry/intake/[id]     — update intake
DELETE /api/registry/intake/[id]     — soft-delete (sets failure_reason = "_user_removed")
GET    /api/registry/assets          — list published assets
```

### RLS policies (applied to Supabase 2026-04-11)
- Service role: full bypass on all 15 registry tables
- Authenticated: tenant-scoped read + write on own rows (`registry_intakes_tenant_write`)
- Anon: read published assets only (`publication_status = 'published'`)
- Migration: `supabase/migrations/20260402020000_registry_rls.sql`

---

## 4. ComposerStudio — What Marketa Uses Here

File: `components/composer/ComposerStudio.tsx`

The studio is the primary content authoring surface. Key tabs relevant to Marketa:

### Experience tab
- Sets the active experience (depth level, template, target stage)
- `previewExperience` state drives which workflows are shown as active

### Workflows tab
- Lists WorkflowDefinitions bound to the active cartridge
- "Open Factory →" button → `/registry?tab=factory`
- Create new workflow definitions (name, description, asset class)
- Invoke workflows directly with input fields
- Poll run status and view run history
- API routes: `/api/workflows`, `/api/workflows/[id]/invoke`, `/api/workflows/[id]/runs`

### Pipeline tab
- Shows StudioArtifacts emitted from composer sessions
- Artifacts are canonical handoff format: Studio → Codex → Runtime closed loop
- Type: `types/studioArtifact.ts`

### Parity / Planning modal
- Design parity checker (4px grid, design tokens, radii)
- Links to iQube Registry and factory from within Studio

---

## 5. Experience Qubes Architecture

### Core contracts (all in `types/orchestration.ts`)

```typescript
// NBEPlan — the decision output of Aigent Z routing
interface NBEPlan {
  disposition: "ask" | "act" | "wait" | "escalate" | "deny";
  nextExperience: ExperienceDepthStep;  // L0–L3
  rationale: string;
}

// HandoffPayload — typed interface for agent-to-agent handoffs
interface HandoffPayload {
  fromAgent: string;
  toAgent: string;
  context: Record<string, unknown>;
  nbe: NBEPlan;
}

// OrchestrationEvent — every routing decision is persisted
interface OrchestrationEvent {
  eventType: string;
  agentId: string;
  sessionId: string;
  payload: HandoffPayload;
  receiptEligible: boolean;
}
```

### StudioArtifact (`types/studioArtifact.ts`)
Canonical handoff format between Studio, Codex, and Runtime:
- Created when a composer session is saved
- Emitted as a receipt to `studio_artifacts` table
- Visible in Pipeline tab of Studio
- API: `GET /api/registry/studio-artifacts`

### Agent harness specs (read these before working on orchestration)
```
docs/agent-harness/metaproof-core.md          — role hierarchy, NBE contract, DVN receipts
docs/agent-harness/aigent-z-aigent-c-contract.md — routing sequence, handoff rules
docs/agent-harness/journey-state-schema.md    — JourneyState, ExperienceModel interfaces + SQL
docs/agent-harness/studio-artifact-schema.md  — StudioArtifact schema + rollback protocol
```

---

## 6. Codex System

### URL pattern
```
/codex/viewer?id=<codex-id>&tab=<tab-slug>
/codex?id=<codex-id>&tab=<tab-slug>   ← redirects to /codex/viewer (added 2026-04-11)
```

### Key codexes
| Codex ID | URL | Purpose |
|----------|-----|---------|
| `agentiq-codex` | `/codex/viewer?id=agentiq-codex` | Platform ops, factory, registry supply |
| `knyt-codex` | `/codex/viewer?id=knyt-codex` | KNYT universe, characters, lore |
| `marketa-codex` | `/codex/viewer?id=marketa-codex` | Marketa's knowledge base |
| `qripto-codex` | `/codex/viewer?id=qripto-codex` | Qriptopian universe |

### AgentiQ codex tab slugs (relevant to Marketa)
- `factory-intake` — ingestion factory pipeline view
- `registry-supply` — published assets, filterable by cartridge
- `experience-dashboard` — NBE and journey state overview
- `pack-browser` — all alpha docs, architecture, launch materials

### Pack browser content (AgentiQ)
Alpha docs available in the codex pack browser (`codexes/packs/agentiq/`):
- `GATE8_WALKTHROUGH_PACK.md` — full alpha walkthrough guide
- `GOLDEN_PATH_DEMO.md` — demo script
- `LAUNCH_ONE_PAGER.md`, `LAUNCH_FAQ.md`, `LAUNCH_DEV_VALUE_PROP.md`, `LAUNCH_ECOSYSTEM_STACK.md`
- `ALPHA_BUILD_PLAN.md` — current build plan with gate status
- `ALPHA_ARCHITECTURE_MEMO.md` — system architecture overview
- `POLICY_PERIMETER_POSITION_PAPER.md`, `POLICY_PERIMETER_ARCHITECTURE_OUTLINE.md`

---

## 7. Marketa's Active Workplan

### Phase 0 — Foundation ✅ Complete
- Marketa registered as full Aigent in `personas.ts`, `agentConfig.ts`, DB
- Agent selector pipeline working — Marketa activates correctly in runtime and thin client
- Trust/reliability indicators pulse during Marketa inference sessions

### Phase 1 — metaKnyt Campaign Activation 🟡 Ready to start
Full spec: `docs/marketa/MARKETA_PHASED_PLAN_CED.md`

**1.1** System prompt tuning — finalize from `MARKETA_CHARTER.md`, add KNYT universe context and investor-tier framing

**1.2** Campaign content bundle via Composer:
- Article: "What is metaKnyts and why does it matter for investors?"
- Character spotlights (Kn0w1, Nakamoto, key KNYT cast)
- Email / social copy for 3,500-cohort outreach
- Publish as campaign iQube in Registry (use Ingestion Factory → Manual Bundle source type)
- QriptoCent pricing: set service rates for consultation sessions

**1.3** Runtime activation for KNYT campaign:
- Marketa as default agent on KNYT-facing runtime embed
- Quick-link prompts wired: "Who is Kn0w1?", "What is my iQube?", "How do I invest more?"

**1.4** QubeTalk handoffs:
- Marketa → Kn0w1 (deep lore questions)
- Marketa → MoneyPenny (wallet/payment questions)

### Phase 2 — CED Framework 🔵 After campaign launch
- Nine-foci experience model for KNYT campaign
- `/api/marketa/nbe` route — session context → ranked next-best experience
- `ced_journey_matrix` Supabase table
- Client blakQube creation per engagement

### Phase 3 — Composer Skill Orchestration 🔵 Parallel to Phase 2
- Marketa brief → Composer session handoff via `composerSessionContext`
- Multi-skill bundle: article + image triggered in one session, linked as Registry capsule
- Auto QriptoCent service receipt at bundle completion
- Publish capsule to client iQube with access token

### Phase 4 — Third-Party Client Ops 🔵 Future

---

## 8. Key Patterns Marketa Must Follow

### Submitting assets to the Registry
Use the Ingestion Factory at `/registry?tab=factory`:
1. Select source type (Manual Bundle for most Marketa content)
2. Provide URL/reference and name
3. Submit — pipeline runs automatically
4. Monitor in "Pipeline Status" tab
5. Published assets appear in "Ingested Assets" and in Registry Supply tab of the codex

### Creating a Composer session with Marketa context
- Open Studio → select Marketa as active agent or cartridge
- Set experience depth (start at L1 capsule for campaign content)
- Use Workflows tab to trigger image_article_bundle or video_article_bundle
- Pipeline tab shows emitted StudioArtifacts

### Writing to QubeTalk (for coordination with other agents)
Outbound HTTPS is blocked in the Claude Code sandbox. Use the bridge:
```bash
python3 scripts/qubetalk_bridge/create_packet.py \
  --agent-id claude-code \
  --story MARKETA-001 \
  --title "Title" \
  --body "Body" \
  --thread dev-exec \
  --type status \
  --status done \
  --severity info
git add docs/qubetalk-bridge/outbox/
git commit -m "send qubetalk bridge packet: <title>"
git push origin HEAD:dev
```

### Deploying changes
Push to branch `claude/setup-knyt-codex-Mrinp` — auto-merges to `dev` via GitHub Actions.
```bash
git push -u origin claude/setup-knyt-codex-Mrinp
# auto-merge to dev triggers Amplify build
```

---

## 9. Component + File Map

### Marketa-specific files
```
docs/marketa/
  MARKETA_CHARTER.md              — identity, mandate, ethics
  MARKETA_PHASED_PLAN_CED.md      — full phased workplan
  MARKETA_SYSTEM_PROMPT_BLOCKS.md — system prompt fragments
  bridge-contract.md              — Marketa ↔ Studio bridge contract
  partner-asset-framework.md      — partner asset types + pricing
  partner-journey.md              — partner onboarding journey
  21-awakenings-campaign-implementation.md
docs/agentiq-marketa-capabilities.json  — capability manifest
```

### Registry + Factory UI
```
components/registry/
  RegistryHome.tsx            — tab nav (iQube Catalog | Ingestion Factory)
  IngestionFactoryPanel.tsx   — full factory UI (ingest / pipeline / assets)
  RegistrySupplyTab.tsx       — published assets (cartridge-scoped)
  FactoryIntakeTab.tsx        — factory pipeline (in codex triad)
  RegistryBrowserDrawer.tsx   — asset browser drawer
  AssetDetailPanel.tsx        — asset detail + trust band review
  ValidationPanel.tsx         — validation results
  IdentityFilterSection.tsx   — DiDQube identity filters
  IQubeCard.tsx               — asset card component
app/api/registry/             — all registry API routes
services/registry/            — backend services
```

### Studio
```
components/composer/
  ComposerStudio.tsx          — full studio (13k+ lines; tabs: experience, parity, surfaces, receipts, pipeline, workflows)
  AgenticDesignParityPanel.tsx — design parity checker
```

### Codex viewer
```
app/(shell)/codex/
  page.tsx                    — redirect: /codex?id=X&tab=Y → /codex/viewer?id=X&tab=Y
  viewer/page.tsx             — full codex viewer (reads id + tab from URL params)
app/triad/components/codex/tabs/
  FactoryIntakeTab.tsx        — factory pipeline tab (with delete + cartridge scoping)
  RegistrySupplyTab.tsx       — registry supply tab (with cartridge filter)
  PackBrowserTab.tsx          — pack browser (all codex docs)
  ExperienceDashboardTab.tsx  — NBE + journey overview
codexes/packs/agentiq/        — AgentiQ pack content (items/ + collections.json)
codexes/packs/aigency/        — AigentZ platform pack
```

### Types + orchestration
```
types/orchestration.ts        — NBEPlan, HandoffPayload, OrchestrationEvent, JourneyState
types/studioArtifact.ts       — StudioArtifact schema
types/aigentQube.ts           — iQube base types
types/smartWalletQube.ts      — wallet types
```

### Key utility
```
utils/splitMarkdownTables.ts  — zero-dependency GFM table parser (replaces remark-gfm)
```

---

## 10. Recent Build History (this session + prior)

| Commit | Change |
|--------|--------|
| `ae9847ef` | Remove indigo from registry header, catalog tab, add button, identity filter — all amber/emerald |
| `d238b3cf` | Fix factory link target → `/registry?tab=factory`, add deep-link support, replace remaining indigo in factory panel |
| `d480793e` | Fix `/codex` 404 — add redirect page, wire `id`/`tab` URL params into viewer |
| `7c5ed93c` | Wire policy perimeter docs into aigency Architecture + Knowledge collections |
| `7d82582b` | Fix trailing newlines in agentiq launch pack items |
| `0bfbedc4` | Fix studio Factory CTA 404 — correct codex viewer URL |
| `85497e35` | Sync AgentiQ codex pack with current alpha docs (gate8, golden path, launch docs) |
| `3b4c6273` | Fix DELETE 500 on registry intakes — soft-delete via UPDATE; fix IngestionFactoryPanel color to amber |
| `ca3737c7` | Fix registry visibility (published assets in supply tab), tab label → "iQube Catalog", delete capability, cartridge scoping |
| `c6919b06` | Fix Amplify build — move splitMarkdownTables to root `utils/` to match `@/` alias |
| `c4841c9f` | Fix remark-gfm crash — zero-dependency inline table parser across all 3 markdown renderers |
| `2585c295` | Factory/registry UX polish + walkthrough pack + studio factory link |
| `c24c95d6` | Studio artifact state read surface for experience dashboard |
| `c4d3c108` | Emit studio artifact receipts on composer session save |

---

## 11. Known Gaps / Pre-conditions

| Item | Status | Notes |
|------|--------|-------|
| Experience model migration | Needs running in production Supabase | `supabase/migrations/20260402000000_experience_model_journey_state.sql` |
| RLS registry policies | Applied 2026-04-11 | `supabase/migrations/20260402020000_registry_rls.sql` |
| Background pipeline services | Not running | `services/registry/` services exist but no background worker; pipeline stages advance manually or via API |
| `/api/marketa/nbe` | Not yet implemented | Specified in Phase 2 — needs Supabase tables from experience model migration |
| `ced_journey_matrix` table | Not yet implemented | Phase 2 |
| Marketa codex pack content | Minimal | Pack exists at `codexes/packs/marketa/` but needs population with charter, system prompt, CED docs |

---

_This document lives at `docs/marketa/PLATFORM_WORKPLAN_HANDOFF.md`. Update it after each significant build session._
