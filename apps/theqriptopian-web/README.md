# The Qriptopian

**The Qriptopian** is a first-class franchise application within the AgentiQ / AigentZ monorepo. It delivers verifiable AI-powered journalism where every story is traceable and agents work alongside humans to uncover truth in the digital age.

## 🎯 Franchise Overview

- **App ID**: `theqriptopian`
- **Display Name**: The Qriptopian
- **Type**: Franchise (Thin Client)
- **Tagline**: "Digital Intelligence Meets Immutable Truth"

## 📐 Architecture Position

```
AgentiQ Monorepo
├── apps/
│   ├── aigentz-admin/         # Thick orchestration platform
│   ├── theqriptopian-web/     # ← THIS APP (franchise thin client)
│   └── qriptopia-web/          # Other franchises
│
└── packages/
    ├── smarttriad/             # Smart menu + drawers + layouts
    ├── smartwallet/            # Wallet UI + logic
    ├── codex/                  # CodexQube models
    ├── agentiq-sdk/            # AA-API client
    └── avatar-host/            # Persistent metaAvatar iframe
```

## 🔑 Key Concepts

### Issues vs Tenants

**Issues** (e.g., Issue 0, Issue 1):
- Content versions stored as **CodexQubes** in QubeBase
- No code deployment required to add new issues
- Archived in Codex drawer + SmartWallet Library

**Tenants** (e.g., "Acme Edition", "Global Edition"):
- Config-driven branding and feature sets
- Same codebase, different `tenant_id`
- No code deployment required to add new tenants

### Agents

The Qriptopian integrates three specialized agents:

1. **Nakamoto** - Crypto & blockchain intelligence
2. **KNOW1** - Knowledge & research intelligence
3. **MoneyPenny** - COYN & Q¢ financial intelligence

## 🛠️ Tech Stack

- **Framework**: Vite + React 18 + TypeScript
- **UI**: shadcn-ui + Tailwind CSS + Radix UI
- **State**: TanStack React Query
- **Routing**: React Router v6
- **Backend**: Supabase + AgentiQ AA-API
- **AI**: AgentiQ Copilot via `/api/aa/copilot`

## 🚀 Development

### Prerequisites

- Node.js 20.x
- pnpm 9.x (monorepo workspace manager)

### Local Setup

```bash
# From monorepo root
cd apps/theqriptopian-web

# Install dependencies (via workspace)
pnpm install

# Run dev server
pnpm dev

# Build for production
pnpm build

# Preview production build
pnpm preview
```

### Environment Variables

Create `.env.local`:

```bash
# AgentiQ API Integration
VITE_AIGENTIQ_API_URL=http://localhost:3000

# Supabase (if needed for local development)
VITE_SUPABASE_URL=<your-supabase-url>
VITE_SUPABASE_ANON_KEY=<your-supabase-anon-key>

# Franchise Config
VITE_FRANCHISE_ID=theqriptopian
VITE_TENANT_ID=global
```

## 📦 Shared Package Dependencies

This app will consume versioned shared packages:

```json
{
  "dependencies": {
    "@agentiq/smarttriad": "^1.0.0",
    "@agentiq/smartwallet": "^1.0.0",
    "@agentiq/codex": "^1.0.0",
    "@agentiq/agentiq-sdk": "^1.0.0",
    "@agentiq/avatar-host": "^1.0.0"
  }
}
```

**Note**: These packages are being extracted from the current codebase during Phase 2-5 of the integration.

## 🎨 UI Components

### Current Components

- **AIOverlay**: Agent chat interface (modal-based)
- **AppSidebar**: Navigation drawer
- **PersonaSelector**: Identity management
- **HeroSection**: Content showcase with read/watch/listen modes
- **LatestNewsCarousel**: Article carousel
- **Navigation**: Top-level navigation

### Planned Integration

- **SmartTriad**: Unified layout with drawers (article, wallet, agents)
- **SmartWallet**: Crypto wallet integration
- **AvatarHost**: Persistent iframe for metaAvatar

## 🔗 AA-API Integration

The Qriptopian connects to AgentiQ's AA-API for agent interactions:

```typescript
// src/lib/aigentiq-client.ts
import { sendChatMessage, streamChatMessage } from '@/lib/aigentiq-client';

// Send a message to an agent
const response = await sendChatMessage(
  [{ role: 'user', content: 'Analyze the latest DeFi trends' }],
  {
    agentId: 'nakamoto',
    tenantId: 'qriptopian',
    franchiseId: 'qriptopian'
  }
);

// Stream a response
await streamChatMessage(
  messages,
  { agentId: 'know1' },
  (chunk) => console.log(chunk),  // onChunk
  () => console.log('Done'),       // onComplete
  (error) => console.error(error)  // onError
);
```

## 📊 Content Structure

### Issues as CodexQubes

```typescript
// Example: Issue 0 as a CodexQube
const issue0: CodexQube = {
  codexId: 'theqriptopian-issue-0',
  title: 'The Qriptopian - Issue 0',
  subtitle: 'Navigate the Quantum-Ready Internet',
  sections: [
    {
      sectionId: 'quantum-tech',
      title: 'Quantum Market Intel',
      articles: [...]
    }
  ],
  metadata: {
    publishDate: '2025-12-07',
    accessLevel: 'free',
    issueNumber: 0
  }
};
```

## 🚢 Deployment

### Independent Deployment

This app deploys **independently** from AigentZ and other franchises:

```yaml
# CI/CD only triggers on changes to:
# - apps/theqriptopian-web/**
# - packages/smarttriad/** (if using this version)
# - packages/smartwallet/** (if using this version)
# - packages/codex/** (if using this version)
```

### Deployment Checklist

- [ ] Run TypeScript compilation: `pnpm tsc --noEmit`
- [ ] Run linting: `pnpm lint`
- [ ] Build production bundle: `pnpm build`
- [ ] Test preview: `pnpm preview`
- [ ] Update environment variables in deployment platform
- [ ] Deploy via CI/CD or manual deployment

## 🔒 Lovable Integration

### Two-Agent Workflow

**Windsurf (You)**: Core logic, wiring, backend integration
**Lovable**: UI/UX polish, visual design, component refinement

### Lovable Project URL

https://lovable.dev/projects/5dcd1f2a-578c-4257-92a5-11160c5d01aa

### Workflow

1. **Windsurf**: Extract shared packages, wire AA-API, integrate SmartTriad
2. **Lovable**: Polish UI, refine interactions, enhance visual design
3. **Windsurf**: Integrate Lovable changes back to monorepo

### Safe Zone for Lovable

Lovable should work on:
- ✅ UI components in `src/components/`
- ✅ Page layouts in `src/pages/`
- ✅ Styling (Tailwind classes, theme)
- ✅ Visual refinements and animations

Lovable should NOT modify:
- ❌ AA-API integration (`src/lib/aigentiq-client.ts`)
- ❌ Package dependencies
- ❌ Build configuration
- ❌ Environment variables

## 📖 Documentation

- [Deployment Architecture](../../DEPLOYMENT_ARCHITECTURE.md)
- [AgentiQ Monorepo Design](../../README.md)
- [Phase-by-Phase Integration Plan](../../docs/integration-plan.md)

## 🤝 Contributing

### Before Submitting PRs

1. Ensure no cross-app imports (`apps/* → apps/*`)
2. Run `pnpm tsc --noEmit` to check TypeScript
3. Update this README if adding new features
4. Follow the deployment architecture rules

### Code Review Checklist

- [ ] TypeScript compilation passes
- [ ] No breaking changes to shared packages
- [ ] Environment variables documented
- [ ] Independent deployment verified
- [ ] Issues implemented as data (CodexQubes)
- [ ] Tenants implemented as config

## 📝 License

Proprietary - iQube Protocol / AgentiQ Platform

---

**Version**: 0.1.0  
**Last Updated**: December 7, 2025  
**Status**: In Development (Phase 1)
