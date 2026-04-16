# AigentZ Beta - Product Backlog

**Last Updated**: 2026-04-15  
**Status**: Active tracking of deprioritized and deferred work items

---

## 📋 Purpose

This document tracks work items from sprint plans that have been deprioritized or deferred. Items here remain valuable but are not currently scheduled for active development.

---

## 🔒 Post-Alpha Security Infrastructure

These items were identified during the AgentiQ OS / KNYT Laddering Phase 5 security audit. They are intentionally deferred until after alpha — implementing them correctly requires a proper auth middleware layer that is out of scope for alpha.

### **Persona Ownership Auth on Runtime Endpoints** (Post-Alpha)
**Status**: Deferred — no auth middleware layer yet  
**Priority**: High (post-alpha)

Runtime API endpoints currently accept `personaId` as a query/body parameter with no verification that the authenticated caller owns that persona:
- `GET /api/runtime/journey`
- `GET /api/runtime/nbe`
- `GET /api/runtime/knyt-state`
- `GET /api/runtime/qriptopian-readiness`

**Required work:**
- [ ] Implement session/JWT auth middleware for Next.js API routes
- [ ] Verify `req.user.personaId === params.personaId` before serving data
- [ ] Return 401/403 for mismatched or unauthenticated requests
- [ ] Integrate with existing Supabase Auth or AA-API session tokens

### **Admin Role Gate on Registry `force` Parameter** (Post-Alpha)
**Status**: Deferred — no role system at API layer yet  
**Priority**: Medium (post-alpha)

The `force: true` parameter in `POST /api/registry/intake/package-skill` is documented as admin-only but is not enforced. Any caller can pass it to bypass trust-band gating.

**Required work:**
- [ ] Implement RBAC middleware that resolves caller role from session token
- [ ] Check `role === 'admin'` or `crm_admin_roles` presence before allowing `force: true`
- [ ] Return 403 if non-admin caller passes `force: true`
- [ ] Extend to other admin-only flags across registry governance endpoints

---

---

## 🎯 DIDQube System Backlog

### **Sprint 2: Cohorts & Escrow** (Deferred)
**Original Timeline**: 2 weeks  
**Status**: Not started  
**Priority**: Medium

- [ ] **Cohort Assignment Logic**
  - Implement automatic cohort assignment based on reputation
  - Define cohort tiers and membership criteria
  - Build cohort management API endpoints

- [ ] **Alias Registration Flow**
  - User interface for registering cohort aliases
  - Validation and uniqueness checks
  - Integration with Escrow canister

- [ ] **Mailbox Relay System**
  - Implement message routing through cohort aliases
  - Build relay logic in Escrow canister
  - Create UI for mailbox management

- [ ] **TTL Expiry Testing**
  - Test time-to-live expiration for aliases
  - Implement cleanup jobs for expired aliases
  - Build monitoring for TTL violations

---

### **Sprint 3: Reputation & Policy** (Deferred)
**Original Timeline**: 2 weeks  
**Status**: Not started  
**Priority**: Medium

- [ ] **Reputation Bucket Proofs**
  - Generate cryptographic proofs for reputation claims
  - Implement zero-knowledge proof system
  - Build verification endpoints

- [ ] **TokenQube Policy Enforcement**
  - Integrate reputation requirements into TokenQube
  - Build policy evaluation engine
  - Create policy testing framework

- [ ] **Reputation Dashboard Enhancements**
  - Advanced analytics and visualizations
  - Historical reputation tracking
  - Comparative reputation metrics

- [ ] **Policy Testing UI**
  - Interface for testing policy rules
  - Simulation of reputation scenarios
  - Policy debugging tools

---

### **Sprint 4: Disputes & Flags** (Deferred)
**Original Timeline**: 2 weeks  
**Status**: Not started  
**Priority**: Low

- [ ] **Flag Submission UI**
  - User interface for flagging personas
  - Evidence attachment system
  - Flag categorization

- [ ] **Dispute Resolution Interface**
  - Admin interface for reviewing disputes
  - Evidence evaluation tools
  - Resolution workflow management

- [ ] **Exoneration System**
  - Process for clearing false flags
  - Reputation restoration logic
  - Appeal mechanism

- [ ] **Admin Dispute Management**
  - Dashboard for dispute oversight
  - Bulk dispute handling
  - Dispute analytics and reporting

---

### **Identity & FIO Reliability** (Deferred)
**Status**: Not started  
**Priority**: Medium

- [ ] **FIO Handle Availability Service**
  - Move handle availability checks to server API with strict timeout
  - Retry against secondary FIO endpoint
  - Return explicit status (available/unavailable/timeout/error)
  - Cache results briefly to reduce external dependency stalls
- [ ] **Tenant Discoverable Agent Directory**
  - Add tenant-scoped agent lookup for Quick Add
  - Surface discoverable agent personas in the wallet UI
  - Support search, paging, and filtered retrieval

---

## 🔗 Cross-Chain Infrastructure Backlog

### **DVN & Proof of State** (Partially Complete)
**Status**: Core functionality complete, enhancements deferred  
**Priority**: Medium

- [ ] **Redeploy proof_of_state Canister**
  - Add missing methods: `issue_receipt`, `batch`, `anchor`
  - Update IDL with complete interface
  - Test end-to-end anchoring flow

- [ ] **Redeploy DVN Canister**
  - Fix dependency canister ID mismatches
  - Update to latest canister versions
  - Verify attestation flow

- [ ] **End-to-End Transaction Flow**
  - Complete EVM → DVN → BTC anchoring pipeline
  - Add comprehensive error handling
  - Build monitoring for full flow

- [ ] **Fallback Implementations**
  - DVN attestation fallback routes
  - Verification fallback logic
  - Graceful degradation strategies

---

### **Operations Console Enhancements** (Deferred)
**Status**: Basic console complete  
**Priority**: Low

- [ ] **Transaction History & Audit Trails**
  - Persistent transaction logging
  - Audit trail visualization
  - Export functionality

- [ ] **Automated Health Checks**
  - Scheduled health monitoring
  - Alerting system for failures
  - Auto-recovery mechanisms

- [ ] **Performance Metrics**
  - Detailed performance dashboards
  - Historical performance tracking
  - Bottleneck identification

- [ ] **Operator Troubleshooting Guides**
  - Common issue resolution guides
  - Diagnostic tools and scripts
  - Runbook documentation

---

### **Three-Tier Batching System** (Deferred)
**Status**: Tier 1 & 2 complete, Tier 3 planned  
**Priority**: Medium  
**Source**: Progress Report 2025-10-12

- [ ] **Server-Side Batching (Tier 3)**
  - Implement Next.js append-only transaction logs
  - Build Merkle tree batcher
  - Create DVN BatchCommit integration
  - Implement PoS batch receipt system
  - Build purge policies for old logs
  - Create audit index and proof APIs

- [ ] **Governance Thresholds**
  - Define batching thresholds
  - Implement governance controls
  - Build threshold monitoring dashboard

---

## 📱 Registry & iQube System Backlog

### **Server-Driven State & Ownership** (Deferred)
**Status**: Transitional state in place  
**Priority**: Medium  
**Source**: PROGRESS_REPORT.md

- [ ] **Migrate Local Flags to Server**
  - Move `minted` flag from localStorage to server
  - Move `owner` flag from localStorage to server
  - Move `active` flag from localStorage to server
  - Implement server-side ownership checks

- [ ] **Real-Time UI Consistency**
  - Standardize `registryTemplateUpdated` events
  - Adopt SWR or similar invalidation strategy
  - Implement optimistic UI updates

---

### **Auto-Drive Payloads for Liquid UI Template Archetypes** (Deferred)
**Status**: Not started  
**Priority**: Medium

- [ ] **Define canonical template payload schema**
  - Define versioned payload for `LiquidUITemplateArchetypeQube` (e.g. `schemaVersion`, `liquid_template_id`, `archetype`, UI metadata, optional manifest/slots)
  - Specify how payload maps to `metaExtras` vs stored payload blob

- [ ] **Upload payload blobs to Auto-Drive and persist references**
  - Use existing Auto-Drive upload service (chunked upload/retry)
  - Store returned URL / CID / drive reference on the iQube registry record (e.g. `metaExtras.autodrive_payload_ref`)
  - Establish size limits and content-type conventions

- [ ] **Index + retrieval path (server API)**
  - Add API support to fetch template payload by reference with caching
  - Implement fallback order: Supabase payload ref → Auto-Drive → local seeded store
  - Add basic validation + error shaping so gallery never hard-crashes

- [ ] **Dev tooling**
  - Add a script/endpoint to batch-publish the 20 template archetype payloads
  - Add a script/endpoint to rebuild a lightweight index manifest for fast listing

---

### **Smart Content Variant Tooling** (Planned)
**Status**: Not started  
**Priority**: Medium

- [ ] Add image variants inspector to Smart Content modal (preview ratios + device selection + resolver output)
- [ ] Add Studio Codex authoring flow for Runtime capsules (design Codex layouts/summaries directly in Composer and publish capsule-ready presets)
- [ ] Extend Runtime Capsule Framework adapters beyond Codex + ExperienceQube (unified summary/runtime rendering for additional source types from SmartContent/Liquid UI registry)
- [ ] Author Runtime DIS baseline from implemented visual/runtime capsule requirements and run DPR audit profile for Runtime shell
- [ ] Update Liquid template fallback resolution so Codex tabs can hydrate from SmartContent modules as well as ExperienceQube modules
  - Do not require ExperienceQube packet/context IDs (`feature_item_id`, `supporting_item_ids`) for fallback rendering
  - Add fallback SmartContent sourcing by intent/realm/tags when packet context is absent
  - Preserve ExperienceQube packet hydration when packet/context IDs are present

---

### **Operator & Audit Enhancements** (Deferred)
**Status**: Basic functionality in place  
**Priority**: Low

- [ ] **Event/Audit Trails**
  - Log mint operations
  - Log save operations
  - Log fork operations
  - Build audit trail viewer

- [ ] **Admin Analytics**
  - Extend `/api/registry/analytics` endpoint
  - Build admin analytics dashboard
  - Add usage metrics and reporting

---

### **Authentication & Access Control** (Deferred)
**Status**: Not started  
**Priority**: High (for production)

- [ ] **Wallet/Session Authentication**
  - Implement wallet connection
  - Build session management
  - Add capability token system

- [ ] **Supabase RLS Policies**
  - Per-user visibility controls
  - Row-level security implementation
  - Access control testing

---

### **CI/CD & Quality Gates** (Deferred)
**Status**: Not started  
**Priority**: Medium

- [ ] **GitHub Actions**
  - Lint workflow
  - Build workflow
  - Test workflow
  - Deploy workflow

- [ ] **E2E Testing**
  - Playwright setup
  - Minting flow smoke tests
  - Registry browsing tests
  - Markdown linting

---

### **UX Refinements** (Deferred)
**Status**: Core UX complete  
**Priority**: Low

- [ ] **Layout Polish**
  - Optional divider between view icons and cart
  - Fine-grained spacing adjustments
  - Pixel-perfect alignment passes

- [ ] **Active Cartridge → Tenant Binding**
  - Use the active cartridge context to set the QubeTalk tenant id
  - Default to `metame` when no cartridge is active

- [ ] **Documentation with Screenshots**
  - Add screenshots to OPERATORS_MANUAL.md
  - Create workflow diagrams
  - Build interactive guides

---

## 🔧 Developer Experience Backlog

### **Build & Development Tools** (Deferred)
**Status**: Basic scripts in place  
**Priority**: Low

- [ ] **Makefile Targets**
  - `make backup` - Create timestamped backup
  - `make restore` - Restore from backup
  - `make dev` - Start development server
  - `make build` - Production build
  - `make test` - Run test suite

---

### **Observability** (Deferred)
**Status**: Not started  
**Priority**: Medium (for production)

- [ ] **Structured Logging**
  - Implement structured logs for API routes
  - Add frontend logging for key flows
  - Build log aggregation

- [ ] **Metrics & Monitoring**
  - Performance budgets for SSR/CSR
  - API endpoint metrics
  - User flow analytics

---

### **Hardening & Scale** (Deferred)
**Status**: Not started  
**Priority**: High (for production)

- [ ] **Caching Strategies**
  - Progressive caching implementation
  - CDN integration
  - Cache invalidation logic

- [ ] **Pagination**
  - Large registry pagination
  - Infinite scroll implementation
  - Performance optimization

---

## 📊 Backlog Management

### **Priority Levels**
- **High**: Required for production readiness
- **Medium**: Valuable enhancements, schedule when capacity allows
- **Low**: Nice-to-have improvements, opportunistic work

### **Status Definitions**
- **Not Started**: No work begun
- **Partially Complete**: Some components implemented
- **Deferred**: Actively deprioritized from current sprint

### **Review Cadence**
- Review backlog monthly
- Reprioritize based on user feedback and business needs
- Move items to active sprint as capacity allows

---

## 🔄 Moving Items from Backlog

When moving an item from backlog to active sprint:

1. Update status in this document
2. Create detailed task breakdown
3. Assign to sprint in project management tool
4. Update relevant workplan document
5. Notify team of scope change

---

## 📝 Notes

- This backlog is a living document
- Items may be promoted, demoted, or removed based on changing priorities
- Always reference source documents for full context
- Keep this document updated as work progresses

## 🎛 SmartMenuBar — Be/Earn/Play/Make/Share Mode Bar (Deferred)

**Priority:** Medium  
**Status:** Infrastructure built, deferred — not mission critical for alpha  
**Background:** The thin client (Lovable) exposes a horizontal Be/Earn/Play/Make/Share mode bar
that fires `MENU_ACTION` postMessages to the MetaMe runtime iframe and calls
`POST /api/aa/v1/runtime/menu-action`. This work replicates that UI in the Next.js app shell.

### What's done (code exists, just not wired up)

All backend infrastructure already exists: `MENU_ITEMS` in `runtimeShell.ts`,
`POST /api/aa/v1/runtime/menu-action`, `createShellMessage` factory in `iframe-bridge`.
Context and component were built and reverted in April 2026 — recreate from scratch when needed.

### What's needed

- [ ] `app/contexts/SmartMenuContext.tsx` — active mode state + `activateMode()` that fires
  `POST /api/aa/v1/runtime/menu-action` + postMessage to `iframe[data-metame-runtime]`
- [ ] `components/shell/SmartMenuBar.tsx` — horizontal pill bar (Be/Earn/Play/Make/Share),
  ring-1 glass active state, Lucide icons (Users/Coins/PlayCircle/Pencil/Share2),
  accent colors from `runtimeShell.ts` MENU_ITEMS
- [ ] Wire `SmartMenuProvider` + `<SmartMenuBar />` into `app/(shell)/layout.tsx`
  above the main content area, hidden on `isIsolatedContent` surfaces

### Design notes

- Active pill: `ring-1 ring-{color}/30 bg-{color}/10` (platform glass pattern)
- Colors: be=slate-400, earn=emerald-400, play=cyan-400, make=violet-400, share=amber-400
- Hidden when `isIsolatedContent` (embedded MetaMe runtime, studio experience editor)
- The bar should NOT appear at the top of all pages (position below sidebar, above page content)

---

## Runtime Backlog Additions

- **Medium**: Add an admin UI control in the metaMe Runtime to trigger and monitor KB re-embedding batches, including active embedding provider/model display and batch progress status.

---

## 🏭 AgentiQ OS — Skills Ingestion Agent (Gate 3.5)

**Priority:** Medium  
**Status:** Not started — blocked on Gate 3 + 4 completion (Factory visible, Studio receipt emission live)  
**Owner:** Claude (primary)  
**Prerequisite gates:** Gate 3 (Factory intake trace visible) + Gate 4 (Registry supply browsable + Studio receipt emission)  
**Estimated size:** ~200 lines + 1 API route  

### Context

The Registry Ingestion Factory pipeline (`types/registryIngestion.ts`) has a fully-defined `SkillQube` asset class with `interfaceSchema`, `capabilities[]`, and `steps[]`. The `WrapperStrategy = "skill"` is already typed. Currently, all `SkillQube` submissions require manual packaging and human review. This agent automates the packaging and interface-validation stages for SkillQube submissions specifically, reducing the trust-band bottleneck for L1–L2 community submissions.

### Where it fits in the pipeline

```
source.classified (assetClass = "SkillQube")
  ↓
  ┌─── SKILLS INGESTION AGENT ─────────────────────────────┐
  │  1. Extract interface schema from SourceQube manifest   │
  │     (auto-generate CapabilityDescriptor[] from         │
  │      sourceManifest.exports + detectedCapabilities)    │
  │  2. Sandbox smoke test — invoke entry point with       │
  │     stub inputs, verify structured output              │
  │  3. Interface conformance check — validate schema       │
  │     against SkillQube.interfaceSchema contract         │
  │  4. Iterate — patch schema gaps, retry (max 3 rounds)  │
  └────────────────────────────────────────────────────────┘
  ↓
asset.packaged (SkillQube with populated interfaceSchema +
  capabilities[] + ValidationStageResult records for
  sandbox_smoke + interface_conformance)
  ↓
trust.scoring → review.pending → asset.published
```

### What it does NOT own

- Trust scoring (`trustBandFromScore` in `types/registryIngestion.ts:532`)
- Human review / `review.approved` decisions
- License scan, secret scan, dependency inventory (these are upstream validation stages)
- Non-SkillQube asset classes — ToolQube, WorkflowQube, ConnectorQube each need their own packaging agents

### Key design notes

- **Adaptation from skill-creator:** The skill-creator Skill.md (draft→test→eval→iterate loop) is the design basis. The "draft" phase is inverted: instead of generating a skill from requirements, it *extracts and normalises* the existing skill's interface from the inbound `SourceQube`. Everything else (test → eval → iterate) maps directly.
- **Retry gate:** Max 3 iteration rounds. On third failure, set `ValidationStageStatus = "failed"` with a structured report and hand off to human review with full diagnostic context.
- **Trust band ceiling:** A SkillQube that passes automated validation with no warnings is eligible for up to `L3_PRODUCTION_CANDIDATE`. `L4+` always requires human review regardless.
- **Agent ID:** `agentiq-skills-packager` — distinct from `claude-code` so its actions are attributable in `ValidationQube.triggeredBy`.

### Implementation when ready

| File | Action |
|------|--------|
| `app/api/registry/intake/package-skill/route.ts` | New POST route — receives `intakeId`, runs packaging agent loop, returns `SkillQube` + `ValidationStageResult[]` |
| `services/registry/skillPackager.ts` | Agent loop: extract → smoke → conformance → iterate |
| `types/registryIngestion.ts` | No changes needed — all types are already defined |
| `app/triad/components/codex/tabs/FactoryIntakeTab.tsx` | Minor: surface "auto-packaged" badge on SkillQube rows |

### Acceptance test (when built)

1. Submit a GitHub repo (`sourceType: "github_repo"`) that exports a well-typed skill function
2. Factory classifies it as `SkillQube`
3. Skills ingestion agent runs, populates `interfaceSchema` and `capabilities[]`, passes `interface_conformance`
4. Asset reaches `trust.scored` at `L2_VERIFIED_COMMUNITY` without any human intervention
5. `FactoryIntakeTab` shows the full stage history including the agent's packaging pass

---

## 🛠 Campaign Skills Registry

Skills built during the KNYT Wheel campaign that are candidates for ingestion into the Factory as SkillQubes and exposure to Marketa for automated campaign execution.

All skills have:
- A Claude Code slash command in `.claude/commands/`
- An implementation script in `scripts/`
- A SkillQube manifest in `scripts/skills/` ready for ingestion

### Built

| Skill | Slash Command | Script | SkillQube Manifest | Status |
|---|---|---|---|---|
| Create Mailjet Templates | `/create-mailjet-templates` | `scripts/mailjet_create_templates.py` | `scripts/skills/create-mailjet-templates.skill.json` | ✅ Ready to ingest |
| Run Campaign Smoke Test | `/run-campaign-smoke-test` | `scripts/campaign_smoke_test.py` | `scripts/skills/run-campaign-smoke-test.skill.json` | ✅ Ready to ingest |
| Send Campaign Sequence | `/send-campaign-sequence` | `scripts/send_campaign_sequence.py` | `scripts/skills/send-campaign-sequence.skill.json` | ✅ Ready to ingest |
| Setup Mailjet Webhooks | `/setup-mailjet-webhooks` | `scripts/mailjet_setup_webhooks.py` | `scripts/skills/setup-mailjet-webhooks.skill.json` | ✅ Ready to ingest |
| Assign Campaign Cohorts | `/assign-cohorts` | `scripts/assign_cohorts.py` | `scripts/skills/assign-cohorts.skill.json` | ✅ Ready to ingest |
| Sync KS Backers | `/sync-ks-backers` | `scripts/ks_backer_sync.py` | `scripts/skills/sync-ks-backers.skill.json` | ✅ Ready to ingest |

### Needed — Campaign Automation

| Skill | Description | Priority |
|---|---|---|
| `send-campaign-sequence` | ~~Dispatch a named KNYT Wheel sequence to a cohort via the channel registry~~ **Built** | ~~High~~ |
| `assign-cohorts-bulk` | Bulk-assign `campaign_cohort` to investors by filter (investment band, state) | High |
| `sync-ks-backers` | ~~Ingest Kickstarter backer CSV → set `kickstarter_backed_at + campaign_state=backed`~~ **Built** | ~~High~~ |
| `campaign-metrics-snapshot` | Pull the 11 dashboard metrics and emit a structured report | Medium |
| `reactivation-queue-build` | Query `knyt_followup_queue` for high-urgency prospects and build the reactivation send list | Medium |
| `partner-outreach-update` | Update partner status in `partner_outreach` table from a structured list | Low |

### Needed — Channel Adapters (Marketa use)

| Skill | Description | Priority |
|---|---|---|
| `create-sendgrid-templates` | Same as Mailjet equivalent but for SendGrid Dynamic Templates | Medium |
| `create-twilio-sms-templates` | Register SMS message templates in Twilio for KNYT Wheel sequences | Low |
| `send-telegram-blast` | Dispatch a campaign message via Telegram Bot API | Low |

### Ingestion Plan

When Gates 3 + 4 are complete:
1. Submit each `scripts/skills/*.skill.json` manifest to the Factory via `POST /api/registry/intake`
2. The Skills Ingestion Agent (`agentiq-skills-packager`) auto-packages each SkillQube through sandbox smoke test + interface conformance validation
3. Published SkillQubes become callable by Marketa via the channel registry or a `SkillQube.invoke()` API
4. Marketa can trigger `send-campaign-sequence` or `reactivation-queue-build` as part of automated activation flows

---

**Maintained by**: Development Team  
**Review Schedule**: Monthly  
**Last Review**: April 13, 2026
