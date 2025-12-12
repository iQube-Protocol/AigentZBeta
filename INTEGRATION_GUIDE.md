# The Qriptopian Integration Guide

This guide documents the step-by-step integration of The Qriptopian into the AgentiQ / AigentZ monorepo as a first-class franchise thin client.

## Table of Contents

1. [Overview](#overview)
2. [Integration Phases](#integration-phases)
3. [Current Status](#current-status)
4. [Architecture Decisions](#architecture-decisions)
5. [Next Steps](#next-steps)

---

## Overview

### Objective

Transform The Qriptopian from a standalone Lovable application into a first-class franchise thin client within the AigentZ/AgentiQ monorepo, establishing a repeatable pattern for future franchise applications.

### Key Requirements

- ✅ Decoupled deployments (no estate-wide redeploys)
- ✅ Windsurf handles core logic and wiring
- ✅ Lovable handles UI/UX polish
- ✅ Issues as CodexQubes (data, not apps)
- ✅ Tenants as config (data, not apps)
- ✅ Shared packages are versioned and stable

### Success Criteria

- [ ] The Qriptopian runs independently at its own URL
- [ ] Adding Issue 1 requires ZERO deployments
- [ ] Adding new tenant requires ZERO code changes
- [ ] Shared packages (SmartTriad, SmartWallet, etc.) are reusable
- [ ] Both Windsurf and Lovable can work effectively

---

## Integration Phases

### Phase 0: Discovery & Architecture Setup ✅ **COMPLETE**

**Objectives:**
- Audit The Qriptopian repository
- Audit AigentZ repository structure
- Define deployment architecture
- Clone and analyze codebase

**Completed Actions:**
- ✅ Cloned The Qriptopian from GitHub
- ✅ Analyzed tech stack: Vite + React + TypeScript + shadcn-ui
- ✅ Identified AA-API integration at `src/lib/aigentiq-client.ts`
- ✅ Documented agents: Nakamoto, KNOW1, MoneyPenny
- ✅ Created `/DEPLOYMENT_ARCHITECTURE.md`
- ✅ Created `/pnpm-workspace.yaml`

**Key Findings:**
- The Qriptopian has custom AA-API client
- AIOverlay is modal-based (needs iframe conversion)
- Content structure supports Issue 0 prototype
- Supabase integration exists
- No SmartTriad/SmartWallet integration yet

---

### Phase 1: Monorepo Integration with Isolation 🚧 **IN PROGRESS**

**Objectives:**
- Set up workspace structure
- Move The Qriptopian into `apps/theqriptopian-web`
- Create placeholder shared packages
- Establish independent build capability

**Completed Actions:**
- ✅ Created `apps/` and `packages/` directories
- ✅ Moved The Qriptopian to `apps/theqriptopian-web`
- ✅ Updated `package.json` to `@agentiq/theqriptopian-web`
- ✅ Created comprehensive app README
- ✅ Created placeholder packages:
  - `@agentiq/smarttriad`
  - `@agentiq/smartwallet`
  - `@agentiq/codex`
  - `@agentiq/agentiq-sdk`
  - `@agentiq/avatar-host`

**Remaining Actions:**
- [ ] Verify independent build: `pnpm --filter theqriptopian-web build`
- [ ] Set up CI/CD pipeline for independent deployment
- [ ] Configure environment variables
- [ ] Test local development workflow

**Validation:**
```bash
cd /Users/hal1/CascadeProjects/AigentZBeta
pnpm install
pnpm --filter @agentiq/theqriptopian-web dev
```

---

### Phase 2: SmartWallet Extraction as Versioned Library

**Objectives:**
- Extract wallet UI components from AigentZ
- Create `@agentiq/smartwallet` package
- Integrate into The Qriptopian
- Version and publish to workspace

**Planned Actions:**
- [ ] Audit existing wallet components in AigentZ
- [ ] Extract to `packages/smartwallet/src/`
- [ ] Define stable API surface
- [ ] Create TypeScript types
- [ ] Build and test package
- [ ] Update The Qriptopian to consume `@agentiq/smartwallet@0.1.0`

**API Design:**
```typescript
// packages/smartwallet/src/index.ts
export { SmartWallet } from './SmartWallet';
export { useWallet } from './hooks/useWallet';
export { WalletProvider } from './WalletProvider';
export type { WalletConfig, Transaction, Balance } from './types';
```

---

### Phase 3: CodexQube as Data Layer

**Objectives:**
- Model Issue 0 as a CodexQube
- Create `@agentiq/codex` package
- Implement data-driven content system
- Wire to QubeBase backend

**Planned Actions:**
- [ ] Define CodexQube schema
- [ ] Extract to `packages/codex/src/`
- [ ] Create Issue 0 data structure
- [ ] Implement QubeBase integration
- [ ] Wire into The Qriptopian content display

**Data Model:**
```typescript
// packages/codex/src/types/CodexQube.ts
interface CodexQube {
  codexId: string;
  franchiseId: string;
  title: string;
  subtitle?: string;
  sections: Section[];
  metadata: {
    issueNumber: number;
    publishDate: string;
    accessLevel: 'free' | 'paid' | 'premium';
  };
}

interface Section {
  sectionId: string;
  title: string;
  articles: Article[];
}

interface Article {
  articleId: string;
  title: string;
  subtitle?: string;
  content: string;
  author?: string;
  readTime: string;
  image?: string;
}
```

---

### Phase 4: SmartTriad with Config-Driven Behavior

**Objectives:**
- Extract SmartTriad layout system
- Create `@agentiq/smarttriad` package
- Implement config-driven drawer system
- Integrate into The Qriptopian

**Planned Actions:**
- [ ] Audit existing SmartTriad components
- [ ] Extract to `packages/smarttriad/src/`
- [ ] Define config schema
- [ ] Implement drawer management
- [ ] Replace The Qriptopian's current navigation

**Config Schema:**
```typescript
// packages/smarttriad/src/types/Config.ts
interface SmartTriadConfig {
  franchiseId: string;
  drawers: DrawerConfig[];
  defaultDrawer?: string;
  theme?: ThemeConfig;
}

interface DrawerConfig {
  id: string;
  label: string;
  icon: string;
  enabled: boolean;
  content: React.ComponentType;
}
```

---

### Phase 5: Global AvatarHost as Shared Primitive

**Objectives:**
- Convert AIOverlay from modal to persistent iframe
- Create `@agentiq/avatar-host` package
- Implement cross-app communication
- Ensure metaAvatar persistence

**Planned Actions:**
- [ ] Design iframe communication protocol
- [ ] Extract to `packages/avatar-host/src/`
- [ ] Implement persistent state management
- [ ] Convert The Qriptopian's AIOverlay
- [ ] Test cross-app navigation

**Architecture:**
```
┌─────────────────────────────────────┐
│  The Qriptopian App                 │
│  ┌───────────────────────────────┐  │
│  │  Content                      │  │
│  │                               │  │
│  │  ┌──────────────────────┐    │  │
│  │  │ AvatarHost (iframe)  │◄───┼──┼─── Persistent across navigation
│  │  │ - Agent Chat         │    │  │
│  │  │ - Minimizable        │    │  │
│  │  └──────────────────────┘    │  │
│  └───────────────────────────────┘  │
└─────────────────────────────────────┘
```

---

### Phase 6: Copilot + Codex with Service Boundaries

**Objectives:**
- Wire AA-API to shared SDK
- Create `@agentiq/agentiq-sdk` package
- Integrate Copilot with CodexQubes
- Implement agent-content interactions

**Planned Actions:**
- [ ] Extract AA-API client from The Qriptopian
- [ ] Enhance to `packages/agentiq-sdk/src/`
- [ ] Add Codex-aware features
- [ ] Implement agent context from CodexQubes
- [ ] Test agent responses with Issue 0 content

**SDK API:**
```typescript
// packages/agentiq-sdk/src/index.ts
export class AgentiQClient {
  async chat(params: ChatParams): Promise<ChatResponse>;
  async streamChat(params: ChatParams): AsyncIterable<string>;
  async executeAction(params: ActionParams): Promise<ActionResponse>;
  
  // Codex integration
  async chatWithContext(
    params: ChatParams & { codexId: string }
  ): Promise<ChatResponse>;
}
```

---

### Phase 7: Documentation & Lovable Boundaries

**Objectives:**
- Document Windsurf vs Lovable responsibilities
- Create handoff procedures
- Establish safe zones for each agent
- Validate integration completeness

**Planned Actions:**
- [ ] Create Lovable handoff documentation
- [ ] Define safe modification zones
- [ ] Document Lovable → Windsurf sync process
- [ ] Validate Windsurf → Lovable → Windsurf workflow
- [ ] Create final integration checklist

**Lovable Safe Zones:**
- ✅ UI components in `apps/theqriptopian-web/src/components/`
- ✅ Page layouts in `apps/theqriptopian-web/src/pages/`
- ✅ Styling (Tailwind classes)
- ✅ Visual refinements

**Windsurf Exclusive:**
- ❌ Shared packages (`packages/**`)
- ❌ AA-API integration
- ❌ Build configuration
- ❌ CI/CD pipelines

---

## Current Status

### Completed ✅

- [x] Phase 0: Discovery & Architecture Setup
- [x] Deployment architecture documented
- [x] Workspace structure created
- [x] The Qriptopian moved to monorepo
- [x] Placeholder packages created

### In Progress 🚧

- [ ] Phase 1: Monorepo Integration
  - [x] Directory structure
  - [x] Package configuration
  - [ ] Independent build verification
  - [ ] CI/CD setup

### Pending ⏳

- [ ] Phase 2: SmartWallet Extraction
- [ ] Phase 3: CodexQube Implementation
- [ ] Phase 4: SmartTriad Integration
- [ ] Phase 5: AvatarHost Extraction
- [ ] Phase 6: Copilot Integration
- [ ] Phase 7: Documentation & Boundaries

---

## Architecture Decisions

### Decision 1: Issues as CodexQubes

**Context**: Need to support multiple issues (Issue 0, 1, 2...) without deployment bloat.

**Decision**: Model issues as CodexQube data structures in QubeBase.

**Rationale**:
- Issues are content, not applications
- Adding Issue 1 should require ZERO deployments
- Content should be versionable and queryable
- Enables archive/library in SmartWallet

**Implications**:
- Frontend queries CodexQubes by franchiseId + filters
- Backend stores in QubeBase
- UI displays via Codex drawer

---

### Decision 2: Tenants as Config

**Context**: Need to support branded editions (Acme Edition, Global Edition).

**Decision**: Implement tenants as config + data, not separate apps.

**Rationale**:
- Tenants share the same codebase
- Differentiation via branding, feature flags, and Codex sets
- Adding tenant should require ZERO code changes
- DNS/routing determines tenant

**Implications**:
- App reads `tenant_id` from URL or header
- QubeBase stores tenant config
- Theme/branding loaded dynamically

---

### Decision 3: Persistent AvatarHost

**Context**: Need seamless agent interaction across franchise navigation.

**Decision**: Convert modal AIOverlay to persistent iframe.

**Rationale**:
- Agents should persist across page navigation
- Chat history should be maintained
- Minimizable but always accessible
- Cross-franchise consistency

**Implications**:
- iframe communication protocol required
- Global state management needed
- Performance considerations for persistence

---

## Next Steps

### Immediate (Phase 1 Completion)

1. **Verify Independent Build**
   ```bash
   cd /Users/hal1/CascadeProjects/AigentZBeta
   pnpm install
   pnpm --filter @agentiq/theqriptopian-web build
   ```

2. **Test Local Development**
   ```bash
   pnpm --filter @agentiq/theqriptopian-web dev
   # Should run on http://localhost:5173
   ```

3. **Set Up Environment Variables**
   - Create `apps/theqriptopian-web/.env.local`
   - Configure `VITE_AIGENTIQ_API_URL`
   - Test AA-API connectivity

4. **Create CI/CD Pipeline**
   - GitHub Actions workflow
   - Change detection for `apps/theqriptopian-web/**`
   - Independent deployment

### Short-term (Phase 2-3)

1. Extract SmartWallet components
2. Define CodexQube schema for Issue 0
3. Wire QubeBase integration
4. Test data-driven content display

### Medium-term (Phase 4-5)

1. Extract SmartTriad layout system
2. Convert AIOverlay to persistent iframe
3. Implement cross-app communication
4. Test agent persistence

### Long-term (Phase 6-7)

1. Create unified AgentiQ SDK
2. Integrate Copilot with Codex
3. Document Lovable handoff
4. Validate complete workflow

---

## Success Metrics

### Technical

- [ ] The Qriptopian builds independently in < 30 seconds
- [ ] Adding Issue 1 requires 0 deployments
- [ ] Adding new tenant requires 0 code changes
- [ ] Shared packages have < 10% breaking change rate
- [ ] CI/CD only rebuilds affected apps

### Organizational

- [ ] Windsurf can work on core logic without UI concerns
- [ ] Lovable can polish UI without breaking integrations
- [ ] New franchise can be created in < 1 week using pattern
- [ ] Documentation enables team self-service

---

## Document Metadata

- **Version**: 1.0.0
- **Last Updated**: December 7, 2025
- **Current Phase**: Phase 1 (In Progress)
- **Next Review**: After Phase 1 completion
- **Owner**: AgentiQ Architecture Team

---

## References

- [Deployment Architecture](./DEPLOYMENT_ARCHITECTURE.md)
- [The Qriptopian App README](./apps/theqriptopian-web/README.md)
- [Lovable Project](https://lovable.dev/projects/5dcd1f2a-578c-4257-92a5-11160c5d01aa)
- [AgentiQ Monorepo Memory](https://internal-docs/memory/55b1f704-5212-4674-becd-86adec7eb32d)
